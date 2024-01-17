import 'dotenv/config';
import { Bot, session } from 'grammy';
import { MyContext } from './types/context';
import { ytdlHandler } from './handlers/ytdl';
import { logger } from './utils/logger';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Bot<MyContext>(token);
logger.debug('Started!');

bot.use(session({
    initial: () => ({}),
    getSessionKey: (ctx) => `${ctx.from?.id}`
}));
//TODO: RateLimit
bot.command('ping', ctx => ctx.reply('pong')); // To check if bot is alive ¯\_(ツ)_/¯

//#region Register handlers
bot.use(ytdlHandler);
//#endregion
bot.catch(err => logger.error(err.error));
bot.start({
    drop_pending_updates: true,
    allowed_updates: ['inline_query', 'message', 'callback_query', 'chosen_inline_result']
});

process.on('SIGINT', () => bot.stop());