import { downloadSpecificFormat } from '../external/youtube/api';
import { SpawnOptions, spawn } from 'child_process';
import { YoutubeMedia } from '../types/youtube';
import { readFile, unlink } from 'fs/promises';
import { Writable } from 'stream';
import { existsSync } from 'fs';
import { join } from 'path';

const ffmpegGlobalArgs = ['-hide_banner', '-v', 'error'] as const;

export async function downloadAndMergeVideo(media: YoutubeMedia) {
    const { videoId, source_url, videoFormat, audioFormat, emitter } = media;
    const path = join(process.env.TEMP_DIR!, videoId);
    if (existsSync(path)) return readFile(path);
    const video = downloadSpecificFormat(source_url, videoFormat!);
    const audio = downloadSpecificFormat(source_url, audioFormat);

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

    await new Promise((res, rej) => {
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
    });

    return readFile(path).finally(() => unlink(path));
}

export async function downloadAudio(media: YoutubeMedia) {
    const { source_url, audioFormat, emitter, title, ownerChannelName } = media;
    const audio = downloadSpecificFormat(source_url, audioFormat);

    const ffmpegArgs = [
        ...ffmpegGlobalArgs,
        '-i', 'pipe:3',
        '-metadata', `title="${title.replaceAll('"', '')}"`,
        '-metadata', `artist="${ownerChannelName.replaceAll('"', '')}"`,
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