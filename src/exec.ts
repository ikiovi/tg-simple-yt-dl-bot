import { exec } from 'child_process';

const packageName = 'ytdl-core';

function execute(command: string, callback: (result: string) => void){
    exec(command, (_, stdout) => callback(stdout));
}

function shouldUpdate(onTrue: () => void){
    execute(`npm outdated ${packageName} --json`, result => {
        const json = JSON.parse(result)?.[packageName];
        if(!json) return;
        const { current, latest } = json;
        //console.log(json);

        if(current != latest)
            onTrue();
    });
}

export { packageName, execute, shouldUpdate };