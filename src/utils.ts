import ytdl from "ytdl-core";

export const youtubeUrlRegex = /https?:\/\/(w{3}\.)?youtu(\.)?be(\.com)?\/(watch\?v=)?(.*)/gm;

export async function getYoutubeVideoInfo(ytUrl: string) : Promise<YoutubeVideoInfo> {
    const { videoDetails, formats } = await ytdl.getInfo(ytUrl);
    const { videoId, title, video_url, ownerChannelName, thumbnails } = videoDetails;
    const thumbnail_url = thumbnails.pop()?.url ?? '';
    const { url } = ytdl.chooseFormat(formats, {
        filter: "videoandaudio",
        quality: 'highest'
    });
    return {
        videoId,
        title,
        video_url,
        full_video_url: url,
        ownerChannelName,
        thumbnail: thumbnail_url,
    }
}


export type YoutubeVideoInfo = {
    videoId: string
    title: string
    video_url: string
    ownerChannelName: string
    thumbnail: string
    full_video_url: string
    [key: string]: unknown
}