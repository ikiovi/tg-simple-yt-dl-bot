import ytdl from 'ytdl-core';
import { YoutubeVideoInfo } from '../types';

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

export { getYoutubeVideoInfo, youtubeUrlRegex, sizeLimitBytes };