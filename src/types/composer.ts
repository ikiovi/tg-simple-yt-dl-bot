import { parse } from 'path';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { AppEvent, AppMessage } from './messages';
import { getUnavalableResult } from '../utils/parsing';
import { BotError, Composer, Context, GrammyError, Middleware, NextFunction } from 'grammy';
import { Roarr as logger } from 'roarr';
import { serializeError } from 'serialize-error';
import { JsonObject, Logger } from 'roarr/dist/types';

const emitter = new EventEmitter();
const emit = (msg: AppMessage) => process.send?.(msg);
const on = (event: AppEvent, id: string, callback: (...args: unknown[]) => void) => emitter.on(`${event}:${id}`, callback);
process.on('message', (msg: AppMessage) => emitter.emit(`${msg.type}:${msg.id}`, msg.value));

export class SwitchComposer<C extends Context = Context> extends Composer<C>{
    private _isClosed = false;
    private _composer: Composer<C> = new Composer<C>();
    private readonly id: string;
    private log: Logger<JsonObject>;

    constructor(file: string, ...middleware: Array<Middleware<C>>) {
        super(...middleware);
        if (!file) throw new Error('A');
        this.id = createHash('md5').update(parse(file).name).digest('hex');
        this.log = logger.child({ id: this.id, path: file });
        on('OPEN', this.id, this.open.bind(this));
        this.init();
    }

    private init() {
        this._composer.filter(() => this._isClosed)
            .on('inline_query', async ctx => await ctx.answerInlineQuery([getUnavalableResult(this.id)], { cache_time: 0 }));
        this._composer.errorBoundary(this.handleError.bind(this)).lazy(() => super.middleware());
    }

    open() {
        this._isClosed = false;
    }

    close() {
        this._isClosed = true;
    }

    override middleware() {
        return this._composer.middleware();
    }

    private async handleError(err: BotError, next: NextFunction) {
        if (err?.error instanceof GrammyError) return;
        this.close();
        this.log.error(serializeError(err.error), 'Closing handler...');

        emit({ id: this.id, type: 'ERR', value: err });
        await next();
    }
}