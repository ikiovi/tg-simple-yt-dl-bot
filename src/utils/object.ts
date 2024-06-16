export function copyObject(source: Record<string, unknown>, template: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    for (const key in template) {
        if (key in source) result[key] = source[key];
    }
    return result;
}