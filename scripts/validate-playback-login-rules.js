const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.tmp', 'validate-playback-login-rules');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

execFileSync(
  process.execPath,
  [
    tscBin,
    '--target',
    'ES2020',
    '--module',
    'commonjs',
    '--esModuleInterop',
    '--skipLibCheck',
    '--ignoreConfig',
    '--outDir',
    outDir,
    path.join(root, 'src/features/account/phone.ts'),
    path.join(root, 'src/features/player/playbackRules.ts'),
  ],
  { cwd: root, stdio: 'inherit' },
);

const { normalizeChinaPhoneInput } = require(path.join(outDir, 'features/account/phone.js'));
const {
  addTrackToHistory,
  defaultPlaybackMode,
  getNextPlaybackIndex,
  getPreviousPlaybackIndex,
  historyLimit,
} = require(path.join(outDir, 'features/player/playbackRules.js'));

assert.equal(defaultPlaybackMode, 'repeat-all');

assert.equal(normalizeChinaPhoneInput('13900000626'), '+8613900000626');
assert.equal(normalizeChinaPhoneInput('139 0000 0626'), '+8613900000626');
assert.equal(normalizeChinaPhoneInput('139-0000-0626'), '+8613900000626');
assert.equal(normalizeChinaPhoneInput('8613900000626'), '+8613900000626');
assert.equal(normalizeChinaPhoneInput('+8613900000626'), '+8613900000626');
assert.equal(normalizeChinaPhoneInput('+14155552671'), '+14155552671');
assert.equal(normalizeChinaPhoneInput('12900000626'), null);
assert.equal(normalizeChinaPhoneInput('1390000062'), null);

assert.equal(getNextPlaybackIndex({ queueLength: 3, currentIndex: 0, mode: 'repeat-one' }), 0);
assert.equal(
  getNextPlaybackIndex({ queueLength: 3, currentIndex: 0, mode: 'repeat-one', repeatOneReturnsCurrent: false }),
  1,
);
assert.equal(getNextPlaybackIndex({ queueLength: 3, currentIndex: 0, mode: 'sequential' }), 1);
assert.equal(getNextPlaybackIndex({ queueLength: 3, currentIndex: 2, mode: 'sequential' }), null);
assert.equal(getNextPlaybackIndex({ queueLength: 3, currentIndex: 2, mode: 'repeat-all' }), 0);
assert.equal(getNextPlaybackIndex({ queueLength: 0, currentIndex: 0, mode: 'repeat-all' }), null);
assert.equal(getNextPlaybackIndex({ queueLength: 3, currentIndex: 1, mode: 'shuffle', random: () => 0.9 }), 2);
assert.equal(getNextPlaybackIndex({ queueLength: 1, currentIndex: 0, mode: 'shuffle', random: () => 0.9 }), 0);

assert.equal(getPreviousPlaybackIndex({ queueLength: 3, currentIndex: 0, mode: 'sequential' }), null);
assert.equal(getPreviousPlaybackIndex({ queueLength: 3, currentIndex: 2, mode: 'sequential' }), 1);
assert.equal(getPreviousPlaybackIndex({ queueLength: 3, currentIndex: 0, mode: 'repeat-all' }), 2);
assert.equal(getPreviousPlaybackIndex({ queueLength: 3, currentIndex: 1, mode: 'shuffle', random: () => 0 }), 0);

assert.deepEqual(addTrackToHistory(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
assert.deepEqual(
  addTrackToHistory(Array.from({ length: historyLimit }, (_, index) => `track-${index}`), 'new-track'),
  ['new-track', 'track-0', 'track-1', 'track-2', 'track-3', 'track-4', 'track-5', 'track-6', 'track-7', 'track-8', 'track-9', 'track-10'],
);

fs.rmSync(outDir, { recursive: true, force: true });

console.log('Playback mode, recent history, and China-default login validation passed.');
