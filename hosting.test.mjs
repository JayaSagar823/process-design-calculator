import assert from 'node:assert/strict';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { build } from './scripts/build.mjs';

const temp = await mkdtemp(join(tmpdir(), 'process-design-hosting-'));
try {
  const output = join(temp, 'site');
  const first = await build(output);
  const second = await build(output);
  assert.equal(first.version, second.version, 'Unchanged builds must keep their cache version');
  const sw = await readFile(join(output, 'sw.js'), 'utf8');
  assert.ok(!sw.includes('v17-source'), 'Build must stamp an asset-derived cache version');
  const updates=await readFile(join(output,'updates.mjs'),'utf8');
  assert.ok(updates.includes(`export const APP_VERSION='${first.version}';`),'Page and worker must share a release version');
  assert.ok(!updates.includes('v17-source'));
  for (const base of ['/', '/process-design-calculator/']) {
    const origin = 'https://example.github.io';
    async function exists(path) {
      assert.ok(path.startsWith(base), `Route escaped app scope: ${path}`);
      const local = join(output, path.slice(base.length));
      const info = await stat(local);
      if (info.isDirectory()) await stat(join(local, 'index.html'));
    }
    for (const path of ['index.html', 'calculators/index.html', 'settings/index.html', 'steam/index.html', 'ammonia/index.html', 'co2/index.html']) {
      const html = await readFile(join(output, path), 'utf8');
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const target = new URL(match[1], origin + base + path);
        if (target.origin === origin) await exists(target.pathname);
      }
    }
    const manifest = JSON.parse(await readFile(join(output, 'manifest.webmanifest'), 'utf8'));
    const manifestURL = origin + base + 'manifest.webmanifest';
    assert.equal(new URL(manifest.scope, manifestURL).pathname, base);
    for (const path of [manifest.start_url, ...manifest.icons.map(i => i.src), ...manifest.shortcuts.map(s => s.url)]) {
      await exists(new URL(path, manifestURL).pathname);
    }
    const events = {};
    let cachedPaths = [];
    let currentCache;
    const deleted = [];
    const prefix = 'process-design:' + base + ':';
    vm.runInNewContext(sw, {
      URL,
      Request,
      self: {
        location: new URL(origin + base + 'sw.js'),
        addEventListener: (name, handler) => { events[name] = handler; },
        skipWaiting: async () => {},
        clients: { claim: async () => {} },
      },
      caches: {
        open: async name => { currentCache = name; return { addAll: async requests => { assert.ok(requests.every(request => request.cache === 'reload'), 'New offline caches must bypass stale HTTP assets'); cachedPaths = requests.map(request => new URL(request.url).pathname); }, match: async () => 'cached response' }; },
        keys: async () => [prefix + 'old', prefix + first.version, 'unrelated-app-cache'],
        delete: async name => { deleted.push(name); },
      },
      fetch: () => { throw new Error('Expected offline cache response'); },
    });
    let operation;
    events.install({ waitUntil: promise => { operation = promise; } });
    await operation;
    assert.equal(currentCache, prefix + first.version);
    assert.ok(cachedPaths.includes(base + 'engine/coolprop.wasm'));
    assert.ok(cachedPaths.includes(base + 'updates.mjs'),'Update notices must be available in the offline app');
    for (const path of ['co2/', 'co2/index.html', 'co2/app.js', 'co2/calc.js', 'co2/records.js']) assert.ok(cachedPaths.includes(base + path), 'CO₂ asset must work offline: ' + path);
    for (const path of cachedPaths) await exists(path);
    events.activate({ waitUntil: promise => { operation = promise; } });
    await operation;
    assert.deepEqual(deleted, [prefix + 'old'], 'Keep other apps and the current cache');
    let announced;
    events.message({data:{type:'PROCESSCALC_VERSION'},source:{postMessage:message=>{announced=message;}}});
    assert.equal(announced.version,first.version,'Installed pages can detect a newer active cache');
    assert.equal(announced.type,'PROCESSCALC_VERSION');
    let response;
    events.fetch({ request: { method: 'GET', url: origin + base + 'steam/?check=1' }, respondWith: promise => { response = promise; } });
    assert.equal(await response, 'cached response');
    events.fetch({ request: { method: 'GET', url: origin + base + 'co2/?check=1' }, respondWith: promise => { response = promise; } });
    assert.equal(await response, 'cached response');
  }
  console.log('Root and GitHub project URLs, all assets, manifest, scoped offline caches, and repeatable builds passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
