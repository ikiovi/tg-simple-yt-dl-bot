import 'dotenv/config';
import { Bot } from 'grammy';
import { MyContext } from './types';
import { limiter, updateChecker } from './middlewares';
import { InlineQueryResult } from 'grammy/out/types.node';
import { getResultsFromVideoInfo, getErrorResult } from './utils/inlineQuery';
import { youtubeUrlRegex } from './utils/ytdl';
import { checkForYtdlUpdate } from './utils/package';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Bot<MyContext>(token);

bot.command('ping', ctx => ctx.reply('pong')); // To check status of the bot
bot.use(limiter, updateChecker);

bot.inlineQuery(youtubeUrlRegex, ctx => {
    const { query } = ctx.inlineQuery;
    const response: InlineQueryResult[] = [];
    let cache = false;

    ctx.getYoutubeVideoInfo(query)
        .then(info => {
            response.push(...getResultsFromVideoInfo(info));
            cache = true;
        })
        .catch(err => {
            response.push(getErrorResult(err.name, err.message));
            if (err.constructor.name == 'TypeError' || err.constructor.name == 'UnrecoverableError') return;
            checkForYtdlUpdate();
        })
        .finally(async () => await ctx.answerInlineQuery(response, cache ? undefined : { cache_time: 0 }));
});

bot.catch(err => {
    const date = new Date();
    const dateString = `\x1b[41m[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]\x1b[0m`;
    console.error(dateString, `${err.name}: ${err.message}`);
});

bot.start();

process.once('SIGINT', bot.stop);
process.once('SIGTERM', bot.stop);