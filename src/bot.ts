import 'dotenv/config';
import { Bot, Context } from 'grammy';
import { logger } from './utils/logger';
import { MyContext } from './types/context';
import { ytdlHandler } from './handlers/ytdl';
import { existsSync, mkdirSync } from 'fs';
import { RunOptions, run, sequentialize } from '@grammyjs/runner';
import { YTDownloadHelper } from './services/ytdlHelper';

const token = process.env.TOKEN;
if (!token) throw new Error('TOKEN must be provided!');
if (!process.env.TEMP_DIR) throw new Error('TEMP_DIR must be provided!');
if (!process.env.FFMPEG_PATH) throw new Error('FFMPEG_PATH must be provided!');

const bot = new Bot<MyContext>(token);
const ytHelper = new YTDownloadHelper(
    +(process.env.CACHE_MAX_CAPACITY ?? 500),
    +(process.env.CACHE_TTL_M ?? 120) * 60 * 1000
);
logger.debug('Started!');

if (!existsSync(process.env.TEMP_DIR)) {
    logger.info(`${process.env.TEMP_DIR} does not exist. Creating...`);
    mkdirSync(process.env.TEMP_DIR);
}

bot.command('ping', ctx => ctx.reply('pong')); // To check if bot is alive ¯\_(ツ)_/¯
bot.use(sequentialize((ctx: Context) => ctx.from?.id.toString()));
bot.use(ytHelper);

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