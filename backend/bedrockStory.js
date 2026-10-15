
const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  // Uses AWS_PROFILE=sketchtales if set in the environment.
  // Otherwise, uses the standard AWS SDK credential chain.
});

async function generateStory({ genre, characterName = 'little hero' }) {
  const allowedGenres = ['magical', 'funny', 'space', 'animals'];

  if (!allowedGenres.includes(genre)) {
    throw new Error('Unsupported story genre');
  }

  const prompt = `
Create an original, child-friendly story for ages 5–8.

Character name: ${characterName}
Genre: ${genre}

Return ONLY valid JSON with this structure:
{
  "title": "Story title",
  "scenes": [
    {
      "number": 1,
      "title": "Scene title",
      "narration": "One or two short sentences for narration.",
      "visualPrompt": "Detailed visual description for image-to-video.",
      "motionPrompt": "Specific, gentle motion instructions for the character and camera."
    }
  ]
}

Requirements:
- Exactly 5 scenes that form one coherent story.
- Make the story original, not a fixed template.
- Keep the character visually consistent across all scenes.
- Each visualPrompt must describe the setting and action.
- Each motionPrompt must tell a video model how to animate the provided reference drawing.
- Preserve the reference character's recognizable appearance.
- Avoid text, subtitles, logos, frightening scenes, and dangerous actions.
- Use simple language and age-appropriate adventures.
`;

  const response = await client.send(
    new ConverseCommand({
      modelId: 'global.amazon.nova-2-lite-v1:0',
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 1800,
        temperature: 0.8,
      },
    }),
  );

  const text = response.output?.message?.content
    ?.filter((item) => item.text)
    .map((item) => item.text)
    .join('');

  if (!text) {
    throw new Error('Bedrock returned an empty story');
  }

  const jsonText = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const story = JSON.parse(jsonText);

  if (
    typeof story.title !== 'string' ||
    !Array.isArray(story.scenes) ||
    story.scenes.length !== 5 ||
    story.scenes.some(
      (scene, index) =>
        scene.number !== index + 1 ||
        typeof scene.narration !== 'string' ||
        typeof scene.visualPrompt !== 'string' ||
        typeof scene.motionPrompt !== 'string',
    )
  ) {
    throw new Error('Bedrock returned an invalid story structure');
  }

  return {
    title: story.title,
    scenes: story.scenes,
  };
}

module.exports = { generateStory };
