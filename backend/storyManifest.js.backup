const SCENE_DURATION_SECONDS = 30;

const ENVIRONMENTS = {
  magical: {
    setting: 'enchanted garden',
    palette: ['emerald green', 'moonlit blue', 'warm gold'],
    atmosphere: 'gentle magical glow',
  },
  funny: {
    setting: 'playful garden',
    palette: ['bright green', 'sunshine yellow', 'coral'],
    atmosphere: 'cheerful and whimsical',
  },
  space: {
    setting: 'colorful outer space',
    palette: ['deep indigo', 'cosmic violet', 'starlight cyan'],
    atmosphere: 'wonder-filled cosmic adventure',
  },
  animals: {
    setting: 'lush woodland',
    palette: ['forest green', 'moss', 'sunlit gold'],
    atmosphere: 'warm and welcoming',
  },
};

function buildStoryManifest(story, characterName = 'your little hero') {
  if (!story || !Array.isArray(story.scenes)) {
    throw new Error('A story with scenes is required');
  }

  const environmentDefaults = ENVIRONMENTS[story.genre] || ENVIRONMENTS.magical;

  const scenes = story.scenes.map((scene, index) => ({
    ...scene,
    environment: {
      ...environmentDefaults,
      description: scene.visualPrompt,
      sceneNumber: index + 1,
      continuity: index === 0
        ? 'Establish the world and introduce the hero.'
        : 'Continue naturally from the previous scene while creating a distinct setting.',
    },
    characterAction: {
      subject: characterName,
      action: scene.narration,
      emotionalBeat: index === 0
        ? 'curiosity'
        : index === story.scenes.length - 1
          ? 'happiness and closure'
          : 'discovery and helpfulness',
    },
    camera: {
      framing: index === 0 ? 'wide establishing shot' : 'medium cinematic shot',
      movement: index % 2 === 0 ? 'slow push-in' : 'gentle lateral tracking',
    },
    durationSeconds: SCENE_DURATION_SECONDS,
  }));

  return {
    ...story,
    schemaVersion: 1,
    targetDurationSeconds: scenes.reduce(
      (total, scene) => total + scene.durationSeconds,
      0,
    ),
    scenes,
  };
}

module.exports = { buildStoryManifest };
