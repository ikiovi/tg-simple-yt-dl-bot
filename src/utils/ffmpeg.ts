import { SpawnOptions, spawn } from 'child_process';
import { YoutubeMedia } from '../types/youtube';
import { readFile, unlink } from 'fs/promises';
import { Writable } from 'stream';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

const ffmpegGlobalArgs = ['-hide_banner', '-v', 'error'] as const;

export async function downloadAndMergeVideo(media: YoutubeMedia) {
    const { videoId, videoFormat, audioFormat, emitter } = media;
    const path = join(process.env.TEMP_DIR!, videoId);
    if (existsSync(path)) return readFile(path);
    const emitError = (err: Error) => emitter.emit('video:error', err);
    const [video, audio] = await Promise.all([videoFormat!.getReadable(emitError), audioFormat.getReadable(emitError)]);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-progress', '-',
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-map', '0:v',
        '-map', '1:a',
        '-f', process.env.VIDEO_CONTAINER ?? 'mp4',
        path
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: [
            // Standard: stdin, stdout, stderr 
            'inherit', 'pipe', 'inherit',
            'pipe', 'pipe'
        ]
    };

    const mergeStartTime = performance.now();
    media.progress.finished('video', () => {
        unlink(path);
        logger.debug(`Total v:${videoId} in ${(performance.now() - mergeStartTime) / 1000}`);
    });
    await new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
        ffmpeg.stdout?.on('data', data => {
            const outTime = (<string>data.toString('utf-8')).match(/out_time_ms=(\d+)/)?.[1];
            const outTimeS = +(outTime ?? 0) / 1000000;
            emitter?.emit('video:rawprogress', outTimeS);
        });
        video.pipe(ffmpeg.stdio[3]! as Writable);
        audio.pipe(ffmpeg.stdio[4]! as Writable);

    }).catch(r => {
        unlink(path);
        throw r;
    });
    logger.debug(`Merged ${videoId} in ${(performance.now() - mergeStartTime) / 1000}`);

    return readFile(path);
}

export async function downloadAudio(media: YoutubeMedia) {
    const { audioFormat, emitter, title, ownerChannelName } = media;
    const audio = await audioFormat.getReadable(err => emitter.emit('audio:error', err));

    const ffmpegArgs = [ //TODO: add cover
        ...ffmpegGlobalArgs,
        '-i', 'pipe:3',
        '-metadata', `title='${title.replaceAll('"', '')}'`,
        '-metadata', `artist='${ownerChannelName.replaceAll('"', '')}'`,
        '-f', 'mp3',
        '-'
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: [
            // Standard: stdin, stdout, stderr 
            'inherit', 'pipe', 'inherit',
            'pipe'
        ]
    };

    const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
    ffmpeg.on('error', e => emitter.emit('audio:error', e));
    audio.pipe(ffmpeg.stdio[3]! as Writable);

    return ffmpeg.stdout!;
}

export async function createPlaceholder(format: 'mp3' | 'mpeg') {
    const path = join(process.env.TEMP_DIR!, `placeholder.${format}`);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-f', 'lavfi',
        '-t', '5',
        '-i', 'color=c=black:s=640x480',
        '-f', 'lavfi',
        '-t', '5',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-metadata', 'title=Audio',
        '-f', format,
        path
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: ['inherit', 'inherit', 'inherit'],
    };

    await new Promise((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
    });

    return readFile(path).finally(() => unlink(path));
}