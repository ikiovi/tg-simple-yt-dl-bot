import { InlineKeyboard, InputMediaBuilder } from 'grammy';
import { getLinks } from '../external/odesly/api';
import { createRoute, queryFilter } from '../utils/routing';
import { isCached } from '../utils/ytmedia';
import { logger } from '../utils/logger';

const allowedHosts = new Set([
    'open.spotify.com',
    'music.youtube.com',
    'music.yandex.ru',
    'soundcloud.com'
]);

export const musicRoute = createRoute(queryFilter(
    query => {
        const q = query.trim();
        if (!URL.canParse(q)) return false;
        const { hostname } = new URL(q);
        return allowedHosts.has(hostname);
    }
));
const { handler } = musicRoute;

handler.on(':text', async ctx => {
    const audio = await getLinks(ctx.msg.text);
    if (!audio) return ctx.reply('Failed to get track info');
    const ytUrl = (audio?.linksByPlatform.youtube ?? audio?.linksByPlatform.youtubeMusic)?.url;
    if (!ytUrl) return ctx.reply('Looks like this track is not available on YouTube');
    const media = await ctx.ytdl.getMusic(ytUrl, audio);
    await media.replyWith('audio', {
        parse_mode: 'HTML',
        caption: getCaption(media.videoId, ctx.msg.text)
    }, ctx.chat.id);
});

handler.on('inline_query', async ctx => {
    const { query, from } = ctx.inlineQuery;
    const audio = await getLinks(query);
    if (!audio) throw new Error('Failed to get track info');
    const ytUrl = (audio?.linksByPlatform.youtube ?? audio?.linksByPlatform.youtubeMusic)?.url;
    if (!ytUrl) throw new Error('Looks like this track is not available on YouTube');
    const media = await ctx.ytdl.getMusic(ytUrl, audio);
    const cached = isCached('audio', media);

    await ctx.ytdl.initPlaceholders(from.id);
    await ctx.answerInlineQuery([{
        type: 'audio',
        title: media.title,
        id: media.videoId + (cached ? '' : '_ax'),
        performer: media.ownerChannelName,
        audio_file_id: await media.getCached('audio', true),
        reply_markup: cached ? undefined : new InlineKeyboard().text('Loading...'),
        parse_mode: 'HTML',
        caption: getCaption(media.videoId, query)
    }], { cache_time: 0 });
});

handler.chosenInlineResult(/_ax$/, async ctx => {
    const { inline_message_id, result_id, query } = ctx.chosenInlineResult;
    if (!inline_message_id) return logger.error('Unreachable');

    const videoId = result_id.slice(0, -3);
    const media = await ctx.ytdl.getMusic(videoId);

    const file_id = await media.getCached();
    await ctx.api.editMessageMediaInline(
        inline_message_id,
        InputMediaBuilder.audio(file_id, {
            title: media.title,
            performer: media.ownerChannelName,
            parse_mode: 'HTML',
            caption: getCaption(videoId, query)
        })
    );
});

function htmlLink(url: string, text: string) {
    return `<a href="${url}">${text}</a>`;
}

function getCaption(videoId: string, query: string) {
    return htmlLink('https://song.link/y/' + videoId, 'song.link') + ' | ' +
        htmlLink(query, 'from');
}