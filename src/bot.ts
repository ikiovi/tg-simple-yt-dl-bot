import 'dotenv/config';
import { Bot } from 'grammy';
import { MyContext } from './types/context';
import { youtubeHandler } from './handlers/youtube';
import { limit } from '@grammyjs/ratelimiter';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Bot<MyContext>(token);
console.log('Started!');

bot.use(limit({ limit: 2 }));
bot.command('ping', ctx => ctx.reply('pong')); // To check if bot is alive ¯\_(ツ)_/¯

//#region Register handlers
bot.on('inline_query').fork(youtubeHandler);
//#endregion

bot.catch(({ name, message }) => console.error(`\x1b[97m[${new Date().toLocaleString('uk')}] \x1b[41m${name}\x1b[0m | ${message}`));
bot.start({ drop_pending_updates: true, allowed_updates: ['inline_query', 'message', 'callback_query', 'chosen_inline_result'] });

process.once('SIGINT', bot.stop);