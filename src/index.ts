import 'dotenv/config';
import { Markup, Telegraf } from "telegraf";
import { youtubeUrlRegex, getYoutubeVideoInfo } from './utils';
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';

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
    let cache = false;

    try {
        const { title, videoId: id, ownerChannelName, video_url, video_full_url, thumb_url } = await getYoutubeVideoInfo(query);
        const { reply_markup } = Markup.inlineKeyboard([
            [Markup.button.url('View on Youtube', video_url)],
            [Markup.button.url('Download video', video_full_url)]
        ]);

        const vItem = {
            thumb_url,
            
            type: 'video',
            mime_type: 'video/mp4',
            
            video_url: video_full_url
        } as const;

        response.push({
            id,
            title,
            description: ownerChannelName,
            reply_markup,
            caption: `${title}\n${ownerChannelName}`,
            ...vItem,
        });

        response.push({
            id: id + '_nocaption',
            title: 'Without caption',
            ...vItem,
        });
        
        cache = true;
    }
    catch (err) {
        const { name, message } = (<Error>err);
        response.push({
            id: 'error',
            title: 'Error',
            type: 'article',
            description: message,
            input_message_content: {
                message_text: `${name}: <code>${message}</code>`,
                parse_mode: 'HTML'
            }
        });
    }

    return await ctx.answerInlineQuery(response, cache ? undefined : { cache_time: 0 });
})

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));