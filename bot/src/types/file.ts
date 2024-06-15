import { InputFile, InputMediaAudio, InputMediaVideo } from 'grammy/types';

export type UploadFile<T extends 'audio' | 'video'> = {
    type: T, data: ConstructorParameters<typeof InputFile>[0]
} & Omit<T extends 'audio' ? InputMediaAudio : InputMediaVideo, 'media'>;

export const uploadMethod = {
    audio: 'sendAudio',
    video: 'sendVideo'
} as const;