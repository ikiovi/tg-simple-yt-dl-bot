import { VideoFormat, YoutubeMediaInfo } from './types';
import { getURLVideoID, validateURL } from '../../utils/ytdl-core';
import { getBasicInfo } from './innertube';

const sizeLimitMB = 50.5;
const sizeLimitBytes = sizeLimitMB * (1000 ** 2);

export type VideoOptions = {
    range: Omit<Required<YoutubeMediaInfo>['range'], 'duration'>
    title: string
    creator: string
    thumbnail: string
}

async function getYoutubeVideoInfo(id: string, options?: Partial<VideoOptions>): Promise<YoutubeMediaInfo> {
    const { range } = options ?? {};
    const { videoDetails, formats: innertubeFormats, playabilityStatus, parseFormat } = await getBasicInfo(id);

    if (!videoDetails || !videoDetails.id) throw new Error('Invalid video info');
    if (videoDetails.isLive) throw new Error('Unable to download livestream');
    if (!playabilityStatus?.playable) throw new Error(`${playabilityStatus?.status}: ${playabilityStatus?.reason}`);

    if (range?.start && (range.start <= 0 || range.start >= videoDetails.duration)) range.start = undefined;
    if (range?.end && range.end >= videoDetails.duration) range.end = undefined;
    if (range?.end) range.end += 1;

    const duration = (range?.end ?? videoDetails.duration) - (range?.start ?? 0);

    const formats: (VideoFormat & { fragmentContentLength: number })[] = [];
    const audioFormats: typeof formats = [];

    for (const f of innertubeFormats) {
        const fragmentContentLength = (f.content_length ?? 0) * (duration / videoDetails.duration);
        if (fragmentContentLength >= sizeLimitBytes) continue;
        const format = { ...parseFormat(f), fragmentContentLength };
        if (f.has_video) {
            formats.push(format);
            continue;
        }
        audioFormats.push(format);
    }

    formats.sort((f1, f2) => isHasGreaterQuality(f1, f2) ? -1 : 1);
    audioFormats.reverse();

    const simpleFormat = formats?.find(f => f.hasAudio);
    const hqAudioFormat = audioFormats.find(f => f.isHQ) ?? audioFormats[0];
    const thumbnail = formats[0].aspectRatio < 1 ?
        `https://i.ytimg.com/vi/${id}/frame0.jpg` :
        videoDetails?.thumbnail?.[0].url;

    const result: Omit<YoutubeMediaInfo, 'chooseSimple'> = {
        sourceUrl: `https://youtu.be/${id}`,
        videoId: videoDetails.id,
        title: videoDetails.title!,
        audioFormat: hqAudioFormat as VideoFormat,
        ownerChannelName: videoDetails.author!,
        category: videoDetails.category ?? undefined,
        originDuration: videoDetails.duration,
        simpleFormat,
        thumbnail,
        duration,
        range
    };

    if (simpleFormat?.isHQ) return { ...result, chooseSimple: true };

    const validVideoFormats = formats?.filter(f =>
        f.container.includes('mp4') &&
        f.codecs.includes('avc1') &&
        !f.hasAudio &&
        f.fragmentContentLength + hqAudioFormat.fragmentContentLength < sizeLimitBytes
    );
    const videoFormat = validVideoFormats?.find(f => f.isHQ) ?? validVideoFormats[0];

    return {
        ...result,
        videoFormat,
        chooseSimple: !!simpleFormat && (!videoFormat || isHasGreaterQuality(simpleFormat, videoFormat))
    };
}


function isHasGreaterQuality(target: VideoFormat, other: VideoFormat) {
    const qualities = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
    return qualities.indexOf(target.quality.toString()) >= qualities.indexOf(other.quality.toString());
}



export { getYoutubeVideoInfo, getURLVideoID, validateURL, sizeLimitBytes };