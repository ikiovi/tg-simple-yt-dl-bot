import { createHash } from 'crypto';
import { parse, resolve } from 'path';
import { getAllImports } from './import';
import { readdirSync, writeFileSync } from 'fs';
import { ModuleResolutionKind, createCompilerHost } from 'typescript';

const handlersFolder = resolve('src\\handlers');
const unstableDependencies = process.env.npm_package_config_unstableDependencies?.split('\n\n');
const files = readdirSync(handlersFolder, { encoding: 'utf-8' });

const handlers = files.map(f => {
    const { name } = parse(f);

    return {
        key: createHash('md5').update(name).digest('hex'),
        path: resolve(handlersFolder, name),
        dependencies: [] as string[]
    };
});

if (!unstableDependencies?.length) {
    saveHandlers();
    process.exit();
}

const tsHost = createCompilerHost({
    allowJs: true,
    noEmit: true,
    isolatedModules: true,
    resolveJsonModule: false,
    moduleResolution: ModuleResolutionKind.Classic,
    incremental: true,
    noLib: true,
    noResolve: true,
}, true);

for (const handler of handlers) {
    const handlerPath = handler.path + '.ts';
    if (!handlerPath) continue;
    const imports = getAllImports(tsHost, handlerPath);
    const dependencies = unstableDependencies
        .filter(dep => imports.has(dep));
    // .map((_, i) => i);
    if (!dependencies.length) continue;
    handler.dependencies = dependencies;
}

saveHandlers();

function saveHandlers() {
    const filePath = resolve(process.env.npm_package_config_handlersInfo ?? 'unstable.json');
    const data = JSON.stringify(
        handlers.reduce<Record<string, unknown>>((obj, item) =>
            (obj[item.key] = item.dependencies.length && item.dependencies, obj), {})
    );
    writeFileSync(filePath, data);
}