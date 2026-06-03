const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const catalogPath = path.join(rootDir, 'src', 'shared', 'content', 'audioCatalog.ts');
const catalog = fs.readFileSync(catalogPath, 'utf8');

const errors = [];
const ids = new Set();
const counts = { music: 0, story: 0, noise: 0 };
const minimumCounts = { music: 10, story: 8, noise: 12 };

const itemPattern = /\{\s*id:\s*'([^']+)'([\s\S]*?)source:\s*([a-zA-Z0-9_]+),\s*\}/g;
const requiredFields = ['type', 'title', 'description', 'duration', 'category', 'asset', 'cover'];
let match;

const hasOggSkeleton = (assetPath) => {
  if (!assetPath.toLowerCase().endsWith('.ogg')) {
    return false;
  }

  const bytes = fs.readFileSync(assetPath);
  return bytes.includes(Buffer.from('fishead'));
};

while ((match = itemPattern.exec(catalog)) !== null) {
  const [, id, body, sourceName] = match;

  if (ids.has(id)) {
    errors.push(`Duplicate audio id: ${id}`);
  }
  ids.add(id);

  for (const field of requiredFields) {
    if (!new RegExp(`${field}:`).test(body)) {
      errors.push(`${id} is missing ${field}`);
    }
  }

  const typeMatch = body.match(/type:\s*'([^']+)'/);
  const type = typeMatch?.[1];
  if (!['music', 'story', 'noise'].includes(type)) {
    errors.push(`${id} has invalid type: ${type ?? 'missing'}`);
  } else {
    counts[type] += 1;
  }

  const durationMatch = body.match(/duration:\s*(\d+)/);
  if (!durationMatch || Number(durationMatch[1]) <= 0) {
    errors.push(`${id} must have a positive duration`);
  }

  const assetMatch = body.match(/asset:\s*require\('([^']+)'\)/);
  if (!assetMatch) {
    errors.push(`${id} must use a local require(...) asset`);
  } else {
    const assetPath = path.resolve(path.dirname(catalogPath), assetMatch[1]);
    if (!fs.existsSync(assetPath)) {
      errors.push(`${id} asset does not exist: ${assetMatch[1]}`);
    } else if (hasOggSkeleton(assetPath)) {
      errors.push(`${id} asset uses Ogg Skeleton metadata, which can stall Android playback: ${assetMatch[1]}`);
    }
  }

  const sourcePattern = new RegExp(
    `const\\s+${sourceName}\\s*=\\s*\\{[\\s\\S]*?name:[\\s\\S]*?author:[\\s\\S]*?license:[\\s\\S]*?url:[\\s\\S]*?attributionRequired:[\\s\\S]*?\\}`,
  );
  if (!sourcePattern.test(catalog)) {
    errors.push(`${id} references incomplete source: ${sourceName}`);
  }
}

for (const [type, minimum] of Object.entries(minimumCounts)) {
  if (counts[type] < minimum) {
    errors.push(`${type} needs at least ${minimum} beta items, found ${counts[type]}`);
  }
}

if (ids.size === 0) {
  errors.push('No audio catalog items found');
}

if (errors.length > 0) {
  console.error(`Audio catalog validation failed (${errors.length}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Audio catalog validation passed: ${counts.music} music, ${counts.story} story, ${counts.noise} noise items.`,
);
