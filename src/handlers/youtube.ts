import { MyContext } from '../types/context';
import { InlineQueryContext } from 'grammy';
import { getResultsFromVideoInfo } from '../external/youtube/parsing';
import { getYoutubeVideoInfo, youtubeUrlRegex } from '../external/youtube/ytdl';
import { SwitchComposer } from '../types/composer';
import { getErrorResult } from '../utils/parsing';

export const youtubeHandler = new SwitchComposer<InlineQueryContext<MyContext>>(__filename);
const exceptions = new Set(['TypeError', 'UnrecoverableError', 'MinigetError']);

youtubeHandler.inlineQuery(youtubeUrlRegex, async ctx => {
    const { query } = ctx.inlineQuery;
    await getYoutubeVideoInfo(query)
        .then(getResultsFromVideoInfo)
        .then(ctx.answerInlineQuery.bind(ctx))
        .catch(async (err: Error) => {
            if (!exceptions.has(err.constructor.name)) throw err;
            const response = [];

            if ((<Record<string, unknown>><unknown>err).statusCode == 410)
                response.push(getErrorResult('Restricted', 'Video has restricted access'));
            else
                response.push(getErrorResult(err.name, err.message));

            return await ctx.answerInlineQuery(response, { cache_time: 0 });
        });
});

//TODO: Strict_Mode | Send placeholder video -> edit with video from yt