import { SupportedMediaUploads as SMU, UploadFileOptions, supportedMediaTypes, uploadMethod } from '../types/file';
import { createPlaceholder, downloadAndMergeVideo, downloadAudio } from '../utils/ffmpeg';
import { downloadSpecificFormat, getYoutubeVideoInfo } from '../external/youtube/api';
import { InputFile, MiddlewareFn, MiddlewareObj } from 'grammy';
import { YoutubeMedia, YoutubeVideo } from '../types/youtube';
import { MyContext } from '../types/context';
import { isCached } from '../utils/ytmedia';
import { getURLVideoID } from 'ytdl-core';
import TTLCache from '@isaacs/ttlcache';
import { Message } from 'grammy/types';
import EventEmitter from 'events';

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
                finished: (t, c) => emitter.once(`${t}:finished`, c),
                error: (t, c) => emitter.once(`${t}:error`, c),
                on: c => emitter.on('video:progress', c),
                once: c => emitter.once('video:progress', c)
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

        newMedia.progress.finished('video', onFinished('video'));
        newMedia.progress.finished('audio', onFinished('audio'));
        newMedia.emitter.on('video:rawprogress', s => {
            newMedia.emitter.emit('video:progress', (+s / +newMedia.duration) * 100);
        });

        return newMedia;
    }

    private download(id: string, type: SMU = 'video'): InputFile {
        const info = this.cache.get(id);
        if (!info) throw new Error('CacheError');
        if (info.isExceeds) throw new Error('No');
        if (type == 'audio') return new InputFile(() => downloadAudio(info));
        if (info.chooseSimple && info.simpleFormat) return new InputFile(() => downloadSpecificFormat(info.source_url, info.simpleFormat!));
        return new InputFile(() => downloadAndMergeVideo(info));
    }

    private async send(ctx: MyContext, id: string, chat_id: number, options: UploadFileOptions<SMU>,) {
        const { type } = options;
        const media = this.cache.get(id);
        if (!media) throw new Error('CacheError');
        const cached = await this.getCached(id, type);
        const task = sendToTelegram(ctx, chat_id, cached ?? this.download(id, type), options);
        if (cached) return task;

        this.setFileId(type, id, null); // Indicates that file is already being uploaded
        return task.then(msg => {
            media?.emitter.emit(`${type}:finished`, msg[type]!.file_id);
            return msg;
        }).catch(r => {
            this.setFileId(type, id, undefined);
            throw r;
        });
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
                media.progress.finished(type, res);
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

async function sendToTelegram<T extends SMU = SMU>(ctx: MyContext, chat_id: number, file: InputFile | string, options: UploadFileOptions<T>) {
    const method = uploadMethod[options.type];
    const message: Message = await ctx.api[method](chat_id, file, {
        ...options,
        supports_streaming: true
    });
    if (options.temp_upload) await ctx.api.deleteMessage(chat_id, message.message_id);
    return message;
}