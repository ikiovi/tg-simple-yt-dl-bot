import { promisify } from 'util';
import { exec } from 'child_process';

function outdated(packageName: string) {
    return new Promise<boolean>(
        (res, rej) => exec(`npm outdated ${packageName} --json`, (_, stdout) => {
            const json = JSON.parse(stdout)?.[packageName];
            if (!json) return rej(false);
            const { current, latest } = json;
            res(current != latest);
        })
    ).catch(() => false);
}

async function updatePackage(packageName: string) {
    if (!await outdated(packageName)) return false;

    await new Promise(r => setTimeout(r, 5 * 1000)); // Timeout
    await promisify(exec)('npm update --save ' + packageName);
    return true;
}

export { outdated, updatePackage };