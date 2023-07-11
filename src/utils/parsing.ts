import { InlineQueryResult } from 'grammy/types';

export function getErrorResult(name: string, message: string): InlineQueryResult {
    return {
        id: 'error',
        title: `Error: ${name}`,
        type: 'article',
        description: message,

        input_message_content: {
            message_text: `<strong>${name}</strong> <pre>${message}</pre>`,
            parse_mode: 'HTML'
        }
    };
}

export function getUnavalableResult(id: string): InlineQueryResult {
    return {
        id: id + '_unavalable',
        type: 'article',
        title: 'Handler temporarily unavailable',

        input_message_content: {
            message_text: `Handler [<pre>${id}</pre>] temporarily unavailable due to unexpected behavior.`,
            parse_mode: 'HTML'
        }
    };
}

export function bytesToHumanSize(bytes: number): string {
    const units = ' KMGTPEZYXWVU';
    if (bytes <= 0) return '0';
    const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
    return (Math.round(bytes * 100 / Math.pow(1024, t2)) / 100) + units.charAt(t2).replace(' ', '') + 'B';
}