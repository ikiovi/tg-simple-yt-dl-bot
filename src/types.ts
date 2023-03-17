import Bottleneck from 'bottleneck';
import { Context } from 'grammy';

export type MyContext = Context & {
    limiter: Bottleneck,
    getYoutubeVideoInfo: (url: string) => Promise<YoutubeVideoInfo>
}

/* eslint-disable @typescript-eslint/naming-convention */
export type YoutubeVideoInfo = {
    title: string
    videoId: string
    video_url: string
    thumb_url: string
    contentLength: number
    source_url: string
    ownerChannelName: string
    quality: typeof qualities[number]
}

export const qualities = ['highestvideo', 'highest', 'lowest'] as const;