export type OdeslyEntity = {
    entityUniqueId: string
    userCountry: string
    pageUrl: string

    linksByPlatform: Record<Platform, OdeslyPlatformSpecificEntity>

    entitiesByUniqueId: Record<string, OdeslyUniqueEntity>
}

export type OdeslyUniqueEntity = {
    id: string
    type: 'song' | 'album'

    title?: string
    artistName?: string
    thumbnailUrl?: string
    thumbnailWidth?: number
    thumbnailHeight?: number

    apiProvider: APIProvider
    platforms: Platform[]
}

type OdeslyPlatformSpecificEntity = {
    entityUniqueId: string
    url: string
    nativeAppUriMobile?: string
    nativeAppUriDesktop?: string
}

export type MusicEntity = {
    title?: OdeslyUniqueEntity['title']
    artist?: OdeslyUniqueEntity['artistName']
    cover?: OdeslyUniqueEntity['thumbnailUrl']
    linksByPlatform: Record<Platform, Pick<OdeslyPlatformSpecificEntity, 'url'>>
}

type Platform =
    | 'spotify'
    | 'itunes'
    | 'appleMusic'
    | 'youtube'
    | 'youtubeMusic'
    | 'google'
    | 'googleStore'
    | 'pandora'
    | 'deezer'
    | 'tidal'
    | 'amazonStore'
    | 'amazonMusic'
    | 'soundcloud'
    | 'napster'
    | 'yandex'
    | 'spinrilla'
    | 'audius'
    | 'audiomack'
    | 'anghami'
    | 'boomplay'

type APIProvider =
    | 'spotify'
    | 'itunes'
    | 'youtube'
    | 'google'
    | 'pandora'
    | 'deezer'
    | 'tidal'
    | 'amazon'
    | 'soundcloud'
    | 'napster'
    | 'yandex'
    | 'spinrilla'
    | 'audius'
    | 'audiomack'
    | 'anghami'
    | 'boomplay'