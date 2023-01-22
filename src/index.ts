import { packageName } from './utils/package';
import { checkForUpdate, createBot, updatePackage } from './exec';

const tryUpdateYtdl = () => checkForUpdate(packageName,
    () => updatePackage(packageName, startBot)
);

function startBot() {
    const bot_process = createBot();
    bot_process.once('exit', tryUpdateYtdl);
    process.once('SIGINT', bot_process.kill);
    process.once('SIGTERM', bot_process.kill);
}

startBot();