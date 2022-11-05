import Bottleneck from 'bottleneck';
import { Context } from 'telegraf';

export type MyContext = Context & {
    limiter: Bottleneck
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