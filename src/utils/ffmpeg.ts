import { YoutubeMediaInfo } from '../external/youtube/types';
import { IOType, SpawnOptions, spawn } from 'child_process';
import { YoutubeMedia } from '../types/youtube';
import { readFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { events } from './ytmedia';
import { Writable } from 'stream';
import { logger } from './logger';
import { join } from 'path';

const ffmpegGlobalArgs = ['-hide_banner', '-v', 'error'];
if (process.env.FFMPEG_MAX_ALLOC_B) ffmpegGlobalArgs.push('-max_alloc', process.env.FFMPEG_MAX_ALLOC_B);
const getSpawnArgs = (...stdio: IOType[]) => (<SpawnOptions>{
    windowsHide: true,
    stdio: ['inherit', 'pipe', 'inherit', ...stdio]
});

export async function downloadAndMerge(media: YoutubeMedia) {
    const { uid, videoFormat, audioFormat, emitter, range } = media;
    const path = join(process.env.TEMP_DIR!, uid);
    const emitError = (err: Error) => emitter.emit(`video:${events.error}`, err);
    const [video, audio] = await Promise.all([videoFormat!.getReadable(emitError), audioFormat.getReadable(emitError)]);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-progress', '-',
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        ...(!range ? [] : getTimestampArgs(range)),
        '-map', '0:v',
        '-map', '1:a',
        '-c', 'copy',
        '-f', 'mp4',
        path + (range ? '_rc' : '')
    ];

    const mergeStartTime = performance.now();
    media.progress.success('video', () => {
        logger.debug(`Total v:${uid} in ${(performance.now() - mergeStartTime) / 1000}`);
    });
    media.progress.finished('video', () => {
        unlink(path + '_rc').catch(() => { });
        unlink(path).catch(() => { });
    });
    const onError = (err: Error) => {
        emitError(err);
        throw err;
    };
    const onProgress = (data: Buffer) => {
        const outTime = (<string>data.toString('utf-8')).match(/out_time_ms=(\d+)/)?.[1];
        const outTimeS = (+(outTime ?? 0) / 1000000);
        emitter?.emit(`video:${events.rawprogress}`, outTimeS);
    };
    await new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, getSpawnArgs('pipe', 'pipe'));
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
        ffmpeg.stdout?.on('data', onProgress);
        video.pipe(ffmpeg.stdio[3]! as Writable);
        audio.pipe(ffmpeg.stdio[4]! as Writable);

    }).catch(onError);
    if (range) await trimPrecise(path, { format: 'mp4', timeRange: range }).catch(onError);
    logger.debug(`Merged ${uid} in ${(performance.now() - mergeStartTime) / 1000}`);

    return createReadStream(path).on('error', emitError);
}

export async function downloadAudio(media: YoutubeMedia) {
    const { videoId, audioFormat, emitter, title, ownerChannelName, thumbnail, range } = media;
    const path = join(process.env.TEMP_DIR!, videoId + '_audio');
    const emitError = (err: Error) => emitter.emit(`audio:${events.error}`, err);
    const audio = await audioFormat.getReadable(emitError);

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
        ...(!range ? [] : getTimestampArgs(range)),
        '-metadata', `title=${title}`,
        '-metadata', `artist=${ownerChannelName}`,
        '-f', 'mp3',
        path + (range ? '_rc' : '')
    ];

    media.progress.finished('audio', () => {
        if (range) unlink(path + '_rc').catch(() => { });
        unlink(path).catch(() => { });
    });
    const onError = (err: Error) => {
        emitError(err);
        throw err;
    };
    await new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, getSpawnArgs('pipe'));
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
        audio.pipe(ffmpeg.stdio[3]! as Writable);

    }).catch(onError);
    if (range) await trimPrecise(path, { format: 'mp3', timeRange: range }).catch(onError);

    return createReadStream(path).on('error', emitError);
}

function trimPrecise(target: string, options: { format: 'mp4' | 'mp3', timeRange: Required<YoutubeMediaInfo>['range'] }) {
    const { format, timeRange } = options;
    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-progress', '-',
        ...getTimestampArgs(timeRange, true),
        '-i', target + '_rc',
        '-c', 'copy',
        '-f', format,
        target
    ];

    return new Promise<number>((res, rej) => {
        const ffmpeg = spawn(process.env.FFMPEG_PATH!, ffmpegArgs, getSpawnArgs());
        ffmpeg.on('error', rej);
        ffmpeg.on('exit', res);
    });
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

function getTimestampArgs(timeRange: Required<YoutubeMediaInfo>['range'], precise = false, padding = 3) {
    if (precise) return [
        ...(!timeRange.start ? [] : ['-ss', `${padding}`]),
        ...(!timeRange.end ? [] : ['-t', `${timeRange.end - (timeRange.start ?? 0)}`]),
    ];
    const start = (timeRange.start ?? 0) - padding;
    const end = (timeRange.end ?? 0) + padding;
    return [
        ...(start <= 0 ? [] : ['-ss', `${start}`]),
        ...(end == padding ? [] : ['-to', `${end}`])
    ];
}
