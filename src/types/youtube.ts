/* eslint-disable @typescript-eslint/naming-convention */
export type YoutubeMediaInfo = {
    title: string
    videoId: string
    video_url: string
    thumbnail_url: string
    contentLength: number
    source_url: string
    ownerChannelName: string
    quality: typeof video_qualities[number]
}

export const qualities = ['highest', 'lowest'] as const;
export const video_qualities = ['highestvideo', ...qualities] as const;