//? ytdl-core hasn't been updated in a year, so I had to change the library. 
//? I also had to borrow some functions from there as well.

//#region url-utils.js
/*
    MIT License
    Slightly modified version of this file
    https://github.com/fent/node-ytdl-core/blob/9e15c7381f1eba188aba8b536097264db6ad3f7e/lib/url-utils.js
    Copyright (C) 2012-present by fent
*/

const validQueryDomains = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'gaming.youtube.com',
]);
const validPathDomains = /^https?:\/\/(youtu\.be\/|(www\.)?youtube\.com\/(embed|v|shorts)\/)/;
export function getURLVideoID(link: string) {
    const parsed = new URL(link.trim());
    let id = parsed.searchParams.get('v');
    if (validPathDomains.test(link.trim()) && !id) {
        const paths = parsed.pathname.split('/');
        id = parsed.host === 'youtu.be' ? paths[1] : paths[2];
    } else if (parsed.hostname && !validQueryDomains.has(parsed.hostname)) {
        throw Error('Not a YouTube domain');
    }
    if (!id) throw Error(`No video id found: "${link}"`);
    id = id.substring(0, 11);
    if (!validateID(id)) throw TypeError(
        `Video id (${id}) does not match expected ` +
        `format (${idRegex.toString()})`
    );

    return id;
}

const urlRegex = /^https?:\/\//;
export function getVideoID(str: string) {
    if (validateID(str)) return str;
    if (urlRegex.test(str.trim())) return getURLVideoID(str);
    throw Error(`No video id found: ${str}`);
}

const idRegex = /^[a-zA-Z0-9-_]{11}$/;
export function validateID(id: string) {
    return idRegex.test(id.trim());
}

export function validateURL(string: string) {
    try {
        getURLVideoID(string);
        return true;
    } catch (e) {
        return false;
    }
}
//#endregion
