import { MyContext } from '../types/context';
import { getResultsFromVideoInfo } from '../external/youtube/parsing';
import { getYoutubeVideoInfo, youtubeUrlRegex } from '../external/youtube/ytdl';
import { SwitchComposer } from '../types/composer';
import { getErrorResult } from '../utils/parsing';
import { Composer } from 'grammy';

export const youtubeHandler = new Composer<MyContext>();
const exceptions = new Set(['TypeError', 'UnrecoverableError', 'MinigetError']);
const safeHandler = new SwitchComposer<MyContext>(__filename);

youtubeHandler.filter(({ inlineQuery, chosenInlineResult }) =>
    youtubeUrlRegex.test(inlineQuery?.query ?? chosenInlineResult?.query ?? ''), safeHandler
);

safeHandler.on('inline_query', async ctx => {
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

//TODO
// safeHandler.on('chosen_inline_result', ctx => {
//
// });


//TODO: Strict_Mode | Send placeholder video -> edit with video from yt