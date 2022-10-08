declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string;
            CHECKUPDATESH:number;
        }
    }
}

export { };