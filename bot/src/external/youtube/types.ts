import { videoFormat } from 'ytdl-core';

/* eslint-disable @typescript-eslint/naming-convention */
export type YoutubeMediaInfo<T extends 'Checked' | 'Unknown' = 'Unknown'> = {
    title: string
    videoId: string
    source_url: string
    thumbnail_url: string
    ownerChannelName: string
    duration: string
    category: string
    audioFormat: videoFormat

} & (T extends 'Unknown' ? {
    simpleFormat?: videoFormat
    videoFormat?: videoFormat
    chooseSimple: boolean
} : {
    simpleFormat: videoFormat
    videoFormat?: videoFormat
    chooseSimple: true
} | {
    simpleFormat?: videoFormat
    videoFormat: videoFormat
    chooseSimple: false
})