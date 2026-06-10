const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const audioDir = path.join(rootDir, 'assets', 'audio');
const sampleRate = 16000;

const ensureDir = (relativeDir) => {
  fs.mkdirSync(path.join(audioDir, relativeDir), { recursive: true });
};

const clamp16 = (value) => Math.max(-1, Math.min(1, value));

const writeWav = (relativePath, samples) => {
  const filePath = path.join(audioDir, relativePath);
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(clamp16(samples[index]) * 32767), 44 + index * 2);
  }

  fs.writeFileSync(filePath, buffer);
};

const envelope = (position, total, attack = 1.2, release = 2.5) => {
  const time = position / sampleRate;
  const remaining = (total - position) / sampleRate;
  return Math.min(1, time / attack, remaining / release);
};

const makePad = ({ seconds, base, harmonics, pulse = 0.05 }) => {
  const total = Math.floor(seconds * sampleRate);
  const samples = new Array(total);
  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate;
    const env = envelope(index, total);
    const drift = Math.sin(2 * Math.PI * 0.025 * t) * 0.4;
    const tone = harmonics.reduce((sum, ratio, harmonicIndex) => {
      const freq = base * ratio + drift;
      const phase = 2 * Math.PI * freq * t;
      return sum + Math.sin(phase) * (0.23 / (harmonicIndex + 1));
    }, 0);
    const slowPulse = 1 - pulse + Math.sin(2 * Math.PI * 0.08 * t) * pulse;
    samples[index] = tone * env * slowPulse;
  }
  return samples;
};

const makeChimes = ({ seconds, root }) => {
  const total = Math.floor(seconds * sampleRate);
  const samples = new Array(total).fill(0);
  const notes = [1, 1.25, 1.5, 2, 2.5, 3];
  for (let hit = 0; hit < seconds / 4; hit += 1) {
    const start = Math.floor((hit * 4 + 1.2) * sampleRate);
    const note = root * notes[hit % notes.length];
    for (let offset = 0; offset < sampleRate * 3 && start + offset < total; offset += 1) {
      const t = offset / sampleRate;
      const amp = Math.exp(-t * 1.25) * 0.18;
      samples[start + offset] += Math.sin(2 * Math.PI * note * t) * amp;
      samples[start + offset] += Math.sin(2 * Math.PI * note * 2.01 * t) * amp * 0.35;
    }
  }
  const bed = makePad({ seconds, base: root / 3, harmonics: [1, 1.5, 2], pulse: 0.02 });
  return samples.map((sample, index) => clamp16(sample + bed[index] * 0.42));
};

let seed = 42;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

const makeNoise = ({ seconds, color, tone = 0 }) => {
  const total = Math.floor(seconds * sampleRate);
  const samples = new Array(total);
  let brown = 0;
  let pink = 0;
  for (let index = 0; index < total; index += 1) {
    const t = index / sampleRate;
    const white = random() * 2 - 1;
    brown = (brown + 0.025 * white) / 1.025;
    pink = 0.92 * pink + 0.08 * white;
    const base = color === 'brown' ? brown * 3.4 : color === 'pink' ? pink * 1.7 : white * 0.2;
    const shaping = tone ? Math.sin(2 * Math.PI * tone * t) * 0.035 : 0;
    const wave = base * (0.85 + Math.sin(2 * Math.PI * 0.045 * t) * 0.08) + shaping;
    samples[index] = clamp16(wave * envelope(index, total, 0.8, 1.8));
  }
  return samples;
};

const makeRain = ({ seconds }) => {
  const base = makeNoise({ seconds, color: 'pink' });
  return base.map((sample, index) => {
    const drop = random() > 0.992 ? (random() * 2 - 1) * 0.45 : 0;
    const t = index / sampleRate;
    return clamp16(sample * 0.55 + drop + Math.sin(2 * Math.PI * 6 * t) * 0.015);
  });
};

