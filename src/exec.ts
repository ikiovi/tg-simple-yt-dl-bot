import { ChildProcess, exec } from 'child_process';

function execute(command: string, callback: (result: string) => void) {
    exec(command, (_, stdout) => callback(stdout));
}

function checkForUpdate(packageName: string, onUpdate: () => void) {
    console.log(`Checking for '${packageName}' update...`);
    execute(`npm outdated ${packageName} --json`, result => {
        try {
            const json = JSON.parse(result)?.[packageName];
            if (!json) return;
            const { current, latest } = json;

            if (current != latest) return onUpdate();
            console.log(`Package '${packageName}' is up-to-date`);
        }
        catch (err) {
            console.error(err);
        }
    });
}

function updatePackage(packageName: string, onUpdated: () => void) {
    const delayS = (sec: number) => new Promise(resolve => setTimeout(resolve, sec * 1000));

    execute('npm update --save ' + packageName, async () => {
        console.log(`[${new Date().toLocaleTimeString()}]: Package '${packageName}' updated`);
        await delayS(5);
        onUpdated();
    });
}

function createBot(): ChildProcess {
    const bot = exec('npm run bot-start');

    bot.stdout?.on('data', console.log);
    bot.stderr?.on('data', console.error);

    return bot;
}

export { updatePackage, checkForUpdate, createBot };