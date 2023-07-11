type HandlerEvent = 'OPEN' | 'ERR';
type AppEvent = HandlerEvent;
type AppMessage = { id: string, type: AppEvent, value?: unknown }

export type { HandlerEvent, AppEvent, AppMessage };