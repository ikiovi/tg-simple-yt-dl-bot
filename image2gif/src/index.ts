import 'dotenv/config';
import fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn } from 'child_process';

const server = fastify();
server.register(cors, {
    origin: /^(.*\.)?telegram\.org$/g
});

server.get('/2gif', (req, res) => {
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

function convertToGif(url: string, duration = 4) {
    //TODO: Doesn't work
    const ffmpeg = spawn(process.env.FFMPEG_PATH!, [
        '-hide_banner',
        '-i', url,
        '-t', `${duration}`,
        '-f', 'gif',
        'pipe:1'
    ], {
        windowsHide: true,
        stdio: ['inherit', 'pipe', 'inherit'],
    });
    return ffmpeg.stdout!;
}