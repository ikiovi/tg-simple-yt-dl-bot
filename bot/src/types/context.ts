import { Context, SessionFlavor } from 'grammy';
import { YoutubeMediaInfo } from '../external/youtube/types';

export type MyContext = Context & SessionFlavor<SessionData>

interface SessionData {
    lastVideo?: YoutubeMediaInfo<'Checked'>
}