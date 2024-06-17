import ytdl from 'ytdl-core';
import { logger } from '../utils/logger';
import { isCached } from '../utils/ytmedia';
import { MyContext } from '../types/context';
import { sequentialize } from '@grammyjs/runner';
import { SupportedMediaUploads as SMU } from '../types/file';
import { Composer, InlineKeyboard, InputMediaBuilder } from 'grammy';

export const ytdlHandler = new Composer<MyContext>();

ytdlHandler.drop(
    ({ msg, inlineQuery, chosenInlineResult }) => ytdl.validateURL(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? ''),
    () => { } //? Send message / inlineQueryResult that query is not youtube link ?
);

ytdlHandler.use(sequentialize(
    ({ msg, inlineQuery, chosenInlineResult }) => ytdl.getURLVideoID(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? '')
));

ytdlHandler.on(':text', async ctx => {
    const video = await ctx.ytdl.get(ctx.msg.text);
    if (video.isExceeds) {
        logger.info('Exceeds size limit', { url: video.source_url });
        return ctx.reply('Video size exceeds telegram video limits');
    }
    if (video.category == 'Music') {
        await video.replyWith('audio', { title: video.title, performer: video.ownerChannelName });
    }
    return video.replyWith('video');
});

ytdlHandler.on('inline_query', async ctx => {
    const { query, from } = ctx.inlineQuery;
    const video = await ctx.ytdl.get(query);

    if (video.isExceeds) {
        logger.info('Exceeds size limit', { url: video.source_url });
        return await ctx.answerInlineQuery([{
            type: 'article',
            id: video.videoId + '_sl',
            title: 'Video size exceeds telegram video limits',
            input_message_content: {
                message_text: `Can't download ${video.source_url}. Video size exceeds telegram video limits.`
            }
        }], { cache_time: 0 });
    }

    await ctx.ytdl.initPlaceholders(from.id);
    const loadingKeyboard = new InlineKeyboard().text('Loading...');
    const sourceKeyboard = new InlineKeyboard().url('Source', video.source_url);
    const vId = (t: SMU, args?: string) => `${video.videoId}${args ?? ''}_${t[0]}${isCached(t, video) || ''}`;

    const audioResult = {
        type: 'audio',
        title: video.title,
        id: vId('audio'),
        performer: video.ownerChannelName,
        audio_file_id: await video.getCached('audio', true),
        reply_markup: isCached('audio', video) ? undefined : loadingKeyboard
    } as const;
    const videoResult = {
        ...audioResult,
        type: 'video',
        id: vId('video'),
        caption: `${video.title}\n${video.ownerChannelName}`,
        video_file_id: await video.getCached('video', true),
        reply_markup: isCached('video', video) ? sourceKeyboard : loadingKeyboard
    } as const;
    const videoNoCaptionResult = {
        ...videoResult,
        id: vId('video', '+nc'),
        title: 'No caption video',
        caption: undefined
    } as const;

    await ctx.answerInlineQuery([videoResult, videoNoCaptionResult, audioResult], { cache_time: 0 });
});

ytdlHandler.chosenInlineResult(/_v$/, async ctx => {
    const { inline_message_id, result_id, query } = ctx.chosenInlineResult;
    const video = await ctx.ytdl.get(query);
    if (!inline_message_id) return logger.error('Unreachable');

    let prev = 0;
    video.progress?.on('video', p => {
        const progress = Math.round(p / 25);
        if (progress == prev) return;
        ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('*** '.repeat(progress)) });
        prev = progress;
    });
    const caption = result_id.includes('+nc') ? undefined : `${video.title}\n${video.ownerChannelName}`;
    const file_id = await video.getCached();
    const reply_markup = new InlineKeyboard().url('Source', video.source_url);
    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.video(file_id, { caption }),
        { reply_markup }
    );
});

ytdlHandler.chosenInlineResult(/_a$/, async ctx => {
    const { inline_message_id, query } = ctx.chosenInlineResult;
    const video = await ctx.ytdl.get(query);
    if (!inline_message_id) return logger.error('Unreachable');

    const file_id = await video.getCached('audio');
    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.audio(file_id, { title: video.title, performer: video.ownerChannelName })
    );
});