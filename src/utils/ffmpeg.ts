import { SpawnOptions, spawn } from 'child_process';
import { YoutubeMedia } from '../types/youtube';
import { readFile, unlink } from 'fs/promises';
import { Writable } from 'stream';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';
import { events } from './ytmedia';

const ffmpegGlobalArgs = ['-hide_banner', '-v', 'error'] as const;

export async function downloadAndMergeVideo(media: YoutubeMedia) {
    const { videoId, videoFormat, audioFormat, emitter } = media;
    const path = join(process.env.TEMP_DIR!, videoId);
    if (existsSync(path)) return readFile(path);
    const emitError = (err: Error) => emitter.emit(`video:${events.error}`, err);
    const [video, audio] = await Promise.all([videoFormat!.getReadable(emitError), audioFormat.getReadable(emitError)]);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-progress', '-',
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        '-map', '0:v',
        '-map', '1:a',
        '-c', 'copy',
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
    media.progress.success('video', () => {
        logger.debug(`Total v:${videoId} in ${(performance.now() - mergeStartTime) / 1000}`);
    });
    media.progress.finished('video', () => unlink(path));
    await new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
        ffmpeg.stdout?.on('data', data => {
            const outTime = (<string>data.toString('utf-8')).match(/out_time_ms=(\d+)/)?.[1];
            const outTimeS = +(outTime ?? 0) / 1000000;
            emitter?.emit(`video:${events.rawprogress}`, outTimeS);
        });
        video.pipe(ffmpeg.stdio[3]! as Writable);
        audio.pipe(ffmpeg.stdio[4]! as Writable);

    }).catch(err => {
        emitter.emit(`video:${events.error}`, err);
        throw err;
    });
    logger.debug(`Merged ${videoId} in ${(performance.now() - mergeStartTime) / 1000}`);

    return readFile(path);
}

export async function downloadAudio(media: YoutubeMedia) {
    const { videoId, audioFormat, emitter, title, ownerChannelName, thumbnail } = media;
    const path = join(process.env.TEMP_DIR!, videoId + '_audio');
    const audio = await audioFormat.getReadable(err => emitter.emit(`audio:${events.error}`, err));

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-i', 'pipe:3',
        ...(thumbnail ? [
            '-i', thumbnail,
            '-map', '0:a',
            '-map', '1:0',
            '-id3v2_version', '3',
            '-metadata:s:v', 'title=Album cover',
            '-metadata:s:v', 'comment=Cover (front)',
        ] : []),
        '-metadata', `title=${title}`,
        '-metadata', `artist=${ownerChannelName}`,
        '-f', 'mp3',
        path
    ];
    const spawnArgs: SpawnOptions = {
        windowsHide: true,
        stdio: [
            // Standard: stdin, stdout, stderr 
            'inherit', 'pipe', 'inherit',
            'pipe'
        ]
    };

    media.progress.finished('audio', () => unlink(path));
    await new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, spawnArgs);
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
        audio.pipe(ffmpeg.stdio[3]! as Writable);

    }).catch(err => {
        emitter.emit(`audio:${events.error}`, err);
        throw err;
    });

    return readFile(path);
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