import Bottleneck from 'bottleneck';
import { Context } from 'grammy';

export type MyContext = Context & {
    limiter: Bottleneck,
    getYoutubeVideoInfo: (url: string) => Promise<YoutubeVideoInfo>
}

export type YoutubeVideoInfo = {
    title: string
    videoId: string
    video_url: string
    thumb_url: string
    contentLength: number
    video_full_url: string
    ownerChannelName: string
}