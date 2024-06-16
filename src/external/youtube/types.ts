import { videoFormat } from 'ytdl-core';

export type YoutubeMediaInfo = {
    title: string
    videoId: string
    source_url: string
    thumbnail_url: string
    ownerChannelName: string
    duration: string
    category: string
    audioFormat: videoFormat
    simpleFormat?: videoFormat
    videoFormat?: videoFormat
    chooseSimple: boolean
}

export const ytMediaInfoObjTemplate = {
    title: '',
    videoId: '',
    source_url: '',
    thumbnail_url: '',
    ownerChannelName: '',
    duration: '',
    category: '',
    audioFormat: null,
    simpleFormat: null,
    videoFormat: null,
    chooseSimple: false
} as const;