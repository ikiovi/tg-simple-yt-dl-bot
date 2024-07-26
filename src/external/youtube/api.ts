import { VideoFormat, YoutubeMediaInfo } from './types';
import { getURLVideoID, validateURL } from '../../utils/ytdl-core';
import { Constants, FormatUtils, Innertube, Player } from 'youtubei.js';
import { download } from '../../utils/download';

const sizeLimitMB = 50;
const sizeLimitBytes = sizeLimitMB * (1000 ** 2);

//TODO?: Bypass age restriction
async function getYoutubeVideoInfo(id: string): Promise<YoutubeMediaInfo> {
    const ytdl = await Innertube.create();
    const info = await ytdl.getBasicInfo(id, 'iOS');
    const { basic_info: videoDetails, streaming_data } = info;
    const parseFormat = (f: Parameters<typeof parseInnertubeFormat>[0]) => parseInnertubeFormat(f, ytdl.session.player);
    if (videoDetails.is_live) throw new Error('Unable to download livestream');

    const formats = [...streaming_data?.formats ?? [], ...streaming_data?.adaptive_formats ?? []]
        .filter(f => f.has_video && (f.content_length ?? 0) < sizeLimitBytes)
        .map(parseFormat)
        .sort((f1, f2) => isHasGreaterQuality(f1, f2) ? -1 : 1);
    if (!videoDetails || !videoDetails.id) throw new Error('Invalid video info');

    const simpleFormat = formats?.filter(f => f.hasAudio)[0];
    const hqAudioFormat = parseFormat(info.chooseFormat({ type: 'audio', quality: 'best' }));

    const result: Omit<YoutubeMediaInfo, 'chooseSimple'> = {
        sourceUrl: `https://youtu.be/${id}`,
        videoId: videoDetails.id,
        title: videoDetails.title!,
        audioFormat: hqAudioFormat as VideoFormat,
        ownerChannelName: videoDetails.author!,
        category: videoDetails.category ?? undefined,
        duration: videoDetails.duration ?? 0,
        simpleFormat
    };

    if (simpleFormat?.isHQ) return { ...result, chooseSimple: true };

    const validVideoFormats = formats?.filter(f =>
        f.container.includes(process.env.VIDEO_CONTAINER ?? 'mp4') && //?TODO: use different containers to get the best quality within size limit
        (process.env.VIDEO_CONTAINER == 'webm' ? f.codecs.includes('vp9') : f.codecs.includes('avc1')) &&
        !f.hasAudio &&
        f.contentLength + hqAudioFormat.contentLength < sizeLimitBytes
    );
    const videoFormat = validVideoFormats?.filter(f => f.isHQ)[0] ?? validVideoFormats?.at(0);

    return {
        ...result,
        videoFormat,
        chooseSimple: !!simpleFormat && (!videoFormat || isHasGreaterQuality(simpleFormat, videoFormat))
    };
}

function parseInnertubeFormat(f: ReturnType<typeof FormatUtils.chooseFormat>, player?: Player): VideoFormat {
    const regex = /video\/(?<container>[^;]+);\s*codecs="(?<codecs>[^"]+)"/;
    const { container, codecs } = regex.exec(f.mime_type)?.groups ?? {};
    return {
        codecs,
        container,
        quality: f.quality!,
        hasVideo: f.has_video,
        hasAudio: f.has_audio,
        url: f.decipher(player),
        contentLength: f.content_length!,
        isFull: f.has_audio && f.has_video,
        isHQ: !['tiny', 'small', 'medium'].includes(f.quality!.toString()),
        getReadable() {
            return download(
                this.url,
                this.contentLength,
                Constants.STREAM_HEADERS,
                this.isFull && !this.isHQ ? 0 : 10 * 1024 * 1024
            );
        }
    };
}

function isHasGreaterQuality(target: VideoFormat, other: VideoFormat) {
    const qualities = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
    return qualities.indexOf(target.quality.toString()) >= qualities.indexOf(other.quality.toString());
}

export { getYoutubeVideoInfo, getURLVideoID, validateURL, sizeLimitBytes };