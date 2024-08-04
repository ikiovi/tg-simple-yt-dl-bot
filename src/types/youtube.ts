import EventEmitter from 'events';
import { InputFile } from 'grammy';
import { Message } from 'grammy/types';
import { YoutubeMediaInfo } from '../external/youtube/types';
import { SupportedMediaUploads as SMU, UploadFileOptions } from './file';

export type ProgressEventCallback = (value: number) => void;
export type YoutubeMedia<T extends SMU = SMU> = YoutubeMediaInfo & {
    emitter: EventEmitter
    isExceeds: boolean
    isCached: number // 0 - not cached, 1 - cached audio, 2 - cached video, 3 - both
    file?: {
        video_id?: string | null
        audio_id?: string | null
    }
    progress: {
        success(type: T, callback: (value: string) => void): void
        finished(type: T, callback: () => void): void
        error(type: T, callback: (value: unknown) => void): void
        once(callback: ProgressEventCallback): void
        on(callback: ProgressEventCallback): void
    }
    downloadOrCached(type?: T): Promise<string | InputFile>
    getCached(type?: T, allowPlaceholder?: boolean): Promise<string>
    replyWith<TK extends T = T>(type?: TK, options?: Omit<UploadFileOptions<TK>, 'type'>, chat_id?: number): Promise<Message>
}

export type YoutubeVideo<T extends SMU = SMU> = Omit<YoutubeMedia<T>, 'file_id' | 'emitter'>;