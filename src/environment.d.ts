declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string;
            CHECKUPDATESH: number;
            RL_MINTIME_MS: number;
            RL_MAXQUEUE: number;
        }
    }
}

export { };