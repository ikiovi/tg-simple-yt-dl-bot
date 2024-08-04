import { Context } from 'grammy';
import { YoutubeVideo } from './youtube';
import { MusicEntity } from '../external/odesly/types';

export type MyContext = Context & YtdlHelperFlavor

interface YtdlHelperFlavor {
    ytdl: {
        get: (video: string) => Promise<YoutubeVideo>
        getMusic: (audio: string, options: Omit<MusicEntity, 'linksByPlatform'>) => Promise<YoutubeVideo<'audio'>>
        initPlaceholders: (chat_id: number) => Promise<void>
    }
}