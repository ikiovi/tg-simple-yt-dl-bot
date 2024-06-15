import ytdl from 'ytdl-core';
import { logger } from '../utils/logger';
import { MyContext } from '../types/context';
import { downloadSpecificFormat, getYoutubeVideoInfo } from '../external/youtube/api';
import { InlineQueryResultCachedVideo, InlineQueryResultVideo, Message } from 'grammy/types';
import { Composer, InlineKeyboard, InputFile, InputMediaBuilder } from 'grammy';
import { YoutubeMediaInfo } from '../external/youtube/types';
import { UploadFile, uploadMethod } from '../types/file';
import { SpawnOptions, spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { Writable } from 'stream';
import { existsSync } from 'fs';
import { join } from 'path';

const placeholders: string[] = [];
const ffmpegGlobalArgs = ['-hide_banner', '-loglevel', 'error'] as const;

export const ytdlHandler = new Composer<MyContext>();

ytdlHandler.drop(
    ({ msg, inlineQuery, chosenInlineResult }) => ytdl.validateURL(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? ''),
    () => { } //? Send message / inlineQueryResult that query is not youtube link ?
);

ytdlHandler.on(':text', async ctx => {
    const info = await ctx.limiter.wrap(getYoutubeVideoInfo)(ctx.msg.text);
    const { videoId, source_url: url, simpleFormat, videoFormat, audioFormat, chooseSimple } = info;
    const opts = { supports_streaming: true, duration: +info.duration } as const;

    if (!simpleFormat && !videoFormat) {
        logger.info('Exceeds size limit', { url: info.source_url });
        return await ctx.reply('Video size exceeds telegram video limits');
    }
    if (chooseSimple) {
        logger.debug('Video has a HQ format with audio', { url, simpleQuality: simpleFormat!.quality });
        return await ctx.replyWithVideo(new InputFile(downloadSpecificFormat(url, info.simpleFormat!)), opts);
    }
    const audio = downloadSpecificFormat(url, audioFormat);
    if (info.category == 'Music') {
        await ctx.replyWithAudio(new InputFile(audio), { title: info.title, performer: info.ownerChannelName });
    }

    const video = await mergeVideo(url, videoFormat!.itag, audioFormat.itag, videoId + ctx.from?.id);
    await ctx.replyWithVideo(new InputFile(video), opts);
});

ytdlHandler.on('inline_query', async ctx => {
    const { query, from } = ctx.inlineQuery;
    const info = await getYoutubeVideoInfo(query);

    if (!info.simpleFormat && !info.videoFormat) {
        logger.info('Exceeds size limit', { url: info.source_url });
        return await ctx.answerInlineQuery([{
            type: 'article',
            id: info.videoId + '_sl',
            title: 'Video size exceeds telegram video limits',
            input_message_content: {
                message_text: `Can't download ${info.source_url}. Video size exceeds telegram video limits.`
            }
        }], { cache_time: 0 });
    }

    ctx.session.lastVideo = info as YoutubeMediaInfo<'Checked'>;

    await initPlaceholders(ctx, from.id);

    const audio = {
        type: 'audio',
        title: info.title,
        id: info.videoId + '_a',
        performer: info.ownerChannelName,
        audio_file_id: placeholders[1],
        reply_markup: new InlineKeyboard().text('Loading...')
    } as const;
    const video = {
        ...audio,
        type: 'video',
        id: info.videoId + '_v',
        caption: `${info.title}\n${info.ownerChannelName}`,
        thumbnail_url: info.thumbnail_url
    } as const;
    const videoNoCaption = {
        ...video,
        id: info.videoId + '_nocap_v',
        title: 'No caption video',
        caption: undefined
    } as const;

    await ctx.answerInlineQuery([
        getVideoInlineResult(video, info.thumbnail_url),
        getVideoInlineResult(videoNoCaption, info.thumbnail_url),
        audio
    ], { cache_time: 0 });
});

ytdlHandler.on('chosen_inline_result', async (ctx, next) => {
    if (!ctx.session.lastVideo) return logger.error('Unreachable');
    await ctx.limiter.wrap(next)();
});

ytdlHandler.chosenInlineResult(/_v$/, async ctx => {
    const { from: { id: chat_id }, inline_message_id } = ctx.chosenInlineResult;
    const { videoId, chooseSimple, simpleFormat, videoFormat, audioFormat,
        duration, source_url: url, title, ownerChannelName } = ctx.session.lastVideo!;

    if (!inline_message_id) return logger.error('Unreachable');
    const caption = ctx.chosenInlineResult.result_id?.includes('_nocap') ? undefined : `${title}\n${ownerChannelName}`;
    const video = chooseSimple ?
        downloadSpecificFormat(url, simpleFormat) :
        () => mergeVideo(url, videoFormat.itag, audioFormat.itag, videoId + chat_id);
    const file_id = await uploadToTelegram(ctx, chat_id, { type: 'video', data: video, duration: +duration });
    const reply_markup = new InlineKeyboard().url('Source', url);
    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.video(file_id, { caption }),
        { reply_markup }
    );
});

