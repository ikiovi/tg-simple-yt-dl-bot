import { YoutubeMedia } from '../types/youtube';
import { SupportedMediaUploads as SMU } from '../types/file';

export function isCached(type: SMU, media: Pick<YoutubeMedia, 'isCached'>) {
    return media.isCached == 3 || media.isCached == { video: 2, audio: 1 }[type];
}