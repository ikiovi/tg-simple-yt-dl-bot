import ytdl from 'ytdl-core';
import { qualities, YoutubeVideoInfo } from '../types';

const sizeLimitMB = 20;
const sizeLimitBytes = sizeLimitMB * (1024 ** 2);
const maxAllowDifferenceBytes = 1.5 * (1024 ** 2);
const youtubeUrlRegex = /^(https?):(\/{2})(w{3}\.)?youtu(\.be)?(be\.com)?\/(watch\?v=)?(.*)/gm;

async function getYoutubeVideoInfo(ytUrl: string): Promise<YoutubeVideoInfo> {
    const { videoDetails, formats } = await ytdl.getInfo(ytUrl);
    const { thumbnails } = videoDetails;
    const format = await getHQVideoUrl(formats);

    return {
        ...videoDetails,
        thumb_url: thumbnails.pop()!.url,
        source_url: videoDetails.video_url,
        ...format
    };
}

async function getHQVideoUrl(formats: ytdl.videoFormat[]) {
    for (const quality of qualities) {
        const { url } = ytdl.chooseFormat(formats, {
            filter: 'videoandaudio',
            quality
        });

        const { headers } = await fetch(url, { method: 'HEAD' });
        const contentLength = Number(headers.get('content-length'));

        if (contentLength > sizeLimitBytes && contentLength - sizeLimitBytes <= maxAllowDifferenceBytes && quality != qualities.at(-1)) {
            await new Promise(r => setTimeout(r, 1500)); // delay
            continue;
        }
        return { video_url: url, contentLength, quality };
    }

    return { contentLength: -1, quality: qualities.at(-1)! };
}

export { getYoutubeVideoInfo, youtubeUrlRegex, sizeLimitBytes };