ytdlHandler.chosenInlineResult(/_a$/, async ctx => {
    const { from: { id: chat_id }, inline_message_id } = ctx.chosenInlineResult;
    const { audioFormat, title, ownerChannelName, source_url: url } = ctx.session.lastVideo!;

    if (!inline_message_id) return logger.error('Unreachable');

    const audio = downloadSpecificFormat(url, audioFormat);
    const file_id = await uploadToTelegram(ctx, chat_id, { type: 'audio', data: audio, title, performer: ownerChannelName });

    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.audio(file_id)
    );
});

async function mergeVideo(url: string, videoItag: number, audioItag: number, filename: string) {
    const video = downloadSpecificFormat(url, videoItag);
    const audio = downloadSpecificFormat(url, audioItag);

    const path = join(process.env.TEMP_DIR!, filename);
    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        '-c:v', 'copy',
        '-c:a', process.env.VIDEO_CONTAINER == 'webm' ? 'copy' : 'aac',
        '-map', '0:v',
        '-map', '1:a',
        '-f', process.env.VIDEO_CONTAINER ?? 'mp4',
        path
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: [
            // Standard: stdin, stdout, stderr 
            'inherit', 'inherit', 'inherit',
            'pipe', 'pipe'
        ]
    };

    if (!existsSync(path)) {
        await new Promise((res, rej) => {
            const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
            ffmpeg.on('error', rej);
            ffmpeg.on('exit', res);
            video.pipe(ffmpeg.stdio[3]! as Writable);
            audio.pipe(ffmpeg.stdio[4]! as Writable);
        })
    }

    return readFile(path).finally(() => unlink(path));
}

async function createPlaceholder(format: 'mp3' | 'mpeg') {
    const path = join(process.env.TEMP_DIR!, `placeholder.${format}`);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-f', 'lavfi',
        '-t', '5',
        '-i', 'color=c=black:s=640x480',
        '-f', 'lavfi',
        '-t', '5',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-metadata', 'title=Audio',
        '-f', format,
        path
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: ['inherit', 'inherit', 'inherit'],
    };

    await new Promise((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
    });

    return readFile(path).finally(() => unlink(path));
}

async function uploadToTelegram<T extends 'audio' | 'video'>(ctx: MyContext, chat_id: number, file: UploadFile<T>, removeAfter = true) {
    const method = uploadMethod[file.type];
    const message: Message = await ctx.api[method](
        chat_id,
        new InputFile(file.data),
        { ...file, disable_notification: true, supports_streaming: true }
    );
    if (removeAfter) await ctx.api.deleteMessage(chat_id, message.message_id);
    return message[file.type]!.file_id;
}

async function initPlaceholders(ctx: MyContext, chat_id: number) {
    placeholders[0] ??= await uploadToTelegram(ctx, chat_id, { data: () => createPlaceholder('mpeg'), type: 'video' });
    placeholders[1] ??= await uploadToTelegram(ctx, chat_id, { data: () => createPlaceholder('mp3'), type: 'audio' });
}

function getVideoInlineResult<T extends InlineQueryResultCachedVideo | InlineQueryResultVideo>(init: Partial<T>, thumbnail_url: string): T {
    if (!URL.canParse(process.env.GIF_GENERATOR_ADDRESS ?? '')) {
        return { ...init, video_file_id: placeholders[0] } as T;
    }

    const url = new URL(process.env.GIF_GENERATOR_ADDRESS!);
    url.searchParams.set('a', thumbnail_url);
    return {
        ...init,
        mime_type: 'video/mp4',
        video_url: url.toString()
    } as T;
}