import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function build(destination = '_site') {
  const source = resolve('dist');
  const output = resolve(destination);
  if (output === source || source.startsWith(output + '/') || output.startsWith(source + '/')) {
    throw new Error('Build output must be separate from source.');
  }
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error('Unexpected non-file entry: ' + path);
    }
  }
  await walk(source);
  const hash = createHash('sha256');
  for (const path of files.sort()) {
    hash.update(relative(source, path));
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  const version = hash.digest('hex').slice(0, 16);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  const swPath = join(output, 'sw.js');
  const sw = await readFile(swPath, 'utf8');
  const marker = "const CACHE=CACHE_PREFIX+'v17-source';";
  if (!sw.includes(marker)) throw new Error('Missing service-worker build marker.');
  await writeFile(swPath, sw.replace(marker, `const CACHE=CACHE_PREFIX+'${version}';`));
  const updatesPath=join(output,'updates.mjs');
  const updates=await readFile(updatesPath,'utf8');
  const updatesMarker="export const APP_VERSION='v17-source';";
  if(!updates.includes(updatesMarker))throw new Error('Missing app update build marker.');
  const releaseMarker="export const APP_RELEASE='source';";
  if(!updates.includes(releaseMarker))throw new Error('Missing app release build marker.');
  const {version:release}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  await writeFile(updatesPath,updates.replace(updatesMarker,`export const APP_VERSION='${version}';`).replace(releaseMarker,`export const APP_RELEASE='${release}';`));
  await writeFile(join(output, '.nojekyll'), '');
  return { output, version, files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await build();
  console.log(`Built ${result.files} files in ${result.output}; offline cache ${result.version}`);
}
