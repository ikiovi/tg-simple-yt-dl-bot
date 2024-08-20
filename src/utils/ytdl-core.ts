/*
    MIT License

    Copyright (C) 2012-present by fent

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.
    -----------------------------------------------------------------------------------------------------
    Slightly modified version of this file
    https://github.com/fent/node-ytdl-core/blob/9e15c7381f1eba188aba8b536097264db6ad3f7e/lib/url-utils.js
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