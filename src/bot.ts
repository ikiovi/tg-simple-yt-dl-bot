import 'dotenv/config';
import { Markup, Telegraf } from 'telegraf';
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';
import { shouldUpdate } from './exec';
import { youtubeUrlRegex, getYoutubeVideoInfo, bytesToHumanSize, sizeLimitBytes } from './utils';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Telegraf(token);

const getUpdateTime = () => new Date(Date.now() + process.env.CHECKUPDATESH * 60 * 60 * 1000);
let update_on = getUpdateTime();

bot.use((_, next) => {
    if (new Date() >= update_on) {
        checkForUpdates();
        update_on = getUpdateTime();
    }
    next();
});

bot.command('ping', ctx => ctx.reply('pong'));

bot.on('inline_query', async (ctx) => {
    const { query } = ctx.inlineQuery;
    if (!youtubeUrlRegex.test(query)) return;

    const response: InlineQueryResult[] = [];
    let cache = false;

    try {
        const { title, videoId: id, ownerChannelName, video_url, video_full_url, thumb_url, contentLength } = await getYoutubeVideoInfo(query);
        const { reply_markup } = Markup.inlineKeyboard([
            [Markup.button.url('View on Youtube', video_url)],
        ]);

        const size = bytesToHumanSize(contentLength);
        const isValidSize = contentLength < sizeLimitBytes;
        const invalidSizeMessage = [`The video size [${size}] is too large.`,
            'Due to Telegram API limits, this will most likely cause an error.'];

        const videoItem = {
            thumb_url,

            type: 'video',
            mime_type: 'video/mp4',

            video_url: video_full_url
        } as const;

        response.push({
            id,
            reply_markup,

            caption: `${title}\n${ownerChannelName}`,
            title: isValidSize ? title : invalidSizeMessage[0],
            description: isValidSize ? `${ownerChannelName}` : invalidSizeMessage[1],

            ...videoItem,
        });

        if (isValidSize) {
            response.push({
                id: id + '_nocaption',
                title: 'Without caption',
                description: size,

                ...videoItem,
            });
        }

        cache = true;
    }
    catch (err) {
        const { name, message, constructor } = (<Error>err);

        if (constructor.name != 'TypeError' && constructor.name != 'UnrecoverableError')
            checkForUpdates();

        response.push({
            id: 'error',
            title: `Error: ${constructor.name}`,
            type: 'article',
            description: message,

            input_message_content: {
                message_text: `${name}: <pre>${message}</pre>`,
                parse_mode: 'HTML'
            }
        });
    }

    return await ctx.answerInlineQuery(response, cache ? undefined : { cache_time: 0 });
});

bot.catch(err => {
    const date = new Date();
    const dateString = `\x1b[41m[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]\x1b[0m`;
    const { message, name } = <Error>err;
    console.error(dateString, `${name}: ${message}`);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function checkForUpdates() {
    shouldUpdate(() => {
        console.log('Start updating');
        process.exit(0);
    });
}