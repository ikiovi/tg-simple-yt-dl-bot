import Bottleneck from 'bottleneck';
import { MiddlewareFn } from 'grammy';
import { MyContext } from './types';
import { checkForYtdlUpdate } from './utils/package';
import { getYoutubeVideoInfo } from './utils/ytdl';

export const limiter = {
    _limiter: new Bottleneck.Group({
        maxConcurrent: 2,
        minTime: +(process.env.RL_MINTIME_MS ?? 170),
        highWater: +(process.env.RL_MAXQUEUE ?? 3),
        strategy: Bottleneck.strategy.OVERFLOW
    }),
    middleware(): MiddlewareFn<MyContext> {
        return (ctx, next) => {
            ctx.limiter = this._limiter.key(`${ctx.chat?.id}`);
            ctx.getYoutubeVideoInfo = ctx.limiter.wrap(getYoutubeVideoInfo);
            next();
        };
    }
};

const getNextUpdateCheckTime = () => new Date(Date.now() + +(process.env.CHECKUPDATESH ?? 20) * 60 * 60000);
export const updateChecker = {
    next_update: getNextUpdateCheckTime(),
    middleware(): MiddlewareFn<MyContext> {
        return (_, next) => {
            if (new Date() < this.next_update) return next();
            checkForYtdlUpdate();
            this.next_update = getNextUpdateCheckTime();
        };
    }
};