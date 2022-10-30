import ytdl from 'ytdl-core';
import { YoutubeVideoInfo } from './types';

const sizeLimitMB = 20;
const sizeLimitBytes = sizeLimitMB * (1024 ** 2);
const youtubeUrlRegex = /^(https?):(\/{2})(w{3}\.)?youtu(\.be)?(be\.com)?\/(watch\?v=)?(.*)/gm;

async function getYoutubeVideoInfo(ytUrl: string): Promise<YoutubeVideoInfo> {
    const { videoDetails, formats } = await ytdl.getInfo(ytUrl);
    const { thumbnails } = videoDetails;
    const { url } = ytdl.chooseFormat(formats, {
        quality: 'highest',
        filter: 'videoandaudio',
    });

    const { headers } = await fetch(url, { method: 'HEAD' });
    const contentLength = +(headers.get('content-length') ?? '');

    return {
        contentLength,
        video_full_url: url,
        thumb_url: thumbnails.pop()?.url ?? '',
        ...videoDetails,
    };
}

function bytesToHumanSize(bytes: number): string {
    const units = ' KMGTPEZYXWVU';
    if (bytes <= 0) return '0';
    const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
    return (Math.round(bytes * 100 / Math.pow(1024, t2)) / 100) + units.charAt(t2).replace(' ', '') + 'B';
}


export { bytesToHumanSize, getYoutubeVideoInfo, youtubeUrlRegex, sizeLimitBytes };