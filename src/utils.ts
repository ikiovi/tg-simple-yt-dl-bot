import ytdl from "ytdl-core";

export const youtubeUrlRegex = /https?:\/\/(w{3}\.)?youtu(\.)?be(\.com)?\/(watch\?v=)?(.*)/gm;

export async function getYoutubeVideoInfo(ytUrl: string) : Promise<YoutubeVideoInfo> {
    const { videoDetails, formats } = await ytdl.getInfo(ytUrl);
    const { thumbnails } = videoDetails;
    const { url } = ytdl.chooseFormat(formats, {
        quality: 'highest',
        filter: "videoandaudio",
    });

    return {
        ... videoDetails,
        video_full_url: url,
        thumb_url: thumbnails.pop()?.url ?? '',
    }
}


export type YoutubeVideoInfo = {
    videoId: string
    title: string
    video_url: string
    ownerChannelName: string
    thumb_url: string
    video_full_url: string
}