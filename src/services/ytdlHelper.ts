import { SupportedMediaUploads as SMU, UploadFileOptions, supportedMediaTypes, uploadMethod } from '../types/file';
import { createPlaceholder, downloadAndMerge, downloadAudio } from '../utils/ffmpeg';
import { VideoOptions, getYoutubeVideoInfo } from '../external/youtube/api';
import { InputFile, MiddlewareFn, MiddlewareObj } from 'grammy';
import { YoutubeMedia, YoutubeVideo } from '../types/youtube';
import { events, isCached } from '../utils/ytmedia';
import { getVideoID } from '../utils/ytdl-core';
import { MyContext } from '../types/context';
import { hashObject } from '../utils/hash';
import { logger } from '../utils/logger';
import TTLCache from '@isaacs/ttlcache';
import { Message } from 'grammy/types';
import EventEmitter from 'events';
import { MusicEntity } from '../external/odesly/types';

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
                get: (...args) => this.get(ctx, ...args),
                initPlaceholders: c => this.initPlaceholders(ctx, c),
                getMusic: (...args) => this.getMusic(ctx, ...args)
            };
            return next();
        };
    }

    private async get(ctx: MyContext, video: string, videoOptions?: Partial<VideoOptions>, constructOptions?: Partial<MediaConstructorOptions>): Promise<YoutubeVideo> {
        const { overrideType, hashFunction } = constructOptions ?? {};
        const id = getVideoID(video);
        const uid = id + '#' + (hashFunction ?? hashObject)(videoOptions);
        const media = this.cache.get(uid);
        const chat_id = ctx.from!.id;

        if (media) return media;

        const { title, creator, thumbnail } = videoOptions ?? {};
        const info = await getYoutubeVideoInfo(id, videoOptions);
        const emitter = new EventEmitter();
        const newMedia: YoutubeMedia = {
            ...info,
            uid: uid,
            emitter,
            isCached: 0,
            title: title ?? info.title,
            ownerChannelName: creator ?? info.ownerChannelName,
            thumbnail: thumbnail ?? info.thumbnail,
            isExceeds: !info.simpleFormat && !info.videoFormat,
            progress: {
                success: (t, c) => emitter.once(`${overrideType ?? t}:${events.success}`, c),
                finished: (t, c) => emitter.once(`${overrideType ?? t}:${events.finish}`, c),
                error: (t, c) => emitter.once(`${overrideType ?? t}:${events.error}`, c),
                on: c => emitter.on(`video:${events.progress}`, c),
                once: c => emitter.once(`video:${events.progress}`, c)
            },
            getCached: (t, a) => this.cacheAndGet(ctx, uid, overrideType ?? t, a),
            downloadOrCached: async t => await this.getCached(uid, overrideType ?? t) ?? this.download(uid, overrideType ?? t),
            replyWith: (t, o, c) => this.send(ctx, uid, c ?? chat_id, { type: overrideType ?? t ?? 'video', ...o }),
        };
        this.cache.set(uid, newMedia);

        const onFinished = (t: SMU) => (f: string) => {
            this.updateCacheStatus(t, uid);
            this.setFileId(t, uid, f);
        };

        newMedia.progress.success('video', onFinished('video'));
        newMedia.progress.success('audio', onFinished('audio'));
        newMedia.progress.finished('video', () => emitter.removeAllListeners(`video:${events.progress}`));
        newMedia.emitter.on(`video:${events.rawprogress}`, s => {
            newMedia.emitter.emit(`video:${events.progress}`, (+s / +newMedia.originDuration) * 100);
        });

        return newMedia;
    }

    private getMusic(ctx: MyContext, audio: string, options?: Omit<MusicEntity, 'linksByPlatform'>) {
        return this.get(ctx, audio, {
            title: options?.title,
            creator: options?.artist,
            thumbnail: options?.cover
        }, {
            overrideType: 'audio',
            hashFunction: () => 'music'
        });
    }

    private async download(id: string, type: SMU = 'video'): Promise<InputFile> {
        const media = this.cache.get(id);
        if (!media) throw new Error('CacheError');
        if (type == 'audio') return new InputFile(() => downloadAudio(media));
        if (media.chooseSimple && media.simpleFormat) {
            const simpleFormat = media.simpleFormat!.getReadable(err => media.emitter.emit(`video:${events.error}`, err));
            return new InputFile(() => simpleFormat);
        }
        const file = await downloadAndMerge(media);
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

async function sendToTelegram<T extends SMU = SMU>(ctx: MyContext, chat_id: number, file: MaybePromise<InputFile | string>, options: UploadFileOptions<T>) {
    const method = uploadMethod[options.type];
    const message: Message = await ctx.api[method](chat_id, await file, {
        ...options,
        supports_streaming: true
    });
    if (options.temp_upload) await ctx.api.deleteMessage(chat_id, message.message_id);
    return message;
}

type MediaConstructorOptions = { overrideType: SMU, hashFunction: typeof hashObject }
type MaybePromise<T> = T | Promise<T>;