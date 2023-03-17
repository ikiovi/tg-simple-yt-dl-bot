import { packageName } from './utils/package';
import { checkForUpdate, createBotProcess, updatePackage } from './exec';

const updateYtdl = () => updatePackage(packageName, startBot);
const tryUpdateYtdl = () => checkForUpdate(packageName, updateYtdl);

function startBot() {
    const bot = createBotProcess(process);
    bot.once('exit', tryUpdateYtdl);
}

startBot();