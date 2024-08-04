import { SupportedMediaUploads as SMU, UploadFileOptions, supportedMediaTypes, uploadMethod } from '../types/file';
import { createPlaceholder, downloadAndMergeVideo, downloadAudio } from '../utils/ffmpeg';
import { getURLVideoID, getYoutubeVideoInfo } from '../external/youtube/api';
import { InputFile, MiddlewareFn, MiddlewareObj } from 'grammy';
import { YoutubeMedia, YoutubeVideo } from '../types/youtube';
import { MyContext } from '../types/context';
import { events, isCached } from '../utils/ytmedia';
import TTLCache from '@isaacs/ttlcache';
import { Message } from 'grammy/types';
import EventEmitter from 'events';
import { MusicEntity } from '../external/odesly/types';
import { logger } from '../utils/logger';
import { getVideoID } from '../utils/ytdl-core';

//? It's service because it modifies context
//? Could be middleware but it is also responsible for cache, so let it be service

export class YTDownloadHelper implements MiddlewareObj<MyContext> {
    private readonly cache: TTLCache<string, YoutubeMedia>;
    private readonly placeholders: Partial<Record<SMU, string>>;

    constructor(cacheCapacity: number, cacheTTL: number) {
        this.cache = new TTLCache({ max: cacheCapacity, ttl: cacheTTL });
        this.placeholders = {};
    }

    middleware(): MiddlewareFn<MyContext> {
        return (ctx, next) => {
            ctx.ytdl = {
                get: v => this.get(ctx, v),
                getMusic: (...args) => this.getMusic(ctx, ...args),
                initPlaceholders: c => this.initPlaceholders(ctx, c)
            };
            return next();
        };
    }

    private async get(ctx: MyContext, video: string): Promise<YoutubeVideo> {
        const id = getURLVideoID(video);
        const media = this.cache.get(id);
        const chat_id = ctx.from!.id;

        if (media) return media;

        const info = await getYoutubeVideoInfo(id);
        const emitter = new EventEmitter();
        const newMedia: YoutubeMedia = {
            ...info,
            emitter,
            isCached: 0,
            isExceeds: !info.simpleFormat && !info.videoFormat,
            progress: {
                success: (t, c) => emitter.once(`${t}:${events.success}`, c),
                finished: (t, c) => emitter.once(`${t}:${events.finish}`, c),
                error: (t, c) => emitter.once(`${t}:${events.error}`, c),
                on: c => emitter.on(`video:${events.progress}`, c),
                once: c => emitter.once(`video:${events.progress}`, c)
            },
            getCached: (t, a) => this.cacheAndGet(ctx, id, t, a),
            downloadOrCached: async t => await this.getCached(id, t) ?? this.download(id, t),
            replyWith: (t, o, c) => this.send(ctx, id, c ?? chat_id, { type: t ?? 'video', ...o }),
        };
        this.cache.set(id, newMedia);

        const onFinished = (t: SMU) => (f: string) => {
            this.updateCacheStatus(t, id);
            this.setFileId(t, id, f);
        };

        newMedia.progress.success('video', onFinished('video'));
        newMedia.progress.success('audio', onFinished('audio'));
        newMedia.emitter.on(`video:${events.rawprogress}`, s => {
            newMedia.emitter.emit(`video:${events.progress}`, (+s / +newMedia.duration) * 100);
        });

        return newMedia;
    }

    private async getMusic(ctx: MyContext, audio: string, options: Omit<MusicEntity, 'linksByPlatform'>) {
        const id = getVideoID(audio);
        const uid = id + '+a';
        const media = this.cache.get(uid);
        const chat_id = ctx.from!.id;

        if (media) return media;

        const info = await getYoutubeVideoInfo(id);
        const emitter = new EventEmitter();
        const newMedia: YoutubeMedia<'audio'> = {
            ...info,
            emitter,
            thumbnail: options.cover ?? info.thumbnail,
            title: options?.title ?? info.title,
            ownerChannelName: options?.artist ?? info.ownerChannelName,
            isCached: 0,
            isExceeds: !info.simpleFormat && !info.videoFormat,
            progress: {
                success: (_, c) => emitter.once(`audio:${events.success}`, c),
                error: (_, c) => emitter.once(`audio:${events.error}`, c),
                finished: (_, c) => emitter.once(`audio:${events.finish}`, c),
                on: () => { },
                once: () => { }
            },
            getCached: (_, a) => this.cacheAndGet(ctx, uid, 'audio', a),
            downloadOrCached: async () => await this.getCached(uid, 'audio') ?? this.download(uid, 'audio'),
            replyWith: (_, o, c) => this.send(ctx, uid, c ?? chat_id, { type: 'audio', ...o }),
        };
        this.cache.set(uid, newMedia);

        newMedia.progress.success('audio', (f: string) => {
            this.updateCacheStatus('audio', uid);
            this.setFileId('audio', uid, f);
        });

        return newMedia;
    }

