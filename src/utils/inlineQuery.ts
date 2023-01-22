import { InlineKeyboard } from 'grammy';
import { InlineQueryResult } from 'grammy/out/types.node';
import { YoutubeVideoInfo } from '../types';
import { sizeLimitBytes } from './ytdl';

//TODO: Search for best quality
export function getResultsFromVideoInfo(info: YoutubeVideoInfo) {
    const { title, contentLength, thumb_url, video_url,
        video_full_url, videoId: id, ownerChannelName } = info;
    const size = bytesToHumanSize(contentLength);
    const reply_markup = new InlineKeyboard().url('View on Youtube', video_url);

    const isValidSize = contentLength < sizeLimitBytes;
    const invalidSizeMessage = [`The video size [${size}] is too large.`,
        'Due to Telegram API limits, this will most likely cause an error.'];

    const videoItem = {
        type: 'video',
        mime_type: 'video/mp4',
        thumb_url,
        video_url: video_full_url,

        id: id + '_nocaption',
        title: 'Without caption',
        description: size
    } as const;

    const result: InlineQueryResult[] = [{
        ...videoItem,
        id,
        reply_markup,

        caption: `${title}\n${ownerChannelName}`,
        title: isValidSize ? title : invalidSizeMessage[0],
        description: isValidSize ? `${ownerChannelName}` : invalidSizeMessage[1],
    }];

    if (isValidSize) result.push(videoItem);

    return result;
}

export function getErrorResult(name: string, message: string): InlineQueryResult {
    return {
        id: 'error',
        title: `Error: ${name}`,
        type: 'article',
        description: message,

        input_message_content: {
            message_text: `${name}: <pre>${message}</pre>`,
            parse_mode: 'HTML'
        }
    };
}

function bytesToHumanSize(bytes: number): string {
    const units = ' KMGTPEZYXWVU';
    if (bytes <= 0) return '0';
    const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
    return (Math.round(bytes * 100 / Math.pow(1024, t2)) / 100) + units.charAt(t2).replace(' ', '') + 'B';
}