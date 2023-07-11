import ytdl from 'ytdl-core';
import { video_qualities, YoutubeMediaInfo } from '../../types/youtube';

const sizeLimitMB = 20;
const sizeLimitBytes = sizeLimitMB * (1024 ** 2);
const maxDifferenceBytes = 1.5 * (1024 ** 2);
const youtubeUrlRegex = /https?:\/{2}(.*\.)?youtu((\.be)|(be\.com))\//gm;

//TODO: Youtube music 
//TODO?: Bypass age restriction
async function getYoutubeVideoInfo(ytUrl: string): Promise<YoutubeMediaInfo> {
    // throw new Error('AMOGUS');
    const { videoDetails, formats } = await ytdl.getInfo(ytUrl);
    const { thumbnails } = videoDetails;
    const format = await getHQVideoUrl(formats);

    return {
        ...videoDetails,
        thumbnail_url: thumbnails.pop()!.url,
        source_url: videoDetails.video_url,
        ...format,
    };
}

async function getHQVideoUrl(formats: ytdl.videoFormat[]) {
    for (const quality of video_qualities) {
        const { url } = ytdl.chooseFormat(formats, {
            filter: 'videoandaudio',
            quality,
        });

        const { headers } = await fetch(url, { method: 'HEAD' });
        const contentLength = Number(headers.get('content-length'));

        if (contentLength > sizeLimitBytes && contentLength - sizeLimitBytes <= maxDifferenceBytes && quality != video_qualities.at(-1)) {
            await new Promise(r => setTimeout(r, 1500)); // delay
            continue;
        }
        return { video_url: url, contentLength, quality };
    }

    return { contentLength: -1, quality: video_qualities.at(-1)! };
}

export { getYoutubeVideoInfo, youtubeUrlRegex, sizeLimitBytes };