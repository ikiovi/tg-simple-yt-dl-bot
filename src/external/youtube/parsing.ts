import { InlineKeyboard } from 'grammy';
import { sizeLimitBytes } from './ytdl';
import { InlineQueryResult } from 'grammy/types';
import { YoutubeMediaInfo } from '../../types/youtube';
import { bytesToHumanSize } from '../../utils/parsing';

export function getResultsFromVideoInfo(info: YoutubeMediaInfo) {
    const {
        title, ownerChannelName, quality, contentLength,
        thumbnail_url, video_url, source_url,
        videoId: id
    } = info; // ¯\(°_o)/¯

    const size = bytesToHumanSize(contentLength);
    const isValidSize = contentLength < sizeLimitBytes;
    const invalidSizeMessage = {
        title: `The video size [${size}] is too big.`,
        description: 'Due to Telegram API limits, this will most likely cause an error.'
    } as const;
    const reply_markup = new InlineKeyboard().url('View on Youtube', source_url);

    const item = {
        type: 'video',
        mime_type: 'video/mp4',
        thumbnail_url,
        video_url,

        id: id + '_nocaption',
        title: 'Without caption',
        description: `${size} | ${quality}`,
    } as const;

    const result: InlineQueryResult[] = [{
        ...item,
        id,
        reply_markup,

        title,
        description: ownerChannelName,
        caption: `${title}\n${ownerChannelName}`,
        ...isValidSize ? {} : invalidSizeMessage,
    }];

    if (isValidSize) result.push(item);

    return result;
}