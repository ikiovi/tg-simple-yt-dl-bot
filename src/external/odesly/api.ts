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
    if (!linksByPlatform || !entitiesByUniqueId) return;
    const result: MusicEntity = { linksByPlatform };

    for (const entity of Object.values(entitiesByUniqueId)) {
        if (entity.type == 'album') return;
        if (result.title && result.artist && result.cover) break;
        result.title ??= entity.title;
        result.artist ??= entity.artistName;
        result.cover ??= entity.thumbnailUrl;
    }

    return result;
}