import { Composer, Context } from 'grammy';
import { MyContext } from '../types/context';

type Route<T extends Context> = {
    name: string,
    filter: (ctx: T) => boolean,
    handler: Composer<T>
}
export function createRoute<T extends Context>(filter: Route<T>['filter'], name?: string): Route<T> {
    return {
        filter,
        name: name ?? getCallerFile() ?? '',
        handler: new Composer<T>()
    };
}

type RouteFuncParams<T extends Context> = Parameters<Composer<T>['route']>;
export function createRoutingSet<T extends Context>(...routes: Route<T>[]): { router: RouteFuncParams<T>[0], handlers: RouteFuncParams<T>[1] } {
    return {
        router: ctx => routes.find(({ filter }) => filter(ctx))?.name,
        handlers: routes.reduce<RouteFuncParams<T>[1]>((acc, r) => ({ ...acc, [r.name]: r.handler }), {})
    };
}

export function queryFilter(predicate: (query: string) => boolean) {
    return ({ msg, inlineQuery, chosenInlineResult }: MyContext) =>
        predicate(msg?.text ?? inlineQuery?.query ?? chosenInlineResult?.query ?? '');
}

function getCallerFile() {
    const originalFunc = Error.prepareStackTrace;

    let callerfile;
    try {
        const err = new Error() as unknown as { stack: NodeJS.CallSite[] };
        Error.prepareStackTrace = (_, stack) => stack;

        const currentfile = err.stack?.shift()?.getFileName();

        while (err.stack.length) {
            callerfile = err.stack?.shift()?.getFileName();
            if (currentfile !== callerfile) break;
        }
    } catch { } // eslint-disable-line

    Error.prepareStackTrace = originalFunc;
    return callerfile;
}