//@ts-expect-error don't care, didn't find a workaround
import type { Options } from 'ky';
import { PassThrough, Readable } from 'stream';

export function downloadChunks(url: string, contentLength: number, chunkSize = 10 * 1024 * 1024): Readable {
    const stream = new PassThrough({ highWaterMark: 1024 * 512 });
    const opts: Options = {
        retry: {
            limit: 3,
            methods: ['get'],
            statusCodes: [403, 408, 500, 502, 503, 504],
        },
        timeout: 10000,
    };

    const getNextChunk = async (start: number, end: number) => {
        const ky = (await import('ky')).default; // 'cause it's ecm-only
        if (end >= contentLength) end = 0;
        const req = await ky.get(`${url}&range=${start}-${end || ''}`, opts);
        if (!req.ok || !req.body) return;
        const body = Readable.fromWeb(req.body);
        body.pipe(stream, { end: !end });
        body.once('end', () => {
            if (stream.destroyed || !end) return;
            getNextChunk(end + 1, end + chunkSize);
        });
    };
    getNextChunk(0, chunkSize);

    return stream;
}