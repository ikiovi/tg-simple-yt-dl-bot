type Primitive = string | number | boolean;
type HashableRecord = { [key: string]: Primitive | Primitive[] | HashableRecord }

function fnv1a32(input: string): number {
    let hash = 0x811c9dc5; // FNV offset basis (32-bit)
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
}

function stringifyValue(value: HashableRecord[string]): string {
    if (['string', 'number', 'boolean'].includes(typeof value)) return value.toString();
    if (Array.isArray(value)) return value.map(item => stringifyValue(item)).join(',');
    return stringifyObject(value as HashableRecord);
}

function stringifyObject(obj: HashableRecord): string {
    const result = [];
    for (const key of Object.keys(obj).sort()) {
        const value = obj[key] as Parameters<typeof stringifyValue>[0];
        if (typeof value === 'function' || value === undefined || value === null) continue;
        result.push(`${key}:${stringifyValue(value)}`);
    }

    return result.join('|');
}

export function hashObject(obj?: HashableRecord): string {
    if (!obj || (typeof obj === 'object' && !Object.keys(obj).length)) return '';
    const sortedString = stringifyObject(obj);
    const hash = fnv1a32(sortedString);
    return hash.toString(16).padStart(8, '0');
}
