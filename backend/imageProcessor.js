const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Runs one of the Python scripts in this folder with the project's virtual environment.
function runPython(scriptName, args) {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
    const scriptPath = path.join(__dirname, scriptName);

    const child = spawn(pythonPath, [scriptPath, ...args]);

    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `${scriptName} exited with code ${code}`));
      }
    });
  });
}

function extractCharacter(inputPath, outputPath) {
  return runPython('extract_character.py', [inputPath, outputPath]);
}

// Colours in uncoloured line art (pencil / pen) with a soft palette. Drawings that are already
// coloured are left untouched by the script. Set COLORIZE=off to skip this step.
// If anything goes wrong the plain cutout is used, so a story is never blocked by this step.
async function colorizeCharacter(cutoutPath, outputPath) {
  const seed = String(Math.floor(Math.random() * 100000));
  await runPython('colorize_character.py', [cutoutPath, outputPath, '--palette', 'auto', '--seed', seed]);
}

async function processDrawing(buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sketchtales-'));
  const inputPath = path.join(tempDir, 'input.png');
  const outputPath = path.join(tempDir, 'character.png');
  const colouredPath = path.join(tempDir, 'character-coloured.png');

  try {
    await fs.writeFile(inputPath, buffer);
    await extractCharacter(inputPath, outputPath);

    if (process.env.COLORIZE !== 'off') {
      try {
        await colorizeCharacter(outputPath, colouredPath);
        return await fs.readFile(colouredPath);
      } catch (error) {
        console.warn('[imageProcessor] colouring skipped:', String(error.message).trim().split('\n').pop());
      }
    }

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true});
  }
}

module.exports = {processDrawing};