import 'dotenv/config';
import { Bot } from 'grammy';
import { MyContext } from './types/context';
import { youtubeHandler } from './handlers/youtube';
import { limit } from '@grammyjs/ratelimiter';
import { Roarr as log } from 'roarr';
import { serializeError } from 'serialize-error';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Bot<MyContext>(token);
log.debug('Started!');

bot.use(limit({ limit: 2 }));
bot.command('ping', ctx => ctx.reply('pong')); // To check if bot is alive ¯\_(ツ)_/¯

//#region Register handlers
bot.use(youtubeHandler);
//#endregion

bot.catch(err => log.error(serializeError(err.error), 'Something went wrong...'));
bot.start({
    drop_pending_updates: true,
    allowed_updates: ['inline_query', 'message', 'callback_query', 'chosen_inline_result']
});

process.once('SIGINT', bot.stop);