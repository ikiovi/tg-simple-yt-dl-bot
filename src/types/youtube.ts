import EventEmitter from 'events';
import { InputFile } from 'grammy';
import { Message } from 'grammy/types';
import { YoutubeMediaInfo } from '../external/youtube/types';
import { SupportedMediaUploads as SMU, UploadFileOptions } from './file';

export type ProgressEventCallback = (value: number) => void;
export type YoutubeMedia = YoutubeMediaInfo & {
    emitter: EventEmitter
    isExceeds: boolean
    isCached: number // 0 - not cached, 1 - cached audio, 2 - cached video, 3 - both
    file?: {
        video_id?: string | null
        audio_id?: string | null
    }
    progress: {
        finished(type: SMU, callback: (value: string) => void): void
        error(type: SMU, callback: (value: string) => void): void
        once(type: SMU, callback: ProgressEventCallback): void
        on(type: SMU, callback: ProgressEventCallback): void
    }
    downloadOrCached(type?: SMU): Promise<string | InputFile>
    getCached(type?: SMU, allowPlaceholder?: boolean): Promise<string>
    replyWith<T extends SMU = SMU>(type?: T, options?: Omit<UploadFileOptions<T>, 'type'>, chat_id?: number): Promise<Message>
}

export type YoutubeVideo = Omit<YoutubeMedia, 'file_id' | 'emitter'>;