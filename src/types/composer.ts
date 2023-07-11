import { parse } from 'path';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { AppEvent, AppMessage } from './messages';
import { getUnavalableResult } from '../utils/parsing';
import { BotError, Composer, Context, GrammyError, Middleware, NextFunction } from 'grammy';

const emitter = new EventEmitter();
const emit = (msg: AppMessage) => process.send?.(msg);
const on = (event: AppEvent, id: string, callback: (...args: unknown[]) => void) => emitter.on(`${event}:${id}`, callback);
process.on('message', (msg: AppMessage) => emitter.emit(`${msg.type}:${msg.id}`, msg.value));

export class SwitchComposer<C extends Context = Context> extends Composer<C>{
    private _isClosed = false;
    private readonly id: string;

    constructor(file: string, ...middleware: Array<Middleware<C>>) {
        super(...middleware);
        if (!file) throw new Error('A');
        this.id = createHash('md5').update(parse(file).name).digest('hex');
        on('OPEN', this.id, this.open.bind(this));
    }

    open() {
        this._isClosed = false;
    }

    close() {
        this._isClosed = true;
    }

    override middleware() {
        const c = new Composer<C>();
        c.filter(() => this._isClosed)
            .on('inline_query', async ctx => await ctx.answerInlineQuery([getUnavalableResult(this.id)], { cache_time: 0 }));
        c.errorBoundary(this.handleError.bind(this), super.middleware());
        return c.middleware();
    }

    private async handleError(err: BotError, next: NextFunction) {
        if (err?.error instanceof GrammyError) return; // if query is too old
        this.close();
        console.error(`\x1b[97m[${new Date().toLocaleString('uk')}] \x1b[43m${err?.error?.constructor.name ?? err.name}\x1b[0m | ${err.message}`);
        emit({ id: this.id, type: 'ERR', value: err });
        await next();
    }
}