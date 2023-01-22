import { checkForUpdate } from '../exec';

export const packageName = 'ytdl-core';
export const checkForYtdlUpdate = () => checkForUpdate(packageName, process.exit);