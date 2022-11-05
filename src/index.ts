import { ChildProcess, exec } from 'child_process';
import { execute, packageName, shouldUpdate } from './exec';

let bot_process : ChildProcess;

startBot();

function startBot(){
    bot_process = exec('npm run bot-start');

    bot_process.stdout?.on('data', console.log);
    bot_process.stderr?.on('data', console.error);

    bot_process.once('exit', () => {
        // console.log('Child exited');
        shouldUpdate(updateYtdl);
    });
}

function updateYtdl(){
    const delay = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));
    const delayS = (sec:number) => delay(sec * 1000);

    execute('npm update --save ' + packageName, async () => {
        console.log('Updated');
        await delayS(5);
        startBot();
    });
}

process.once('SIGINT', () => bot_process.kill('SIGINT'));
process.once('SIGTERM', () => bot_process.kill('SIGTERM'));