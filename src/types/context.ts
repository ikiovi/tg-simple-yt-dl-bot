import { Context, SessionFlavor } from 'grammy';
import { YoutubeMediaInfo } from '../external/youtube/types';
import Bottleneck from 'bottleneck';

export type MyContext = Context & SessionFlavor<SessionData> & LimiterFlavor

interface LimiterFlavor {
    limiter: Bottleneck
}

interface SessionData {
    lastVideo?: YoutubeMediaInfo<'Checked'>
}