import { SpawnOptions, spawn } from 'child_process';

export async function getDownloadUrls(url: string, ids: number[]): Promise<string[]> {
    if (!process.env.ALLOW_YTDLP_FALLBACK) return Array.from({ length: ids.length });
    const spawnArgs: SpawnOptions = {
        windowsHide: true
    };
    return new Promise((res, rej) => {
        let data = '';
        const ytdlp = spawn(process.env.YTDLP_PATH!, ['-f', ids.join(','), '--get-url', url], spawnArgs);
        ytdlp.stdout!.on('data', m => data += m);
        ytdlp.on('error', rej);
        ytdlp.on('close', (c) => {
            if (c !== 0) return;
            res(data.split(';').slice(1));
        });
    });
}