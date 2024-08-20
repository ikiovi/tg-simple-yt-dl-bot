import { logger } from '../utils/logger';
import { isCached } from '../utils/ytmedia';
import { sequentialize } from '@grammyjs/runner';
import { SupportedMediaUploads as SMU } from '../types/file';
import { InlineKeyboard, InputMediaBuilder } from 'grammy';
import { getURLVideoID, validateURL } from '../external/youtube/api';
import { createRoute, queryFilter } from '../utils/routing';
import { getTimeRange, getYtTimestamps } from '../utils/timestamps';
import { InlineQueryResultCachedVideo } from 'grammy/types';

export const ytRoute = createRoute(queryFilter(q => {
    const entities = q.split(' ');
    return validateURL(entities[0] ?? '');
}));
const handler = ytRoute.handler;

handler.use(sequentialize(
    ({ msg, inlineQuery, chosenInlineResult }) => getURLVideoID(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? '')
));

handler.on(':text', async ctx => {
    const { text } = ctx.msg;
    const range = getYtTimestamps(text);
    const video = await ctx.ytdl.get(text, { range });
    if (video.isExceeds) {
        logger.info('Exceeds size limit', { url: video.sourceUrl });
        return ctx.reply('Video size exceeds telegram video limits');
    }
    if (video.category == 'Music' && ctx.chat.type === 'private') {
        await video.replyWith('audio', { title: video.title, performer: video.ownerChannelName });
    }
    return video.replyWith('video', undefined, ctx.chat.id);
});

//TODO: ytHandler.errorBoundary(...) (403: Forbidden: bot was blocked by the user) + handle age restricted / private video

handler.on('inline_query', async ctx => {
    const { query, from } = ctx.inlineQuery;
    const range = getTimeRange(query);
    const video = await ctx.ytdl.get(query, { range });

    if (video.isExceeds) {
        logger.info('Exceeds size limit', { url: video.sourceUrl });
        return await ctx.answerInlineQuery([{
            type: 'article',
            id: video.videoId + '_sl',
            title: 'Video size exceeds telegram video limits',
            input_message_content: {
                message_text: `Can't download ${video.sourceUrl}. Video size exceeds telegram video limits.`
            }
        }], { cache_time: 0 });
    }

    await ctx.ytdl.initPlaceholders(from.id);
    const loadingKeyboard = new InlineKeyboard().text('Loading...');
    const sourceKeyboard = new InlineKeyboard().url('Source', video.sourceUrl);
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
    } as InlineQueryResultCachedVideo;
    const videoNoCaptionResult = {
        ...videoResult,
        id: vId('video', '+nc'),
        title: 'No caption video',
        description: video.duration != video.originDuration ? `${video.duration - 1}s` : undefined,
        caption: undefined
    } as InlineQueryResultCachedVideo;

    await ctx.answerInlineQuery([videoResult, videoNoCaptionResult, audioResult], { cache_time: 0 });
});

handler.chosenInlineResult(/_v$/, async ctx => {
    const { inline_message_id, result_id, query } = ctx.chosenInlineResult;
    if (!inline_message_id) return logger.error('Unreachable');

    const range = getTimeRange(query);
    const video = await ctx.ytdl.get(query, { range });
    const reply_markup = new InlineKeyboard().url('Source', video.sourceUrl);
    const caption = result_id.includes('+nc') ? undefined : `${video.title}\n${video.ownerChannelName}`;

    let prev = 0;
    video.progress?.on(p => {
        const progress = Math.round(p / 25);
        if (progress == prev) return;
        ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('*** '.repeat(progress)) });
        prev = progress;
    });

    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.video(await video.getCached(), { caption }),
        { reply_markup }
    );
});

handler.chosenInlineResult(/_a$/, async ctx => {
    const { inline_message_id, query } = ctx.chosenInlineResult;
    if (!inline_message_id) return logger.error('Unreachable');

    const range = getTimeRange(query);
    const video = await ctx.ytdl.get(query, { range });

    const file_id = await video.getCached('audio');
    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.audio(file_id, { title: video.title, performer: video.ownerChannelName })
    );
});