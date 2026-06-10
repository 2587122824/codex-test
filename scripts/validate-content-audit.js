const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const rootDir = path.resolve(__dirname, '..');
const catalogPath = path.join(rootDir, 'src', 'shared', 'content', 'audioCatalog.ts');
const catalogBuffer = fs.readFileSync(catalogPath);
const decoder = new TextDecoder('utf-8', { fatal: true });

const errors = [];
let catalog = '';

try {
  catalog = decoder.decode(catalogBuffer);
} catch (error) {
  errors.push(`audioCatalog.ts is not valid UTF-8: ${error.message}`);
}

const sourcePattern = /const\s+([a-zA-Z0-9_]+)\s*=\s*\{([\s\S]*?)\};/g;
const itemPattern = /\{\s*id:\s*'([^']+)'([\s\S]*?)source:\s*([a-zA-Z0-9_]+),\s*\}/g;
const sourceFields = ['name', 'author', 'license', 'url', 'attributionRequired'];
const counts = {
  music: 0,
  story: 0,
  noise: 0,
  licensedCandidates: 0,
  betaPlaceholders: 0,
  attributionRequired: 0,
};
const minimumCounts = { music: 10, story: 8, noise: 12 };
const minimumTotalItems = 30;
const maximumBetaPlaceholders = 2;
const maximumAudioBytes = 50 * 1024 * 1024;
const sources = new Map();

const readStringField = (body, field) => {
  const match = body.match(new RegExp(`${field}:\\s*'([^']*)'`));
  return match?.[1] ?? '';
};

const hasReplacementArtifacts = (value) =>
  /锟|�|閿熸枻鎷|茂驴陆/.test(value);

const getDirectoryBytes = (directory) => {
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += getDirectoryBytes(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
};

let sourceMatch;
while ((sourceMatch = sourcePattern.exec(catalog)) !== null) {
  const [, sourceName, body] = sourceMatch;
  const source = {
    name: readStringField(body, 'name'),
    author: readStringField(body, 'author'),
    license: readStringField(body, 'license'),
    url: readStringField(body, 'url'),
    attributionRequired: /attributionRequired:\s*true/.test(body),
    complete: true,
  };

  for (const field of sourceFields) {
    if (!new RegExp(`${field}:`).test(body)) {
      source.complete = false;
      errors.push(`${sourceName} is missing source.${field}`);
    }
  }

  for (const field of ['name', 'author', 'license', 'url']) {
    if (!source[field]?.trim()) {
      source.complete = false;
      errors.push(`${sourceName} has empty source.${field}`);
    }
    if (hasReplacementArtifacts(source[field])) {
      errors.push(`${sourceName} source.${field} contains replacement/mojibake artifacts`);
    }
  }

  sources.set(sourceName, source);
}

let itemMatch;
let itemCount = 0;
while ((itemMatch = itemPattern.exec(catalog)) !== null) {
  itemCount += 1;
  const [, id, body, sourceName] = itemMatch;
  const source = sources.get(sourceName);
  const type = readStringField(body, 'type');

  if (['music', 'story', 'noise'].includes(type)) {
    counts[type] += 1;
  } else {
    errors.push(`${id} has invalid type: ${type || 'missing'}`);
  }

  for (const field of ['title', 'description', 'category']) {
    const value = readStringField(body, field);
    if (!value.trim()) {
      errors.push(`${id} has empty ${field}`);
    }
    if (hasReplacementArtifacts(value)) {
      errors.push(`${id} ${field} contains replacement/mojibake artifacts`);
    }
  }

  const captionsReference = body.match(/captions:\s*([a-zA-Z0-9_]+)/)?.[1];
  const inlineCaptions = body.match(/captions:\s*\[([\s\S]*?)\]/)?.[1];
  const captionsBody = captionsReference
    ? catalog.match(new RegExp(`const\\s+${captionsReference}\\s*=\\s*\\[([\\s\\S]*?)\\];`))?.[1]
    : inlineCaptions;

  if (!captionsBody || !/text:\s*'[^']+'/.test(captionsBody)) {
    errors.push(`${id} must have at least one caption or guidance text cue`);
  }
  if (captionsBody && hasReplacementArtifacts(captionsBody)) {
    errors.push(`${id} captions contain replacement/mojibake artifacts`);
  }

  if (!source) {
    errors.push(`${id} references missing source: ${sourceName}`);
    continue;
  }

  if (source.name === 'Internal beta placeholder') {
    counts.betaPlaceholders += 1;
  } else {
    counts.licensedCandidates += 1;
  }

  if (source.attributionRequired) {
    counts.attributionRequired += 1;
  }
}

if (itemCount === 0) {
  errors.push('No audio catalog items found for content audit');
}

if (itemCount < minimumTotalItems) {
  errors.push(`Content audit expected at least ${minimumTotalItems} items, found ${itemCount}`);
}

for (const [type, minimum] of Object.entries(minimumCounts)) {
  if (counts[type] < minimum) {
    errors.push(`Content audit expected at least ${minimum} ${type} items, found ${counts[type]}`);
  }
}

if (counts.licensedCandidates === 0) {
  errors.push('Content audit expected at least one licensed production candidate');
}

if (counts.betaPlaceholders > maximumBetaPlaceholders) {
  errors.push(
    `Content audit allows at most ${maximumBetaPlaceholders} beta placeholder items, found ${counts.betaPlaceholders}`,
  );
}

const audioBytes = getDirectoryBytes(path.join(rootDir, 'assets', 'audio'));

if (audioBytes > maximumAudioBytes) {
  errors.push(
    `Content audit expected local audio assets under ${maximumAudioBytes} bytes, found ${audioBytes} bytes`,
  );
}

if (errors.length > 0) {
  console.error(`Content audit failed (${errors.length}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Content audit passed: ${itemCount} items (${counts.music} music, ${counts.story} story, ${counts.noise} noise), ${counts.licensedCandidates} licensed/original candidates, ${counts.betaPlaceholders} beta placeholders, ${counts.attributionRequired} attribution-required items, ${Math.round(audioBytes / 1024 / 1024)}MB local audio.`,
);