    private async download(id: string, type: SMU = 'video'): Promise<InputFile> {
        const media = this.cache.get(id);
        if (!media) throw new Error('CacheError');
        if (type == 'audio') return new InputFile(() => downloadAudio(media));
        if (media.chooseSimple && media.simpleFormat) {
            const simpleFormat = media.simpleFormat!.getReadable(err => media.emitter.emit(`video:${events.error}`, err));
            return new InputFile(() => simpleFormat);
        }
        const file = await downloadAndMergeVideo(media);
        return new InputFile(file);
    }

    private async send(ctx: MyContext, id: string, chat_id: number, options: UploadFileOptions<SMU>,) {
        const { type } = options;
        const media = this.cache.get(id);
        if (!media) throw new Error('CacheError');
        if (!options.thumbnail && media.thumbnail) options.thumbnail = new InputFile({ url: media.thumbnail });
        const cache = await this.getCached(id, type);
        const task = sendToTelegram(ctx, chat_id, cache ?? this.download(id, type), options);
        if (cache) {
            logger.debug(`Using cached media: ${id} | ${cache}`);
            return task;
        }

        this.setFileId(type, id, null); // null - indicates that file is already downloading
        return Promise.race<Message>([
            new Promise((_, rej) => media.progress.error(type, rej)),
            task.then(msg => {
                media?.emitter.emit(`${type}:${events.success}`, msg[type]!.file_id);
                return msg;
            }),
        ]).catch(r => {
            this.setFileId(type, id, undefined);
            throw new Error(r);
        }).finally(() => media.emitter.emit(`${type}:${events.finish}`));
    }

    async initPlaceholders(ctx: MyContext, chat_id: number) {
        for (const t of supportedMediaTypes) {
            this.placeholders[t] ??= (await sendToTelegram(ctx, chat_id,
                new InputFile(() => createPlaceholder(t == 'video' ? 'mpeg' : 'mp3')), {
                type: t,
                temp_upload: true,
                disable_notification: true,
            }))[t]?.file_id;
        }
    }

    private updateCacheStatus(type: SMU, id: string) {
        const media = this.cache.get(id)!;
        this.cache.set(id, {
            ...media,
            isCached: media.isCached | { video: 2, audio: 1 }[type],
        });
    }

    private setFileId(type: SMU, id: string, file_id: string | null | undefined) {
        const media = this.cache.get(id)!;
        this.cache.set(id, {
            ...media,
            file: { ...media.file, [`${type}_id`]: file_id }
        });
    }

    private getCached(id: string, type: SMU = 'video', allowPlaceholder = false): Promise<string | undefined> {
        const media = this.cache.get(id);
        if (!media) throw new Error('CacheError');
        if (media.file && isCached(type, media)) {
            return Promise.resolve(media.file[`${type}_id`]!);
        }
        if (media.file?.[`${type}_id`] === null && !allowPlaceholder) {
            return new Promise((res, rej) => {
                media.progress.success(type, res);
                media.progress.error(type, rej);
            });
        }
        if (allowPlaceholder) {
            return Promise.resolve(this.placeholders[type]!);
        }
        return Promise.resolve(undefined);
    }

    private async cacheAndGet(ctx: MyContext, id: string, type: SMU = 'video', allowPlaceholder = false): Promise<string> {
        const file_id = await this.getCached(id, type, allowPlaceholder);
        if (file_id) return file_id;
        const msg = await this.send(ctx, id, ctx.from!.id, {
            disable_notification: true,
            temp_upload: true,
            type
        },);
        return msg[type]!.file_id;
    }
}

type MaybePromise<T> = T | Promise<T>;
async function sendToTelegram<T extends SMU = SMU>(ctx: MyContext, chat_id: number, file: MaybePromise<InputFile | string>, options: UploadFileOptions<T>) {
    const method = uploadMethod[options.type];
    const message: Message = await ctx.api[method](chat_id, await file, {
        ...options,
        supports_streaming: true
    });
    if (options.temp_upload) await ctx.api.deleteMessage(chat_id, message.message_id);
    return message;
}
