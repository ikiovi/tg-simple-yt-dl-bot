import { Context } from 'grammy';
import { YoutubeVideo } from './youtube';
import { VideoOptions } from '../external/youtube/api';
import { MusicEntity } from '../external/odesly/types';

export type MyContext = Context & YtdlHelperFlavor

interface YtdlHelperFlavor {
    ytdl: {
        get: (video: string, options?: Partial<VideoOptions>) => Promise<YoutubeVideo>
        getMusic: (audio: string, options?: Omit<MusicEntity, 'linksByPlatform'>) => Promise<YoutubeVideo>
        initPlaceholders: (chat_id: number) => Promise<void>
    }
}