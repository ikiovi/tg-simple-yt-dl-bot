import 'dotenv/config';
import { Markup, Telegraf } from "telegraf";
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';
import { youtubeUrlRegex, getYoutubeVideoInfo } from './utils';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!')

const bot = new Telegraf(token);

bot.catch(err => {
    const date = new Date();
    const dateString = `\x1b[41m[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]\x1b[0m`;
    const { message, name } = <Error>err;
    console.error(dateString, `${name}: ${message}`);
});


bot.on('inline_query', async (ctx) => {
    const { query } = ctx.inlineQuery;
    if (!youtubeUrlRegex.test(query)) return;

    const response: InlineQueryResult[] = [];
    let cache: boolean = false;

    try {
        const { title, videoId, ownerChannelName, video_url, full_video_url, thumbnail } = await getYoutubeVideoInfo(query);
        const { reply_markup } = Markup.inlineKeyboard([
            Markup.button.url('Source', video_url)
        ]);

        response.push({
            type: 'video',
            id: videoId,
            title,
            video_url: full_video_url,
            mime_type: 'video/mp4',
            thumb_url: thumbnail,
            caption: `${title}\n${ownerChannelName}`,
            description: ownerChannelName,
            reply_markup
        });
        cache = true;
    }
    catch (err) {
        const { message } = (<Error>err);
        response.push({
            type: 'article',
            id: 'error',
            title: 'Error',
            description: message,
            input_message_content: {
                message_text: message
            }
        });
    }

    return await ctx.answerInlineQuery(response, cache ? undefined : { cache_time: 0 });
})

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));