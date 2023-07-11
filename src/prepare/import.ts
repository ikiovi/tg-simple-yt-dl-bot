import { readFileSync } from 'fs';
import { CompilerHost, isExternalModuleNameRelative, preProcessFile, resolveModuleName } from 'typescript';

function getAllImports(tsHost: CompilerHost, headFile: string, exclude = new Set<string>()) {
    const content = readFileSync(headFile, 'utf-8');
    const fileInfo = preProcessFile(content);
    const imports = new Set<string>();

    for (const rawImport of fileInfo.importedFiles.map(({ fileName }) => fileName)) {
        const resolvedImport = resolveModuleName(rawImport, headFile, {}, tsHost);
        const importFullPath = resolvedImport.resolvedModule?.resolvedFileName;
        if (!isExternalModuleNameRelative(rawImport)) {
            imports?.add(rawImport);
            continue;
        }
        if (!importFullPath || exclude.has(importFullPath)) continue;
        getAllImports(tsHost, importFullPath, exclude).forEach(imports.add.bind(imports));
        exclude.add(importFullPath);
    }

    return imports;
}

function getCallerFile() {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack as unknown as NodeJS.CallSite[];
    Error.prepareStackTrace = undefined;
    return stack[1]?.getFileName();
}

export { getAllImports, getCallerFile };