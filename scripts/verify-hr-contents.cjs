const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const temporary = fs.mkdtempSync(path.join(root, '.hr-smoke-'));
const sourceContents = require(path.join(root, 'src/data/hr-contents.json'));
const distributedContents = require(path.join(root, 'dist/data/hr-contents.json'));
const originalFetch = globalThis.fetch;
const originalInterval = globalThis.setInterval;
let fetchCalls = 0;
let timerCalls = 0;

async function main() {
  assert.equal(distributedContents.length, 96);
  assert.deepEqual(distributedContents, sourceContents);
  fs.mkdirSync(path.join(temporary, 'services'));
  fs.mkdirSync(path.join(temporary, 'data'));
  for (const name of ['services/hrContentService.js', 'data/hr-contents.json']) {
    fs.copyFileSync(path.join(root, 'dist', name), path.join(temporary, name));
  }
  globalThis.fetch = () => {
    fetchCalls++;
    throw new Error('Network forbidden during compiled smoke');
  };
  globalThis.setInterval = () => {
    timerCalls++;
    throw new Error('Timers forbidden during compiled smoke');
  };
  process.chdir(temporary);
  const { hrContentService } = require(path.join(temporary, 'services/hrContentService.js'));
  await hrContentService.initialize();
  assert.ok(distributedContents.includes(hrContentService.getRandomContent()));
  hrContentService.stop();
  assert.equal(fetchCalls, 0);
  assert.equal(timerCalls, 0);
  console.log(`Compiled smoke passed on ${process.version}: 96 entries equal, isolated cwd, fetch=0, timers=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalInterval;
  fs.rmSync(temporary, { recursive: true, force: true });
});
