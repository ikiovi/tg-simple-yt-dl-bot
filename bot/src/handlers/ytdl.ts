import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';
import { MyContext } from '../types/context';
import { downloadSpecificFormat, getYoutubeVideoInfo } from '../external/youtube/api';
import { InputMediaAudio, InputMediaVideo, Message } from 'grammy/types';
import { Composer, InlineKeyboard, InputFile, InputMediaBuilder } from 'grammy';
import { logger } from '../utils/logger';
import { YoutubeMediaInfo } from '../external/youtube/types';

const placeholders: string[] = [];
const mediaMessageOptions = { disable_notification: true, supports_streaming: true } as const;

export const ytdlHandler = new Composer<MyContext>();

ytdlHandler.drop(
    ({ msg, inlineQuery, chosenInlineResult }) => ytdl.validateURL(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? ''),
    () => { } //? Send message / inlineQueryResult that query is not youtube link ?
);

ytdlHandler.on(':text', async ctx => {
    const info = await getYoutubeVideoInfo(ctx.msg.text);
    const { source_url: url, simpleFormat, videoFormat, audioFormat, chooseSimple } = info;
    const opts = { supports_streaming: true } as const;

    if (!simpleFormat && !videoFormat) {
        logger.info('Exceeds size limit', { url: info.source_url });
        return await ctx.reply('Video size exceeds telegram video limits');
    }
    if (chooseSimple) {
        logger.debug('Video has a HQ format with audio', { url, simpleQuality: simpleFormat!.quality });
        return await ctx.replyWithVideo(new InputFile(downloadSpecificFormat(url, info.simpleFormat!)), opts);
    }
    const audio = downloadSpecificFormat(url, audioFormat);
    if (info.category == 'Music') await ctx.replyWithAudio(new InputFile(audio), { title: info.title, performer: info.ownerChannelName });

    const video = mergeVideo(url, videoFormat!.itag, audioFormat.itag, ['-t', info.duration]);
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
    const opts = { cache_time: 0 };
    const video = {
        ...audio,
        type: 'video',
        id: info.videoId + '_v',
        caption: `${info.title}\n${info.ownerChannelName}`,
        thumbnail_url: info.thumbnail_url,
    } as const;

    if (!URL.canParse(process.env.GIF_GENERATOR_ADDRESS ?? '')) {
        return await ctx.answerInlineQuery([{
            ...video,
            video_file_id: placeholders[0],
        }, audio], opts);
    }

    const url = new URL(process.env.GIF_GENERATOR_ADDRESS!);
    url.searchParams.set('a', info.thumbnail_url);

    await ctx.answerInlineQuery([{
        ...video,
        mime_type: 'video/mp4',
        video_url: url.toString(),
    }, audio], opts);
});

ytdlHandler.on('chosen_inline_result', async (ctx, next) => {
    if (!ctx.session.lastVideo) return logger.error('Unreachable');
    await next();
});

ytdlHandler.chosenInlineResult(/_v$/, async ctx => {
    const { from: { id: chat_id }, inline_message_id } = ctx.chosenInlineResult;
    const { chooseSimple, simpleFormat, videoFormat, audioFormat,
        duration, source_url: url, title, ownerChannelName } = ctx.session.lastVideo!;

    if (!inline_message_id) return logger.error('Unreachable');

    const video = chooseSimple ?
        downloadSpecificFormat(url, simpleFormat) :
        mergeVideo(url, videoFormat.itag, audioFormat.itag, ['-t', duration]);

    const file_id = await uploadToTelegram(ctx, chat_id, { type: 'video', data: video });
    await ctx.api.editMessageMediaInline(inline_message_id, InputMediaBuilder.video(file_id, { caption: `${title}\n${ownerChannelName}` }));
});
ytdlHandler.chosenInlineResult(/_a$/, async ctx => {
    const { from: { id: chat_id }, inline_message_id } = ctx.chosenInlineResult;
    const { audioFormat, title, ownerChannelName, source_url: url } = ctx.session.lastVideo!;

    if (!inline_message_id) return logger.error('Unreachable');

    const audio = downloadSpecificFormat(url, audioFormat);
    const file_id = await uploadToTelegram(ctx, chat_id, { type: 'audio', data: audio, title, performer: ownerChannelName });

    await ctx.api.editMessageMediaInline(inline_message_id, InputMediaBuilder.audio(file_id));
});

function mergeVideo(url: string, videoItag: number, audioItag: number, flags: string[] = []) {
    const video = downloadSpecificFormat(url, videoItag);
    const audio = downloadSpecificFormat(url, audioItag);

    const ffmpeg = spawn(process.env.FFMPEG_PATH!, [
        '-hide_banner',
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        '-c:v', 'copy',
        '-lossless', '1',
        '-c:a', 'copy',
        ...flags,
        '-map', '0:v',
        '-map', '1:a',
        '-f', 'webm',
        'pipe:1'
    ], {
        windowsHide: true,
        stdio: [
            // Standard: stdin, stdout, stderr 
            'inherit', 'pipe', 'inherit',
            'pipe', 'pipe',
        ],
    });

    video.pipe(ffmpeg.stdio[3]! as Writable);
    audio.pipe(ffmpeg.stdio[4]! as Writable);

    return ffmpeg.stdout!;
}

function createPlaceholder(format: 'mp3' | 'mpeg') {
    const ffmpeg = spawn(process.env.FFMPEG_PATH!, [
        '-hide_banner',
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
        'pipe:1'
    ], {
        windowsHide: true,
        stdio: ['inherit', 'pipe', 'inherit'],
    });
    return ffmpeg.stdout!;
}

type UploadFile<T extends 'audio' | 'video'> = {
    type: T, data: Readable
} & Omit<T extends 'audio' ? InputMediaAudio : InputMediaVideo, 'media'>;

async function uploadToTelegram<T extends 'audio' | 'video'>(ctx: MyContext, chat_id: number, file: UploadFile<T>, removeAfter = true): Promise<string> {
    const method = 'send' + file.type[0].toUpperCase() + file.type.substring(1) as T extends 'video' ? 'sendVideo' : 'sendAudio';
    const message: Message = await ctx.api[method](chat_id, new InputFile(file.data), { ...file, ...mediaMessageOptions });
    if (removeAfter) await ctx.api.deleteMessage(chat_id, message.message_id);
    return message[file.type]!.file_id;
}

async function initPlaceholders(ctx: MyContext, chat_id: number) {
    placeholders[0] ??= await uploadToTelegram(ctx, chat_id, { data: createPlaceholder('mpeg'), type: 'video' });
    placeholders[1] ??= await uploadToTelegram(ctx, chat_id, { data: createPlaceholder('mp3'), type: 'audio' });
}