import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertSupportedNodeVersion, isSupportedNodeVersion } from './node-version-policy.mjs';

for (const version of ['22.23.4', '22.23.5', '22.24.0', '24.22.1', '24.22.2', '24.23.0', '26.12.1', '26.12.2', '26.13.0']) {
  test(`accepts patched stable ${version}`, () => {
    assert.equal(isSupportedNodeVersion(version), true);
    assert.doesNotThrow(() => assertSupportedNodeVersion(version));
  });
}

for (const version of ['18.20.8', '20.99.99', '21.9.9', '22.0.0', '22.22.99', '22.23.3', '23.99.99', '24.19.0', '24.21.99', '24.22.0', '25.99.99', '26.11.99', '26.12.0', '27.0.0', '28.0.0', '22.23.4-rc.1', '24.22.1-nightly20261021', '26.12.1+custom', 'v22.23.4', '022.23.4', '22.023.4', '22.23.04', '22.23', '22.23.4.0', '22.23.4\n', ' 22.23.4', '', null, undefined, 22, '22.999999999999999999999.0']) {
  test(`rejects unsupported or malformed ${JSON.stringify(version)}`, () => {
    assert.equal(isSupportedNodeVersion(version), false);
    assert.throws(() => assertSupportedNodeVersion(version), /Unsupported Node.js/);
  });
}

test('the executable guard uses the actual process version, not arguments or environment hints', () => {
  const result = spawnSync(process.execPath, [new URL('./check-node-version.mjs', import.meta.url).pathname, '--node-version=22.23.4'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_VERSION: '22.23.4', npm_config_node_version: '22.23.4' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, isSupportedNodeVersion(process.versions.node) ? 0 : 1);
  if (!isSupportedNodeVersion(process.versions.node)) {
    assert.ok(result.stderr.includes(`Unsupported Node.js ${process.versions.node}`));
  }
});

test('the startup guard runs before a later module can have side effects', () => {
  const guard = new URL('./check-node-version.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import ${JSON.stringify(guard)}; console.log('AFTER_GUARD');`], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, isSupportedNodeVersion(process.versions.node) ? 0 : 1);
  assert.equal(result.stdout.includes('AFTER_GUARD'), isSupportedNodeVersion(process.versions.node));
});

test('developer pins and package support ranges stay in sync', () => {
  for (const filename of ['../.nvmrc', '../.node-version']) {
    assert.equal(readFileSync(new URL(filename, import.meta.url), 'utf8').trim(), '22.23.4');
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.engines.node, '^22.23.4 || ^24.22.1 || ^26.12.1');
});

test('published CLI carries the same self-contained runtime policy', () => {
  for (const name of ['node-version-policy.mjs', 'check-node-version.mjs']) {
    assert.equal(readFileSync(new URL(`../apps/cli/lib/${name}`, import.meta.url), 'utf8'), readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
  }
  const entry = readFileSync(new URL('../apps/cli/noxhere.mjs', import.meta.url), 'utf8');
  assert.ok(entry.startsWith("#!/usr/bin/env node\nimport './lib/check-node-version.mjs';"));
});
