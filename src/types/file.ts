import { InputMediaAudio, InputMediaVideo } from 'grammy/types';

export const supportedMediaTypes = ['audio', 'video'] as const;
export type SupportedMediaUploads = typeof supportedMediaTypes[number];
export type UploadFileOptions<T extends SupportedMediaUploads = SupportedMediaUploads> =
    Omit<T extends 'audio' ? InputMediaAudio : InputMediaVideo, 'media'> & { disable_notification?: boolean, temp_upload?: boolean };

export const uploadMethod = {
    audio: 'sendAudio',
    video: 'sendVideo'
} as const;