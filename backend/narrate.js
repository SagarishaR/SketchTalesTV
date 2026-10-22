
const {execFile} = require('child_process');
const {promisify} = require('util');
const path = require('path');
const fs = require('fs');
const {PollyClient, SynthesizeSpeechCommand} = require('@aws-sdk/client-polly');

const execFileAsync = promisify(execFile);
const audioDir = path.join(__dirname, 'public', 'audio');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const MUSIC_FILE = path.join(
  audioDir,
  'sonican-children-piano-loop-gentle-care-351582.mp3',
);
const MUSIC_VOLUME = 0.08;

const polly = new PollyClient({
  region:
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'ap-south-1',
});

async function narrate(text, filename) {
  fs.mkdirSync(audioDir, {recursive: true});

  const base = path.basename(filename).replace(/\.[^.]+$/, '');
  const voiceMp3 = path.join(audioDir, `${base}-voice.mp3`);
  const aiff = path.join(audioDir, `${base}.aiff`);
  const mp3 = path.join(audioDir, `${base}.mp3`);
  const mixedMp3 = path.join(audioDir, `${base}-mixed.mp3`);
  const m4a = path.join(audioDir, `${base}.m4a`);

  let narrationFile = voiceMp3;
  let isPolly = false;

  // Try AWS Polly first. If it fails, fall back to macOS Samantha.
  try {
    const response = await polly.send(
      new SynthesizeSpeechCommand({
        Text: String(text),
        OutputFormat: 'mp3',
        VoiceId: process.env.POLLY_VOICE_ID || 'Ivy',
        Engine: process.env.POLLY_ENGINE || 'neural',
        LanguageCode: process.env.POLLY_LANGUAGE_CODE || 'en-US',
      }),
    );

    if (!response.AudioStream) {
      throw new Error('Polly returned no audio stream');
    }

    const audioBytes = await response.AudioStream.transformToByteArray();
    await fs.promises.writeFile(voiceMp3, audioBytes);
    isPolly = true;
    console.log(`[narrate] ${base}: AWS Polly narration created`);
  } catch (error) {
    console.warn(
      `[narrate] Polly failed (${error.message}); falling back to Samantha`,
    );

    await execFileAsync('/usr/bin/say', [
      '-v', 'Samantha',
      '-o', aiff,
      String(text),
    ]);

    narrationFile = aiff;
  }

  try {
    // Mix narration with the existing background music when available.
    if (fs.existsSync(MUSIC_FILE)) {
      try {
        await execFileAsync(FFMPEG, [
          '-y',
          '-loglevel', 'error',
          '-i', narrationFile,
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
      } catch (error) {
        console.warn(
          `[narrate] Music mixing failed (${error.message}); using narration only`,
        );
      }
    } else {
      console.warn('[narrate] Background music file not found');
    }

    // Create an MP3 without music if mixing is unavailable.
    try {
      if (isPolly) {
        await fs.promises.copyFile(voiceMp3, mp3);
      } else {
        await execFileAsync(FFMPEG, [
          '-y',
          '-loglevel', 'error',
          '-i', aiff,
          '-ac', '2',
          '-ar', '44100',
          '-b:a', '128k',
          mp3,
        ]);
      }

      console.log(`[narrate] ${base}.mp3 created without music`);
      return `/audio/${base}.mp3`;
    } catch (error) {
      // M4A fallback is available for the macOS-generated narration.
      if (isPolly) {
        throw error;
      }

      console.warn(
        `[narrate] MP3 conversion failed (${error.message}); falling back to M4A`,
      );

      await execFileAsync('/usr/bin/afconvert', [
        '-f', 'm4af',
        '-d', 'aac',
        aiff,
        m4a,
      ]);

      console.log(`[narrate] ${base}.m4a created`);
      return `/audio/${base}.m4a`;
    }
  } finally {
    for (const file of [voiceMp3, aiff, mixedMp3]) {
      fs.unlink(file, () => {});
    }
  }
}

module.exports = {narrate};
