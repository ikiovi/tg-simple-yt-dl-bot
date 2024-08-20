import { Innertube, UniversalCache, InnerTubeClient, Constants, FormatUtils, Player } from 'youtubei.js';
import { download } from './download';
import { VideoFormat } from './types';

export async function getBasicInfo(id: string, client?: InnerTubeClient) {
    const ytdl = await Innertube.create({ cache: new UniversalCache(false) });
    const info = await ytdl.getBasicInfo(id, client ?? process.env.YT_CLIENT as InnerTubeClient ?? 'iOS');
    const { basic_info: videoDetails, streaming_data, playability_status } = info;
    const parseFormat = (f: ReturnType<typeof FormatUtils.chooseFormat>) => parseInnertubeFormat(f, ytdl.session.player);

    return {
        videoDetails: {
            id: videoDetails.id,
            isLive: videoDetails.is_live,
            title: videoDetails.title!,
            category: videoDetails.category ?? undefined,
            duration: videoDetails.duration ?? 0,
            thumbnail: videoDetails.thumbnail,
            author: videoDetails.author
        },
        formats: [...streaming_data?.formats ?? [], ...streaming_data?.adaptive_formats ?? []],
        playabilityStatus: {
            playable: playability_status?.status === 'OK',
            status: playability_status?.status,
            reason: playability_status?.reason
        },
        chooseFormat: (o: Parameters<typeof FormatUtils.chooseFormat>[0]) => parseFormat(info.chooseFormat(o)),
        parseFormat
    };
}

function parseInnertubeFormat(f: ReturnType<typeof FormatUtils.chooseFormat>, player?: Player): VideoFormat {
    const regex = /video\/(?<container>[^;]+);\s*codecs="(?<codecs>[^"]+)"/;
    const { container, codecs } = regex.exec(f.mime_type)?.groups ?? {};
    return {
        codecs,
        container,
        itag: f.itag,
        quality: f.quality!,
        hasVideo: f.has_video,
        hasAudio: f.has_audio,
        url: f.decipher(player),
        contentLength: f.content_length!,
        isFull: f.has_audio && f.has_video,
        aspectRatio: calculateAspectRatio(f.width!, f.height!),
        isHQ: !['tiny', 'small', 'medium'].includes(f.quality!.toString()),
        getReadable(onError) {
            return download(this.url, this.contentLength, {
                headers: Constants.STREAM_HEADERS,
                chunkSize: this.isFull && !this.isHQ ? 0 : 10 * 1024 * 1024,
                onError
            });
        }
    };
}

function calculateAspectRatio(width: number, height: number) {
    return +((width / height) || 0).toFixed(1);
}