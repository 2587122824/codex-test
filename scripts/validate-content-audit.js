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
  licensedCandidates: 0,
  betaPlaceholders: 0,
  attributionRequired: 0,
};
const sources = new Map();

const readStringField = (body, field) => {
  const match = body.match(new RegExp(`${field}:\\s*'([^']*)'`));
  return match?.[1] ?? '';
};

const hasReplacementArtifacts = (value) =>
  /�|\uFFFD|锟斤拷|ï¿½/.test(value);

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

if (counts.licensedCandidates === 0) {
  errors.push('Content audit expected at least one licensed production candidate');
}

if (counts.betaPlaceholders === 0) {
  errors.push('Content audit expected at least one beta placeholder item to track before public release');
}

if (errors.length > 0) {
  console.error(`Content audit failed (${errors.length}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Content audit passed: ${itemCount} items, ${counts.licensedCandidates} licensed candidates, ${counts.betaPlaceholders} beta placeholders, ${counts.attributionRequired} attribution-required items.`,
);
