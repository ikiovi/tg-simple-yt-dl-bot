import { resolve } from 'path';
import EventEmitter from 'events';
import { readFileSync } from 'fs';
import { fork } from 'child_process';
import { updatePackage } from './update/package';
import { ManagedHandlerInfo } from './types/handler';
import { AppEvent, AppMessage } from './types/messages';

const mainPath = process.argv[2];
const bot = fork(mainPath, { stdio: 'inherit' }); // Will throw if path is invalid
const handlers = readHandlersMetadata();

const emitter = new EventEmitter();
const loop = setInterval(checkForUpdates, 60 * 60 * 10000); // From .env ?
const on = (event: AppEvent, callback: (msg: AppMessage) => void) => emitter.on(event, callback);
const emit = (msg: AppMessage) => bot.send(msg);
bot.on('message', (msg: AppMessage) => emitter.emit(msg.type, msg));

on('ERR', async ({ id }) => {
    const handler = handlers.get(id);
    if (!handler) return;
    handler.failureCounter++;
    handler.isClosed = true;
    await tryOpenHandler(id, handler);
});

process.on('SIGINT', () => {
    bot.kill('SIGINT');
    clearInterval(loop);
});

function readHandlersMetadata() {
    const json = readFileSync(resolve(process.env.npm_package_config_handlersInfo ?? 'unstable.json'), 'utf-8');
    const metadata: Record<string, string[] | 0> = JSON.parse(json);
    const result = new Map<string, ManagedHandlerInfo>();
    for (const handler in metadata) {
        const dependencies = metadata[handler];
        result.set(handler, {
            failureCounter: 0,
            isClosed: false,
            ...Array.isArray(dependencies) ? { dependencies } : {}
        });
    }
    return result;
}

async function checkForUpdates() {
    for (const [id, handler] of handlers) {
        if (!handler.isClosed) continue;
        await tryOpenHandler(id, handler);
    }
}

function tryOpenHandler(id: string, handler: ManagedHandlerInfo) {
    return tryUpdateDependencies(handler)
        .then(result => result ?
            handler.isClosed = emit({ id: id, type: 'OPEN' }) : false);
}

async function tryUpdateDependencies(handler: ManagedHandlerInfo) {
    if (!handler.dependencies) return false;
    const updates = await Promise.all(handler.dependencies.map(updatePackage));
    return updates.includes(true);
}