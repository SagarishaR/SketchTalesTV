const {execFile} = require('child_process');
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = promisify(execFile);
const audioDir = path.join(__dirname, 'public', 'audio');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const MUSIC_FILE = path.join(
  audioDir,
  'sonican-children-piano-loop-gentle-care-351582.mp3',
);
const MUSIC_VOLUME = 0.20;

// Creates narration audio for one scene, mixing in gentle background music.
// The narration remains the main focus; music is mixed at 8% volume.
async function narrate(text, filename) {
  fs.mkdirSync(audioDir, {recursive: true});

  const base = path.basename(filename).replace(/\.[^.]+$/, '');
  const aiff = path.join(audioDir, `${base}.aiff`);
  const mp3 = path.join(audioDir, `${base}.mp3`);
  const mixedMp3 = path.join(audioDir, `${base}-mixed.mp3`);
  const m4a = path.join(audioDir, `${base}.m4a`);

  await execFileAsync('/usr/bin/say', ['-v', 'Samantha', '-o', aiff, text]);

  try {
    if (fs.existsSync(MUSIC_FILE)) {
      try {
        await execFileAsync(FFMPEG, [
          '-y',
          '-loglevel', 'error',
          '-i', aiff,
          '-stream_loop', '-1',
          '-i', MUSIC_FILE,
          '-filter_complex',
          `[1:a]volume=${MUSIC_VOLUME}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
          '-map', '[aout]',
          '-ac', '2',
          '-ar', '44100',
          '-b:a', '128k',
          mixedMp3,
        ]);

        fs.renameSync(mixedMp3, mp3);
        console.log(`[narrate] ${base}.mp3 created with background music`);
        return `/audio/${base}.mp3`;
      } catch (mixError) {
        console.warn(
          `[narrate] Music mixing failed (${mixError.message}); creating narration without music`,
        );
      }
    } else {
      console.warn('[narrate] Background music file not found; using narration only');
    }

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
      console.log(`[narrate] ${base}.mp3 created without background music`);
      return `/audio/${base}.mp3`;
    } catch (ffmpegError) {
      console.warn(
        `[narrate] ffmpeg failed (${ffmpegError.code || ffmpegError.message}); falling back to M4A`,
      );
      await execFileAsync('/usr/bin/afconvert', [
        '-f', 'm4af',
        '-d', 'aac',
        aiff,
        m4a,
      ]);
      console.log(`[narrate] ${base}.m4a created (fallback)`);
      return `/audio/${base}.m4a`;
    }
  } finally {
    fs.unlink(aiff, () => {});
    fs.unlink(mixedMp3, () => {});
  }
}

module.exports = {narrate};
