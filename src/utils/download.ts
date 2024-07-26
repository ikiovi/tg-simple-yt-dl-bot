//@ts-expect-error don't care, didn't find a workaround
import type { Options } from 'ky';
import { PassThrough, Readable } from 'stream';

export async function download(url: string, contentLength: number, headers?: Options['headers'], chunkSize = 10 * 1024 * 1024): Promise<Readable> {
    const stream = new PassThrough({ highWaterMark: 1024 * 512 }).on('error', () => { });
    const opts: Options = {
        retry: {
            limit: 3,
            methods: ['get'],
            statusCodes: [403, 408, 500, 502, 503, 504],
        },
        timeout: 10000,
        redirect: 'follow',
        headers
    };

    const ky = (await import('ky')).default; // 'cause it's ecm-only
    const getNextChunk = async (start: number, end: number) => {
        if (end >= contentLength) end = 0;
        const range = chunkSize == 0 ? '' : `&range=${start}-${end || ''}`;
        const req = await ky.get(`${url}${range}`, opts).catch(responseError);
        if (!req?.ok || !req?.body) return Promise.reject();
        const body = Readable.fromWeb(req.body);
        body.pipe(stream, { end: !end });
        body.once('end', () => {
            if (stream.destroyed || !end) return;
            getNextChunk(end + 1, end + chunkSize);
        });
    };
    await getNextChunk(0, chunkSize);
    return stream;
}

function responseError(err: { message: string, name: string, response?: Record<string, unknown> }) {
    const { response, name } = err;
    if (!response) throw new Error(err.message);
    const newErr = new Error(`[${response?.status}]: ${response?.statusText}`);
    newErr.name = name;
    throw newErr;
}