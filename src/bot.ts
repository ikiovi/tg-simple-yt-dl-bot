import 'dotenv/config';
import { Markup, MiddlewareFn, Telegraf } from 'telegraf';
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';
import { shouldUpdate } from './exec';
import { youtubeUrlRegex, getYoutubeVideoInfo, bytesToHumanSize, sizeLimitBytes } from './utils';
import Bottleneck from 'bottleneck';
import { MyContext } from './types';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Telegraf<MyContext>(token);
const limiter = {
    _limiter: new Bottleneck.Group({
        maxConcurrent: 2,
        minTime: +(process.env.RL_MINTIME_MS ?? 170),
        highWater: +(process.env.RL_MAXQUEUE ?? 3),
        strategy: Bottleneck.strategy.OVERFLOW
    }),
    middleware(): MiddlewareFn<MyContext> {
        return (ctx, next) => {
            ctx.limiter = this._limiter.key(`${ctx.chat?.id}`);
            next();
        };
    }
};

const getUpdateTime = () => new Date(Date.now() + +(process.env.CHECKUPDATESH ?? 20) * 60 * 60000);
const checkUpdates = () => shouldUpdate(() => process.exit(0));
let update_on = getUpdateTime();

bot.use(limiter.middleware());
bot.use((_, next) => {
    if (new Date() >= update_on) {
        checkUpdates();
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
    const getYtViewInfo = ctx.limiter.wrap(getYoutubeVideoInfo);

    try {
        const { title, contentLength, thumb_url, video_url,
            video_full_url, videoId: id, ownerChannelName } = await getYtViewInfo(query);
        const { reply_markup } = Markup.inlineKeyboard([
            Markup.button.url('View on Youtube', video_url)
        ]);

        const size = bytesToHumanSize(contentLength);
        const isValidSize = contentLength < sizeLimitBytes;
        const invalidSizeMessage = [`The video size [${size}] is too large.`,
            'Due to Telegram API limits, this will most likely cause an error.'];

        const videoItem = {
            type: 'video',
            mime_type: 'video/mp4',
            thumb_url,
            video_url: video_full_url,

            id: id + '_nocaption',
            title: 'Without caption',
            description: size
        } as const;

        response.push({
            ...videoItem,
            id,
            reply_markup,

            caption: `${title}\n${ownerChannelName}`,
            title: isValidSize ? title : invalidSizeMessage[0],
            description: isValidSize ? `${ownerChannelName}` : invalidSizeMessage[1],
        });

        if (isValidSize) response.push(videoItem);
        cache = true;
    }
    catch (err) {
        const { message, constructor } = (<Error>err);

        if (constructor.name != 'TypeError' && constructor.name != 'UnrecoverableError')
            checkUpdates();

        response.push({
            id: 'error',
            title: `Error: ${constructor.name}`,
            type: 'article',
            description: message,

            input_message_content: {
                message_text: `${constructor.name}: <pre>${message}</pre>`,
                parse_mode: 'HTML'
            }
        });
    }
    finally {
        await ctx.answerInlineQuery(response, cache ? undefined : { cache_time: 0 });
    }
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