import { Readable } from 'stream';
import { DownloadOptions } from './download';

export type YoutubeMediaInfo = {
    title: string
    videoId: string
    sourceUrl: string
    ownerChannelName: string
    duration: number
    category?: string
    thumbnail?: string
    audioFormat: VideoFormat
    simpleFormat?: VideoFormat
    videoFormat?: VideoFormat
    chooseSimple: boolean
}

export type VideoFormat = {
    itag: number
    hasVideo: boolean
    hasAudio: boolean
    isHQ: boolean
    isFull: boolean
    quality: string
    contentLength: number
    aspectRatio: number
    container: 'mp4' | 'webm' | string
    codecs: string
    url: string
    getReadable: (onError?: DownloadOptions['onError']) => Promise<Readable>
};