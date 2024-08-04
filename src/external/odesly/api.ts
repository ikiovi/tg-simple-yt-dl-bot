//@ts-expect-error -_-
import type { Options } from 'ky';
import { MusicEntity, OdeslyEntity } from './types';

export async function getLinks(song: string): Promise<MusicEntity | undefined> {
    const ky = (await import('ky')).default;
    const opts: Options = {
        retry: {
            methods: ['get']
        },
        redirect: 'follow'
    };
    const url = new URL('https://api.song.link/v1-alpha.1/links');
    url.searchParams.append('songIfSingle', `${true}`);
    url.searchParams.append('url', song);
    const response = await ky.get(url, opts);
    if (!response.ok) return;
    const { linksByPlatform, entitiesByUniqueId } = await response.json<OdeslyEntity>() ?? {};
    const info: Omit<MusicEntity, 'linksByPlatform'> = {};

    for (const id in entitiesByUniqueId) {
        info.title ??= entitiesByUniqueId[id].title;
        info.artist ??= entitiesByUniqueId[id].artistName;
        info.cover ??= entitiesByUniqueId[id].thumbnailUrl;
    }

    return {
        ...info,
        linksByPlatform
    };
}