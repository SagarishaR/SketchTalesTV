const {execFile} = require('child_process');
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);
const audioDir = path.join(__dirname, 'public', 'audio');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// Creates narration audio for one scene and returns its URL path.
// 1) macOS `say` makes an AIFF file (the Vega player cannot play AIFF).
// 2) ffmpeg converts it to MP3 (the format already proven to play on Vega).
// 3) If ffmpeg is missing or fails, macOS `afconvert` makes an AAC .m4a instead.
async function narrate(text, filename) {
  fs.mkdirSync(audioDir, {recursive: true});

  const base = path.basename(filename).replace(/\.[^.]+$/, '');
  const aiff = path.join(audioDir, `${base}.aiff`);
  const mp3 = path.join(audioDir, `${base}.mp3`);
  const m4a = path.join(audioDir, `${base}.m4a`);

  await execFileAsync('/usr/bin/say', ['-v', 'Samantha', '-o', aiff, text]);

  try {
    try {
      await execFileAsync(FFMPEG, [
        '-y',
        '-loglevel', 'error',
        '-i', aiff,
        '-ac', '2',
        '-ar', '44100',
        '-b:a', '128k',
        mp3,
      ]);
      console.log(`[narrate] ${base}.mp3 created`);
      return `/audio/${base}.mp3`;
    } catch (ffmpegError) {
      console.warn(
        `[narrate] ffmpeg unavailable or failed (${ffmpegError.code || ffmpegError.message}); falling back to M4A`,
      );
      await execFileAsync('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', aiff, m4a]);
      console.log(`[narrate] ${base}.m4a created (fallback)`);
      return `/audio/${base}.m4a`;
    }
  } finally {
    fs.unlink(aiff, () => {});
  }
}

module.exports = {narrate};