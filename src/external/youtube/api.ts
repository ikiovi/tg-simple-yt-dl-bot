import { copyObject } from '../../utils/object';
import { YoutubeMediaInfo, ytMediaInfoObjTemplate } from './types';
import ytdl, { chooseFormat, getInfo, videoFormat } from 'ytdl-core';

const sizeLimitMB = 50;
const sizeLimitBytes = sizeLimitMB * (1000 ** 2);

//TODO?: Bypass age restriction
async function getYoutubeVideoInfo(ytUrl: string): Promise<YoutubeMediaInfo> {
    const { videoDetails, formats, } = await getInfo(ytUrl);
    const { thumbnails, video_url } = videoDetails;

    const workingFormats = formats.filter(f => f.hasVideo && +f.contentLength < sizeLimitBytes);
    const simpleFormat = workingFormats.filter(f => f.hasAudio)[0];

    const hqAudioFormat = chooseFormat(formats, {
        filter: f => !f.hasVideo && f.container == (process.env.VIDEO_CONTAINER ?? 'mp4'),
        quality: 'highest'
    });

    const result = {
        ...videoDetails,
        source_url: video_url,
        audioFormat: hqAudioFormat,
        duration: videoDetails.lengthSeconds,
        thumbnail_url: thumbnails.pop()!.url,
        simpleFormat
    };

    if (isHQFormat(simpleFormat)) return { ...result, chooseSimple: true };

    const onlyVideoFormats = workingFormats.filter(f =>
        f.container === (process.env.VIDEO_CONTAINER ?? 'mp4') &&
        (process.env.VIDEO_CONTAINER == 'webm' ? f.codecs.startsWith('vp9') : f.codecs.startsWith('avc1')) &&
        !f.hasAudio &&
        +f.contentLength + +hqAudioFormat.contentLength < sizeLimitBytes
    );
    const videoFormat = onlyVideoFormats.filter(isHQFormat)[0] ?? onlyVideoFormats[0];
    return {
        videoFormat,
        ...copyObject(result, ytMediaInfoObjTemplate) as YoutubeMediaInfo,
        chooseSimple: !!simpleFormat && (!videoFormat || isHasGreaterQuality(simpleFormat, videoFormat))
    };
}

function isHQFormat(format?: videoFormat) {
    return format && !['tiny', 'small', 'medium'].includes(format.quality.toString());
}

function isHasGreaterQuality(target: videoFormat, other: videoFormat) {
    const qualities = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
    return qualities.indexOf(target.quality.toString()) > qualities.indexOf(other.quality.toString());
}

function downloadSpecificFormat(url: string, target: videoFormat | number) {
    const itag = typeof target == 'number' ? +target : target.itag;
    return ytdl(url, { filter: f => f.itag == itag });
}

export { getYoutubeVideoInfo, downloadSpecificFormat, sizeLimitBytes };