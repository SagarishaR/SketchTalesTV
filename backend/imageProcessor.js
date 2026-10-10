const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function extractCharacter(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'extract_character.py');

    const child = spawn(pythonPath, [
      scriptPath,
      inputPath,
      outputPath,
    ]);

    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Image extraction exited with code ${code}`));
      }
    });
  });
}

async function processDrawing(buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sketchtales-'));
  const inputPath = path.join(tempDir, 'input.png');
  const outputPath = path.join(tempDir, 'character.png');

  try {
    await fs.writeFile(inputPath, buffer);
    await extractCharacter(inputPath, outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(tempDir, {recursive: true, force: true});
  }
}

module.exports = {processDrawing};
