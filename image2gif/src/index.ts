import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn } from 'child_process';

const server = fastify();
server.register(cors, {
    origin: process.env.ORIGIN_REGEXP ?? '*',
    methods: ['GET'],
    cacheControl: 'public, max-age=604800, immutable'
});

server.get('/2gif', async (req, res) => {
    const query = req.query as Record<string, string>;
    console.log(query.a);
    if (!URL.canParse(query.a)) return res.code(400).send('Invalid address');
    return res.type('image/gif').send(convertToGif(query.a));
});

server.listen({ port: +(process.env.PORT ?? 8080), host: process.env.HOST ?? '127.0.0.1' }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
});

function convertToGif(url: string, delay = 3) {
    const convert = spawn(process.env.IMAGEMAGICK_CONVERT!, [
        '-delay', `${delay * 100}`,
        '-loop', '0',
        url, url,
        'gif:-'
    ], {
        windowsHide: true,
        stdio: ['inherit', 'pipe', 'inherit']
    });
    return convert.stdout!;
}