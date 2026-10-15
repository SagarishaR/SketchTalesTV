const STORIES = {
  magical: {
    title: 'The Little Hero and the Moon Garden',
    scenes: [
      ['A Spark in the Garden', 'One evening, a tiny light appeared in a quiet garden.', 'A glowing enchanted garden under a deep blue night sky.'],
      ['The Lost Star', 'Our little hero discovered a star hiding beneath a flower.', 'A tiny golden star resting among oversized magical flowers.'],
      ['A Helping Hand', 'The hero gently helped the star climb back into the sky.', 'The little hero helping a golden star rise above the garden.'],
      ['The Sky Comes Alive', 'The grateful star filled the garden with sparkling light.', 'Golden sparkles spreading through a moonlit garden.'],
      ['A Magical Goodbye', 'The hero smiled as the star twinkled a special thank-you.', 'A peaceful garden with the hero beneath a sky full of stars.'],
    ],
  },
  funny: {
    title: 'The Great Garden Mix-Up',
    scenes: [
      ['A Funny Morning', 'Our little hero woke up to find a garden full of bouncing vegetables.', 'A colorful playful garden with vegetables bouncing gently.'],
      ['The Runaway Carrot', 'A cheeky carrot rolled away, and the hero hurried after it.', 'A playful carrot rolling along a sunny garden path.'],
      ['The Silly Chase', 'The carrot zigzagged around flowers while everyone giggled.', 'A whimsical garden chase with flowers swaying.'],
      ['Teamwork Wins', 'The hero and the garden friends worked together to catch it.', 'Friendly garden creatures working together around a carrot.'],
      ['A Tasty Surprise', 'Everyone celebrated with a cheerful garden picnic.', 'A bright picnic scene with happy garden friends.'],
    ],
  },
  space: {
    title: 'The Little Hero Among the Stars',
    scenes: [
      ['Lift-Off', 'Our little hero began a gentle journey into colorful space.', 'A small friendly hero floating beside a colorful spaceship.'],
      ['The Lonely Planet', 'A tiny planet blinked because it had no visitors.', 'A small colorful planet surrounded by glowing stars.'],
      ['A Cosmic Friend', 'The hero landed softly and discovered a friendly moon creature.', 'A welcoming alien creature meeting the hero on a bright planet.'],
      ['The Star Bridge', 'Together, they followed a shimmering bridge across the sky.', 'A sparkling bridge stretching between colorful planets.'],
      ['Homeward Bound', 'The hero waved goodbye beneath a beautiful galaxy.', 'A peaceful spaceship sailing through a glowing galaxy.'],
    ],
  },
  animals: {
    title: 'The Little Hero of the Forest',
    scenes: [
      ['A Forest Adventure', 'Our little hero wandered into a welcoming woodland.', 'A lush green woodland filled with warm sunlight.'],
      ['A Tiny Cry', 'A little bird called for help from a low branch.', 'A small bird perched safely on a leafy branch.'],
      ['Forest Friends', 'The hero invited nearby animals to help the bird.', 'Friendly woodland animals gathering around the hero.'],
      ['Back to the Nest', 'Together, the friends helped the bird return to its nest.', 'A bird safely beside its nest among green leaves.'],
      ['Friends Forever', 'The forest friends celebrated their wonderful teamwork.', 'A joyful woodland gathering in golden afternoon light.'],
    ],
  },
};

function generateLocalStory({ genre, characterName = 'little hero' }) {
  const template = STORIES[genre];

  if (!template) {
    throw new Error('Unsupported story genre');
  }

  return {
    title: template.title,
    scenes: template.scenes.map(([title, narration, visualPrompt], index) => ({
      number: index + 1,
      title,
      narration: narration.replace(/our little hero/gi, characterName),
      visualPrompt: `${visualPrompt} Preserve the recognizable appearance of the child's uploaded drawing.`,
      motionPrompt: 'Use the uploaded drawing as the reference character. Preserve its recognizable shape, colors, and features. Animate gentle natural movement with a slow cinematic camera motion. No text or subtitles.',
    })),
  };
}

module.exports = { generateLocalStory };