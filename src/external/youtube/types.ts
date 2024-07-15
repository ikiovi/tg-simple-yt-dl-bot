import { Readable } from 'stream';

export type YoutubeMediaInfo = {
    title: string
    videoId: string
    sourceUrl: string
    ownerChannelName: string
    duration: number
    category?: string
    audioFormat: VideoFormat
    simpleFormat?: VideoFormat
    videoFormat?: VideoFormat
    chooseSimple: boolean
}

export type VideoFormat = {
    hasVideo: boolean
    hasAudio: boolean
    isHQ: boolean
    isFull: boolean
    quality: string
    contentLength: number
    container: 'mp4' | 'webm' | string
    codecs: string
    url: string
    getReadable: () => Readable | Promise<Readable>
};