import { validateURL } from './ytdl-core';

export function getTimeRange(str: string) {
    const t1 = getTimestamps(str);
    const t2 = getYtTimestamps(str);
    if (t1 && t2) return Object.assign(t2, t1);
    return t1 ?? t2;
}

function getTimestamps(str: string) {
    const regexp = /(?<s>(([0-9]{1,2}:){1,2}[0-9]{1,2})|[0-9]+)?;(?<e>([0-9]{1,2}(:[0-9]{1,2}){1,2})|[0-9]+)?/;
    const toSeconds = (timestamp?: string) => timestamp?.split(':').reduce((a, t) => (60 * a) + +t, 0);
    if (!regexp.test(str)) return;
    const { s, e } = regexp.exec(str)?.groups ?? {};
    const start = (+s || toSeconds(s));
    const end = (+e || toSeconds(e));
    if (!end && start) return { start };
    if (!start && end) return { end };
    if (!(start || end) || start! >= end!) return;
    return { start, end };
}

export function getYtTimestamps(str: string) {
    if (!validateURL(str)) return;
    const uri = new URL(str);
    const range = uri.searchParams.get('t')?.split(' ')?.map(n => +n).filter(Boolean);
    if (!range || !range.length) return;
    const start = range[0];
    const end = range[1];
    if (!start) return;
    if (!end) return { start };
    return { start, end: start + end };
}