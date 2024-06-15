import 'dotenv/config';
import { Bot, Context, session } from 'grammy';
import { logger } from './utils/logger';
import { MyContext } from './types/context';
import { ytdlHandler } from './handlers/ytdl';
import { existsSync, mkdirSync } from 'fs';
import Bottleneck from 'bottleneck';
import { RunOptions, run, sequentialize } from '@grammyjs/runner';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');

const bot = new Bot<MyContext>(token);
const limiter = new Bottleneck({ maxConcurrent: 6, minTime: 2000 });
logger.debug('Started!');

process.env.TEMP_DIR ??= '/tmp';
if (!existsSync(process.env.TEMP_DIR)) {
    logger.info(`${process.env.TEMP_DIR} does not exist. Creating...`);
    mkdirSync(process.env.TEMP_DIR);
}

bot.command('ping', ctx => ctx.reply('pong')); // To check if bot is alive ¯\_(ツ)_/¯

const getSessionKey = (ctx: Context) => ctx.from?.id.toString();
bot.use(sequentialize(getSessionKey));
bot.use(session({ initial: () => ({}), getSessionKey }));
bot.use(async (ctx, next) => {
    ctx.limiter = limiter;
    await next();
});

//#region Register handlers
bot.use(ytdlHandler);
//#endregion
bot.catch(err => logger.error(err.error));

const fetch = { allowed_updates: ['inline_query', 'message', 'callback_query', 'chosen_inline_result'] };
const options = { runner: { fetch }, sink: {}, source: {} } as RunOptions<unknown>;
const runner = run(bot, options);

const stopRunner = () => runner.isRunning() && runner.stop();
process.once('SIGINT', stopRunner);
process.once('SIGTERM', stopRunner);