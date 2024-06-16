import { Context } from 'grammy';
import { YoutubeVideo } from './youtube';

export type MyContext = Context & YtdlHelperFlavor

interface YtdlHelperFlavor {
    ytdl: {
        get: (video: string) => Promise<YoutubeVideo>
        initPlaceholders: (chat_id: number) => Promise<void>
    }
}