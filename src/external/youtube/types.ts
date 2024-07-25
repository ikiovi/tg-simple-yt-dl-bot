import { Constants } from 'youtubei.js';
import { download } from '../../utils/download';

export type YoutubeMediaInfo = {
    title: string
    videoId: string
    sourceUrl: string
    ownerChannelName: string
    duration: number
    category?: string
    audioFormat: VideoFormat
    simpleFormat?: VideoFormat
    videoFormat?: VideoFormat
    chooseSimple: boolean
}

export class VideoFormat {
    public itag!: number;
    public hasVideo!: boolean;
    public hasAudio!: boolean;
    public isHQ!: boolean;
    public isFull!: boolean;
    public quality!: string;
    public contentLength!: number;
    public container!: 'mp4' | 'webm' | string;
    public codecs!: string;
    private downloadUrl: string;
    private isUrlValid = true;
    private _resolver?: (err?: unknown) => void;

    constructor(obj: Omit<VideoFormat, 'getReadable' | 'testUrl' | 'resolver'>) {
        Object.assign(this, obj);
        this.downloadUrl = obj.url;
    }

    async getReadable() {
        if (!this.isUrlValid) await new Promise<void>((res, rej) => {
            this._resolver = err => err ? rej(err) : res();
            setTimeout(rej, 15_000);
        });
        return await download(this.url, this.contentLength, Constants.STREAM_HEADERS, this.isFull && !this.isHQ ? 0 : 10 * 1024 * 1024);
    }

    async testUrl() {
        const response = await fetch(this.downloadUrl, {
            method: 'HEAD'
        });
        this.isUrlValid = response.ok;
        return response.ok;
    }

    public set url(url: string) {
        if (!this.isUrlValid) {
            this.resolver();
            this.isUrlValid = Boolean(url);
        }
        this.downloadUrl = url;
    }

    resolver(err?: unknown) {
        this._resolver?.(err);
    }

    public get url() {
        return this.downloadUrl;
    }
}