const makeCreek = ({ seconds }) => {
  const base = makeNoise({ seconds, color: 'pink', tone: 170 });
  return base.map((sample, index) => {
    const t = index / sampleRate;
    const bubble = Math.sin(2 * Math.PI * (260 + Math.sin(t * 2) * 40) * t) * 0.025;
    return clamp16(sample * 0.42 + bubble);
  });
};

const makeFan = ({ seconds }) => {
  const base = makeNoise({ seconds, color: 'brown', tone: 82 });
  return base.map((sample, index) => {
    const t = index / sampleRate;
    return clamp16(sample * 0.58 + Math.sin(2 * Math.PI * 48 * t) * 0.055);
  });
};

const makeStoryAudio = (relativePath, text) => {
  const outputPath = path.join(audioDir, relativePath);
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "$synth.SelectVoice('Microsoft Huihui Desktop')",
    '$synth.Rate = -3',
    '$synth.Volume = 82',
    `$synth.SetOutputToWaveFile('${outputPath.replace(/'/g, "''")}')`,
    `$synth.Speak('${text.replace(/'/g, "''")}')`,
    '$synth.Dispose()',
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    stdio: 'inherit',
  });
};

ensureDir('music');
ensureDir('noise');
ensureDir('stories');

writeWav('music/soft-piano-loop.wav', makePad({ seconds: 50, base: 110, harmonics: [1, 1.5, 2, 3], pulse: 0.03 }));
writeWav('music/warm-drone.wav', makePad({ seconds: 60, base: 82.4, harmonics: [1, 1.25, 1.5, 2], pulse: 0.02 }));
writeWav('music/slow-chimes.wav', makeChimes({ seconds: 52, root: 176 }));
writeWav('music/night-strings.wav', makePad({ seconds: 58, base: 98, harmonics: [1, 1.333, 1.5, 2], pulse: 0.04 }));
writeWav('music/floating-pad.wav', makePad({ seconds: 56, base: 123.5, harmonics: [1, 1.2, 1.5, 2.4], pulse: 0.025 }));

writeWav('noise/brown-bed.wav', makeNoise({ seconds: 55, color: 'brown' }));
writeWav('noise/pink-soft.wav', makeNoise({ seconds: 55, color: 'pink' }));
writeWav('noise/forest-night.wav', makeNoise({ seconds: 52, color: 'pink', tone: 540 }));
writeWav('noise/creek-stones.wav', makeCreek({ seconds: 54 }));
writeWav('noise/soft-wind.wav', makeNoise({ seconds: 50, color: 'brown', tone: 115 }));
writeWav('noise/distant-thunder.wav', makeRain({ seconds: 56 }));
writeWav('noise/room-fan.wav', makeFan({ seconds: 55 }));

makeStoryAudio('stories/body-scan.wav', '现在，从额头开始放松。眼睛不用再用力。肩膀慢慢沉下来。手臂放在舒服的位置。胸口保持柔软。腹部跟着呼吸轻轻起伏。腿也可以休息了。今晚你只需要躺在这里。');
makeStoryAudio('stories/breath-countdown.wav', '我们从五次呼吸开始。吸气，五。呼气，松一点。吸气，四。呼气，慢一点。吸气，三。把白天放远。吸气，二。身体更安静。最后一次吸气，一。现在可以睡了。');
makeStoryAudio('stories/midnight-return.wav', '如果你在半夜醒来，没关系。先确认自己是安全的。把手机放远一点。听见声音，也听见呼吸。你不需要马上睡着，只需要重新躺好，让身体慢慢回到夜里。');
makeStoryAudio('stories/lake-lantern.wav', '湖面上有一盏很小的灯。它不刺眼，只是在远处轻轻亮着。你坐在岸边，看它随着水波慢慢摇晃。每一次摇晃，都带走一点紧绷。夜晚很宽，你可以休息。');
makeStoryAudio('stories/garden-path.wav', '有一条安静的小路，通向夜里的花园。脚步很轻，空气很软。路边的灯一盏一盏暗下来。你不用记住方向，只要跟着这条路，走进一个舒服的梦。');

console.log('Generated beta audio assets.');
