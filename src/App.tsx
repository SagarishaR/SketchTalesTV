import {
  AudioPlayer,
  VideoPlayer,
  KeplerVideoSurfaceView,
} from '@amazon-devices/react-native-w3cmedia';

import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Your Mac's address on your Wi-Fi. Get it by running:  ipconfig getifaddr en0
// Change this one line if the address printed there is different.
// NOTE: a Cloudflare quick-tunnel address changes every time the tunnel restarts.
const API_BASE = 'https://flag-consequence-duplicate-scientists.trycloudflare.com';

// To test the player on its own, paste any https .mp3 link here
// (for example https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3).
// Leave it as '' for normal use.
const AUDIO_TEST_URL = '';
const LOCAL_SCENE_VIDEO = `${API_BASE}/scenes/complete-crystal-bell-story.mp4`;

// true  = play the MP4 film on the video surface (the film draws over the PNG backgrounds).
// false = in-app stage: scene background images + the animated hero (the old fallback).
const USE_VIDEO = false;

// Genres shown on the selection screen. Add 'funny' and 'animals' back
// once you have matching artwork for them.
const ENABLED_GENRES = ['magical'];

// Seconds-based fallbacks, in milliseconds.
const FALLBACK_SCENE_MS = 12000; // used when a scene has no audio or audio fails
const MAX_SCENE_MS = 60000; // safety net so a stuck audio file never freezes the story

// Keep content away from the screen edges (TV safe area).
const SAFE = 40;

// ---------------------------------------------------------------------------
// Artwork
// ---------------------------------------------------------------------------

// Metro needs static require() paths, so every image is listed explicitly.
const BG = {
  forest: require('../backend/public/scenes/scene-1-dinosaur-valley.png'),
  river: require('../backend/public/scenes/scene-2-crystal-bell.png'),
  cave: require('../backend/public/scenes/scene-3-dragon-friend.png'),
  castle: require('../backend/public/scenes/scene-4-gentle-wind.png'),
  celebration: require('../backend/public/scenes/scene-5-friendship-festival.png'),
};

const DEFAULT_ART = [BG.forest, BG.river, BG.cave, BG.castle, BG.celebration];

// One list of five backgrounds per genre. Until your new illustrations exist,
// every genre uses the default set. When they do, replace a line like this:
//
//   magical: [
//     require('../backend/public/scenes/magical/1.png'),
//     require('../backend/public/scenes/magical/2.png'),
//     require('../backend/public/scenes/magical/3.png'),
//     require('../backend/public/scenes/magical/4.png'),
//     require('../backend/public/scenes/magical/5.png'),
//   ],
const SCENE_ART: Record<string, any[]> = {
  magical: DEFAULT_ART,
  space: DEFAULT_ART,
  funny: DEFAULT_ART,
  animals: DEFAULT_ART,
};

// Optional strip of grass/rocks drawn IN FRONT of the hero so the character
// looks like it stands inside the scene. Use a transparent PNG, then enable it:
//   const FOREGROUND: any = require('../backend/public/scenes/foreground.png');
const FOREGROUND: any = null;

// Fallback hero if no cutout has been uploaded.
const FALLBACK_HERO = require('../backend/public/scenes/animated-elephant.png');

// ---------------------------------------------------------------------------
// Per-scene staging
// ---------------------------------------------------------------------------

// How the hero acts in each of the 8 story beats:
//  walkin    - walks in from the side with little steps, then breathes
//  breathe   - gentle breathing and a small look-around
//  lean      - leans toward the clue it just found
//  shake     - a quick worried shake ("Oops!")
//  tiptoe    - slow careful steps
//  hop       - a happy hop
//  jump      - a big jump ("Found it!")
//  celebrate - happy wobble
type Motion =
  | 'walkin'
  | 'breathe'
  | 'lean'
  | 'shake'
  | 'tiptoe'
  | 'hop'
  | 'jump'
  | 'celebrate';

// x = horizontal centre of the hero (0..1 of stage width)
// y = not used for standing height any more: the picture's floorY decides it
// h = hero height as a fraction of stage height
const SCENE_PLAN: {x: number; y: number; h: number; motion: Motion}[] = [
  {x: 0.30, y: 0.88, h: 0.30, motion: 'walkin'},    // 1  A Happy Start
  {x: 0.30, y: 0.88, h: 0.30, motion: 'breathe'},   // 2  A Big Mission
  {x: 0.36, y: 0.88, h: 0.30, motion: 'lean'},      // 3  The First Clue
  {x: 0.36, y: 0.88, h: 0.30, motion: 'shake'},     // 4  Oops!
  {x: 0.40, y: 0.88, h: 0.30, motion: 'tiptoe'},    // 5  A Careful Choice
  {x: 0.46, y: 0.88, h: 0.30, motion: 'hop'},       // 6  The Clues Match
  {x: 0.50, y: 0.88, h: 0.32, motion: 'jump'},      // 7  Found It!
  {x: 0.50, y: 0.88, h: 0.32, motion: 'celebrate'}, // 8  Happy Ending
];

// Which way does the drawing face? If the hero walks in BACKWARDS
// (tail first), change this to false.
const HERO_FACES_RIGHT = true;

// Lets the hero sink a little into the ground so the feet touch it
// (fraction of the hero's height). 0 = feet exactly on the floor line.
const FEET_SINK = 0.03;

// How long the one-time entrance move of each scene lasts (milliseconds).
const ENTER_MS: Record<Motion, number> = {
  walkin: 2200,
  breathe: 1000,
  lean: 1200,
  shake: 900,
  tiptoe: 3200,
  hop: 1000,
  jump: 1000,
  celebrate: 1000,
};

// Set to true while you fine-tune ground positions, then set back to false.
const SHOW_GROUND_GUIDE = false;

// Twinkling sparkles scattered over each scene (fractions of the stage).
const SPARKS = [
  {x: 0.08, y: 0.14, size: 22, delay: 0},
  {x: 0.22, y: 0.3, size: 16, delay: 700},
  {x: 0.38, y: 0.1, size: 20, delay: 1400},
  {x: 0.52, y: 0.26, size: 14, delay: 300},
  {x: 0.66, y: 0.12, size: 24, delay: 1100},
  {x: 0.78, y: 0.34, size: 16, delay: 1800},
  {x: 0.9, y: 0.16, size: 20, delay: 500},
  {x: 0.7, y: 0.5, size: 14, delay: 2100},
  {x: 0.15, y: 0.55, size: 14, delay: 900},
  {x: 0.46, y: 0.46, size: 12, delay: 1600},
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PairingSession = {
  code: string;
  pairingUrl: string;
  qrCode: string;
  status: string;
};

type DrawingResponse = {
  mimeType: string;
  data: string;
  uploadedAt: number;
};

type StoryScene = {
  number: number;
  title: string;
  narration: string;
  visualPrompt: string;
  audioUrl?: string | null;
  backgroundId?: string;
  backgroundUrl?: string | null;
  floorY?: number;
};

type Story = {
  id: string;
  genre: string;
  title: string;
  scenes: StoryScene[];
  mode: string;
};

type Screen = 'pairing' | 'genres' | 'story' | 'ending';

const ALL_GENRES = [
  {
    id: 'magical',
    emoji: '✨',
    title: 'Magical',
    description: 'Discover a world of wonder',
    color: '#45316C',
  },
  {
    id: 'funny',
    emoji: '😂',
    title: 'Funny',
    description: 'Get ready for giggles',
    color: '#69412E',
  },
  {
    id: 'space',
    emoji: '🚀',
    title: 'Space',
    description: 'Explore the stars',
    color: '#283F70',
  },
  {
    id: 'animals',
    emoji: '🐾',
    title: 'Animals',
    description: 'Meet wonderful new friends',
    color: '#315B4B',
  },
];

const genres = ALL_GENRES.filter(g => ENABLED_GENRES.includes(g.id));

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

// A value that eases 0 -> 1 -> 0 forever. Used for bobbing, hopping, walking.
// runKey: change it to restart the loop. A native-driven value stops when the
// view using it is removed, so the loop must start again each time the story
// screen is shown (for example after "New adventure").
const useLoop = (halfMs: number, runKey: string = '') => {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: halfMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: halfMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, halfMs, runKey]);

  return value;
};

// Evenly spaced keyframes for a driver that runs 0 -> 1 once (or loops).
// inputRange is built from the values, so the two lists can never differ in length.
const kf = (driver: Animated.Value, values: (number | string)[]) =>
  driver.interpolate({
    inputRange: values.map((_, i) => i / (values.length - 1)),
    outputRange: values as number[] | string[],
  });

// Cuts a scene's narration into short caption lines (one sentence at a time;
// a very long sentence is cut at a comma or a space near its middle).
const MAX_CAPTION_CHARS = 90;
const splitCaptions = (text: string): string[] => {
  const sentences =
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .match(/[^.!?]+[.!?]+["\u201D']?|[^.!?]+$/g) || [];

  const lines: string[] = [];
  const cut = (part: string) => {
    const t = part.trim();
    if (!t) {
      return;
    }
    if (t.length <= MAX_CAPTION_CHARS) {
      lines.push(t);
      return;
    }
    const mid = Math.floor(t.length / 2);
    let at = -1;
    let best = Infinity;
    for (let i = 8; i < t.length - 8; i++) {
      if (t[i] === ',' && Math.abs(i - mid) < best) {
        best = Math.abs(i - mid);
        at = i + 1;
      }
    }
    if (at < 0) {
      for (let i = 8; i < t.length - 8; i++) {
        if (t[i] === ' ' && Math.abs(i - mid) < best) {
          best = Math.abs(i - mid);
          at = i;
        }
      }
    }
    if (at < 0) {
      lines.push(t);
      return;
    }
    cut(t.slice(0, at));
    cut(t.slice(at));
  };

  sentences.forEach(cut);

  // glue very short pieces ("The end.", a quote tag) to the line before them
  const merged: string[] = [];
  lines.forEach(line => {
    const last = merged.length - 1;
    if (
      last >= 0 &&
      line.length < 18 &&
      merged[last].length + 1 + line.length <= MAX_CAPTION_CHARS
    ) {
      merged[last] = `${merged[last]} ${line}`;
    } else {
      merged.push(line);
    }
  });

  return merged.length ? merged : [String(text || '')];
};

// 0, -amp, 0, -amp, ... 0  (n little steps)
const steps = (n: number, amp: number) =>
  Array.from({length: n * 2 + 1}, (_, i) => (i % 2 === 1 ? -amp : 0));

// ---------------------------------------------------------------------------
// Storybook scenery: sky, clouds, hills, sparkle bursts and the book cover
// ---------------------------------------------------------------------------

const SKY_STARS = [
  {x: 0.04, y: 0.08, size: 18, delay: 0},
  {x: 0.14, y: 0.2, size: 12, delay: 900},
  {x: 0.27, y: 0.06, size: 16, delay: 1500},
  {x: 0.38, y: 0.17, size: 11, delay: 400},
  {x: 0.47, y: 0.05, size: 20, delay: 1200},
  {x: 0.58, y: 0.14, size: 12, delay: 2000},
  {x: 0.66, y: 0.3, size: 14, delay: 700},
  {x: 0.74, y: 0.06, size: 16, delay: 1700},
  {x: 0.93, y: 0.34, size: 14, delay: 300},
  {x: 0.03, y: 0.45, size: 12, delay: 1100},
  {x: 0.52, y: 0.4, size: 10, delay: 1900},
  {x: 0.96, y: 0.6, size: 12, delay: 600},
];

type CloudProps = {
  top: number;
  width: number;
  duration: number;
  phase: number;
  alpha: number;
  travel: number;
};

// A soft cloud that drifts slowly across the sky.
const Cloud = ({top, width, duration, phase, alpha, travel}: CloudProps) => {
  const t = useRef(new Animated.Value(phase)).current;

  useEffect(() => {
    t.setValue(phase);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, phase]);

  const tint = `rgba(255,255,255,${alpha})`;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width,
        height: width * 0.4,
        transform: [
          {
            translateX: t.interpolate({
              inputRange: [0, 1],
              outputRange: [-width, travel],
            }),
          },
        ],
      }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: width * 0.26,
          borderRadius: width * 0.13,
          backgroundColor: tint,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: width * 0.14,
          bottom: width * 0.1,
          width: width * 0.4,
          height: width * 0.4,
          borderRadius: width * 0.2,
          backgroundColor: tint,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: width * 0.46,
          bottom: width * 0.1,
          width: width * 0.3,
          height: width * 0.3,
          borderRadius: width * 0.15,
          backgroundColor: tint,
        }}
      />
    </Animated.View>
  );
};

// Night sky with a glowing moon, twinkling stars, drifting clouds and rolling hills.
const SkyBackdrop = ({w, h}: {w: number; h: number}) => {
  const glow = useLoop(2600);
  const moon = Math.max(70, Math.round(h * 0.17));
  const halo = moon * 2.4;
  const cx = w * 0.86;
  const cy = h * 0.18;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {/* sunrise glow behind the hills */}
      <View
        style={{
          position: 'absolute',
          left: w * 0.05,
          top: h * 0.6,
          width: w * 0.9,
          height: w * 0.9,
          borderRadius: w * 0.45,
          backgroundColor: '#6B2FA6',
          opacity: 0.3,
        }}
      />

      {/* moon and its breathing halo */}
      <Animated.View
        style={{
          position: 'absolute',
          left: cx - halo / 2,
          top: cy - halo / 2,
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: '#FFF1B8',
          opacity: glow.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.22],
          }),
          transform: [
            {
              scale: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.1],
              }),
            },
          ],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cx - moon / 2,
          top: cy - moon / 2,
          width: moon,
          height: moon,
          borderRadius: moon / 2,
          backgroundColor: '#FFF1B8',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cx - moon * 0.05,
          top: cy - moon * 0.28,
          width: moon * 0.2,
          height: moon * 0.2,
          borderRadius: moon * 0.1,
          backgroundColor: '#F3DB93',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: cx - moon * 0.3,
          top: cy + moon * 0.05,
          width: moon * 0.14,
          height: moon * 0.14,
          borderRadius: moon * 0.07,
          backgroundColor: '#F3DB93',
        }}
      />

      {SKY_STARS.map((star, i) => (
        <Sparkle key={i} {...star} />
      ))}

      <Cloud top={h * 0.14} width={150} duration={70000} phase={0.15} alpha={0.12} travel={w} />
      <Cloud top={h * 0.34} width={210} duration={95000} phase={0.55} alpha={0.09} travel={w} />
      <Cloud top={h * 0.5} width={120} duration={60000} phase={0.85} alpha={0.1} travel={w} />

      {/* rolling hills */}
      <View
        style={{
          position: 'absolute',
          left: -w * 0.2,
          top: h * 0.86,
          width: w * 1.1,
          height: w * 1.1,
          borderRadius: w * 0.55,
          backgroundColor: '#2B1B6B',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: w * 0.4,
          top: h * 0.9,
          width: w * 0.9,
          height: w * 0.9,
          borderRadius: w * 0.45,
          backgroundColor: '#3A2587',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -w * 0.35,
          top: h * 0.95,
          width: w * 1.3,
          height: w * 1.3,
          borderRadius: w * 0.65,
          backgroundColor: '#1C1250',
        }}
      />
    </View>
  );
};

const BURST_ITEMS = Array.from({length: 16}, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  return {
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    glyph: ['✦', '★', '✧', '✺'][i % 4],
    color: ['#FFD166', '#FF8FB8', '#5EEAD4', '#FFFFFF'][i % 4],
    size: 18 + (i % 3) * 8,
    dist: 120 + (i % 4) * 40,
  };
});

// A one-time burst of stars flying out from a point.
const Burst = ({
  x,
  y,
  delay = 0,
}: {
  x: number | string;
  y: number | string;
  delay?: number;
}) => {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, {
        toValue: 1,
        duration: 1300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <View
      pointerEvents="none"
      style={{position: 'absolute', left: x as any, top: y as any}}>
      {BURST_ITEMS.map((item, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            fontSize: item.size,
            color: item.color,
            opacity: t.interpolate({
              inputRange: [0, 0.05, 0.7, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateX: t.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, item.dx * item.dist],
                }),
              },
              {
                translateY: t.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, item.dy * item.dist],
                }),
              },
              {
                scale: t.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.3, 1.2, 0.6],
                }),
              },
            ],
          }}>
          {item.glyph}
        </Animated.Text>
      ))}
    </View>
  );
};

const BOOK_HOLD_MS = 1100; // the closed book waits
const BOOK_OPEN_MS = 1700; // the covers swing open

// One half of the storybook cover. It folds away towards its own outer edge.
const BookPanel = ({
  side,
  w,
  h,
  progress,
}: {
  side: 'left' | 'right';
  w: number;
  h: number;
  progress: Animated.Value;
}) => {
  const half = w / 2;
  const dir = side === 'left' ? -1 : 1;
  const outer = side === 'left' ? {left: 14} : {right: 14};
  const inner = side === 'left' ? {right: 0} : {left: 0};

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bookPanel,
        side === 'left' ? {left: 0} : {right: 0},
        {
          width: half,
          height: h,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, dir * half * 0.485],
              }),
            },
            {
              scaleX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.03],
              }),
            },
          ],
        },
      ]}>
      <View style={styles.bookFrameOuter} />
      <View style={styles.bookFrameInner} />
      <Text style={[styles.bookCorner, outer, {top: 16}]}>❖</Text>
      <Text style={[styles.bookCorner, outer, {bottom: 16}]}>❖</Text>
      <Text style={[styles.bookStarSmall, {left: half * 0.3, top: h * 0.22}]}>✦</Text>
      <Text style={[styles.bookStarSmall, {left: half * 0.6, top: h * 0.74}]}>✦</Text>
      <Text style={[styles.bookStarSmall, {left: half * 0.45, top: h * 0.1}]}>✧</Text>
      <Text style={[styles.bookStarSmall, {left: half * 0.2, top: h * 0.62}]}>✧</Text>
      <View style={[styles.bookSpine, inner]} />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: '#000000',
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.55],
            }),
          },
        ]}
      />
    </Animated.View>
  );
};

// The closed storybook that opens to reveal the first scene.
const BookCover = ({
  progress,
  pulse,
  w,
  h,
  title,
}: {
  progress: Animated.Value;
  pulse: Animated.Value;
  w: number;
  h: number;
  title: string;
}) => (
  <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
    <BookPanel side="left" w={w} h={h} progress={progress} />
    <BookPanel side="right" w={w} h={h} progress={progress} />

    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: w / 2 - 170,
        top: h / 2 - 135,
        width: 340,
        alignItems: 'center',
        opacity: progress.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [1, 0, 0],
        }),
        transform: [
          {
            scale: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.06],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.5],
            }),
          },
        ],
      }}>
      <View style={styles.bookMedal}>
        <Text style={styles.bookMedalStar}>★</Text>
      </View>
      <Text style={styles.bookKicker}>ONCE UPON A TIME…</Text>
      <View style={styles.bookRibbon}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text style={styles.bookHint}>Opening your storybook ✦</Text>
    </Animated.View>

    <Burst x={w / 2} y={h / 2} delay={BOOK_HOLD_MS} />
  </View>
);

type SparkleProps = {x: number; y: number; size: number; delay: number};

const Sparkle = ({x, y, size, delay}: SparkleProps) => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(glow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, delay]);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: `${x * 100}%` as any,
        top: `${y * 100}%` as any,
        fontSize: size,
        color: '#FFF3B8',
        opacity: glow.interpolate({
          inputRange: [0, 1],
          outputRange: [0.15, 0.95],
        }),
        transform: [
          {
            translateY: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -12],
            }),
          },
          {
            scale: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1.15],
            }),
          },
        ],
      }}>
      ✦
    </Animated.Text>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App = () => {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [status, setStatus] = useState('Connecting to pairing service...');
  const [drawingUri, setDrawingUri] = useState<string | null>(null);
  const [characterUri, setCharacterUri] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('pairing');
  const [selectedGenre, setSelectedGenre] = useState('magical');
  const [story, setStory] = useState<Story | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSurfaceHandle, setVideoSurfaceHandle] = useState<string | null>(null);
  const videoPlayerRef = useRef<VideoPlayer | null>(null);
  const handleVideoSurfaceCreated = (handle: string) => {
    setVideoSurfaceHandle(handle);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.setSurfaceHandle(handle);
    }
  };

  const handleVideoSurfaceDestroyed = (handle: string) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.clearSurfaceHandle(handle);
    }
    setVideoSurfaceHandle(current => (current === handle ? null : current));
  };

  const [sceneIndex, setSceneIndex] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stage, setStage] = useState({w: 1200, h: 650});
  const [audioDebug, setAudioDebug] = useState('audio: waiting');
  const [captionIndex, setCaptionIndex] = useState(0);
  const [bgShown, setBgShown] = useState<string | null>(null);
  const [bookPhase, setBookPhase] = useState<'closed' | 'done'>('done');
  const [screenSize, setScreenSize] = useState({w: 960, h: 540});
  // Width / height of the hero picture, so its box matches its real shape and
  // the feet sit exactly on the floor line (a square box floats wide pictures).
  const [heroAspect, setHeroAspect] = useState(1);
  // Tracks the latest uploaded drawing so the TV only processes each upload once.
  const lastDrawingUploadedAt = useRef<number | null>(null);

  // Play the locally rendered film on the video surface.
  // Skipped entirely when USE_VIDEO is false, so the in-app stage shows instead.
  useEffect(() => {
    if (!USE_VIDEO || screen !== 'story' || !videoSurfaceHandle) {
      return;
    }

    let active = true;
    let player: VideoPlayer | null = null;

    const playLocalScene = async () => {
      setVideoLoading(true);
      setAudioDebug('video: loading local scene');

      try {
        player = new VideoPlayer();
        await player.initialize();

        if (!active || !player) {
          await player?.deinitialize();
          player = null;
          return;
        }

        player.setSurfaceHandle(videoSurfaceHandle);
        videoPlayerRef.current = player;
        player.src = LOCAL_SCENE_VIDEO;
        player.autoplay = true;

        setGeneratedVideoUrl(LOCAL_SCENE_VIDEO);

        await player.play();

        if (active) {
          setVideoLoading(false);
          setAudioDebug('video: playing garden elephant test');
        }
      } catch (error) {
        console.warn('Local scene playback failed:', error);

        if (active) {
          setVideoLoading(false);
          setAudioDebug(`video: FAILED ${String(error)}`);
        }
      }
    };

    void playLocalScene();

    return () => {
      active = false;

      const oldPlayer = player;

      if (videoPlayerRef.current === oldPlayer) {
        videoPlayerRef.current = null;
      }

      if (oldPlayer) {
        try {
          oldPlayer.clearSurfaceHandle(videoSurfaceHandle);
        } catch {}

        void Promise.resolve(oldPlayer.deinitialize()).catch(() => {});
      }
    };
  }, [screen, videoSurfaceHandle]);

  // Pause/resume the film when the phone sends an open-palm gesture.
  useEffect(() => {
    const player = videoPlayerRef.current;
    if (!USE_VIDEO || screen !== 'story' || !player) return;

    try {
      if (isStoryPaused) {
        void Promise.resolve(player.pause?.()).catch(() => {});
      } else {
        void Promise.resolve(player.play?.()).catch(() => {});
      }
    } catch (error) {
      console.warn('Could not update video playback state:', error);
    }
  }, [isStoryPaused, screen]);

  // Measure the hero picture (the uploaded cutout, or the fallback).
  useEffect(() => {
    let active = true;
    const apply = (w: number, h: number) => {
      if (active && w > 0 && h > 0) {
        setHeroAspect(w / h);
      }
    };
    try {
      if (characterUri) {
        Image.getSize(characterUri, apply, () => {});
      } else {
        const src = Image.resolveAssetSource(FALLBACK_HERO);
        if (src && src.width && src.height) {
          apply(src.width, src.height);
        }
      }
    } catch (error) {
      console.warn('Could not measure the hero picture:', error);
    }
    return () => {
      active = false;
    };
  }, [characterUri]);

  // Animation drivers (all native-driven).
  const loopKey = `${screen}:${story?.id ?? ''}`;
  const bob = useLoop(380, loopKey); // quick little bounce
  const beat = useLoop(650, loopKey); // hop / pop rhythm
  const breath = useLoop(1500, loopKey); // slow breathing
  const enter = useRef(new Animated.Value(0)).current; // one-time move at the start of each scene
  const drift = useRef(new Animated.Value(0)).current; // background camera drift
  const fade = useRef(new Animated.Value(1)).current; // scene-change fade overlay
  const bookAnim = useRef(new Animated.Value(0)).current; // 0 = closed book, 1 = open
  const screenIn = useRef(new Animated.Value(0)).current; // entrance of the pairing / genre / ending screens

  // ---- Pairing and drawing polling (unchanged behaviour) -------------------
  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let isPolling = false;

    const startPairing = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/pairing`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({phoneUrl: `${API_BASE}/phone.html`}),
        });

        if (!response.ok) {
          throw new Error(`Pairing API returned ${response.status}`);
        }

        const data: PairingSession = await response.json();

        if (!active) {
          return;
        }

        setSession(data);
        setStatus('Scan the QR code or enter the code on your phone.');

        pollTimer = setInterval(async () => {
          if (isPolling || !active) {
            return;
          }

          isPolling = true;

          try {
            const pollResponse = await fetch(
              `${API_BASE}/api/pairing/${data.code}`,
            );

            if (!pollResponse.ok) {
              if (pollResponse.status === 410 && active) {
                setStatus('Pairing code expired. Restart the app.');
              }
              return;
            }

            const latest = await pollResponse.json();

            if (!active) {
              return;
            }

            if (latest.status !== 'paired') {
              return;
            }

            setSession(current =>
              current ? {...current, status: 'paired'} : current,
            );

            if (
              !latest.hasDrawing ||
              !latest.drawingUploadedAt ||
              latest.drawingUploadedAt === lastDrawingUploadedAt.current
            ) {
              if (!latest.hasDrawing) {
                setStatus('Phone connected! Upload your drawing to continue.');
              }
              return;
            }

            setStatus('Drawing uploaded! Preparing your hero...');

            const drawingResponse = await fetch(
              `${API_BASE}/api/pairing/${data.code}/drawing`,
            );

            if (!drawingResponse.ok) {
              throw new Error('Could not retrieve the drawing');
            }

            const drawingData: DrawingResponse = await drawingResponse.json();

            if (!active) {
              return;
            }

            setDrawingUri(
              `data:${drawingData.mimeType};base64,${drawingData.data}`,
            );

            const cutoutResponse = await fetch(
              `${API_BASE}/api/pairing/${data.code}/cutout`,
            );

            if (cutoutResponse.ok) {
              const cutoutData: DrawingResponse = await cutoutResponse.json();

              if (active) {
                setCharacterUri(
                  `data:${cutoutData.mimeType};base64,${cutoutData.data}`,
                );
              }
            }

            const isFirstDrawing = lastDrawingUploadedAt.current === null;
            lastDrawingUploadedAt.current = latest.drawingUploadedAt;

            if (isFirstDrawing) {
              setScreen('genres');
            }

            setStatus('Your drawing is ready. Choose an adventure!');
          } catch {
            if (active) {
              setStatus('Connection interrupted. Retrying...');
            }
          } finally {
            isPolling = false;
          }
        }, 2000);
      } catch (error) {
        if (active) {
          setStatus(`Pairing service unavailable: ${String(error)}`);
        }
      }
    };

    void startPairing();

    return () => {
      active = false;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, []);

  // ---- Story creation ------------------------------------------------------
  const createStory = async (genre: string) => {
    if (!session || storyLoading) {
      return;
    }

    setSelectedGenre(genre);
    setStoryLoading(true);
    setErrorMessage('');
    setStatus('Creating a little adventure...');

    try {
      const response = await fetch(
        `${API_BASE}/api/pairing/${session.code}/story`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({genre}),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not create the story');
      }

      // Load all background pictures first, so no scene starts on a black screen.
      try {
        const urls: string[] = (result.scenes || [])
          .map((sc: any) => sc.backgroundUrl)
          .filter(Boolean)
          .map((u: string) => `${API_BASE}${u}`);
        const prefetch = (Image as any).prefetch;
        if (typeof prefetch === 'function' && urls.length) {
          setStatus('Painting the pictures...');
          await Promise.race([
            Promise.all(
              urls.map((u: string) =>
                Promise.resolve(prefetch.call(Image, u)).catch(() => false),
              ),
            ),
            new Promise(resolve => setTimeout(resolve, 6000)),
          ]);
        }
      } catch {
        // pictures will simply load when each scene starts
      }

      resetStageForNewStory();
      setStory(result as Story);
      setSceneIndex(0);
      setScreen('story');
      setStatus('Your adventure is ready!');
    } catch (error) {
      setErrorMessage(
        `${String(error)}. Check that the backend and tunnel are running.`,
      );
    } finally {
      setStoryLoading(false);
    }
  };

  const currentScene = story?.scenes[sceneIndex];
  const isFirstScene = sceneIndex === 0;

  const goNext = () => {
    if (!story) {
      return;
    }
    if (sceneIndex >= story.scenes.length - 1) {
      setScreen('ending');
    } else {
      setSceneIndex(index => index + 1);
    }
  };

  const goPrev = () => setSceneIndex(index => Math.max(0, index - 1));

  // Poll the paired-phone gesture endpoint while a story is playing.
  useEffect(() => {
    if (screen !== 'story' || !session?.code || !story) return;

    let active = true;
    let polling = false;

    const pollGesture = async () => {
      if (!active || polling) return;
      polling = true;

      try {
        const response = await fetch(
          `${API_BASE}/api/pairing/${session.code}/gesture`,
        );
        if (!response.ok || !active) return;

        const result = await response.json();
        const gesture = result?.gesture?.gesture as string | undefined;
        if (!gesture || !active) return;

        console.log(`TV received gesture: ${gesture}`);

        switch (gesture) {
          case 'open_palm':
            setIsStoryPaused(previous => !previous);
            break;
          case 'swipe_left':
            setIsStoryPaused(false);
            goNext();
            break;
          case 'swipe_right':
            setIsStoryPaused(false);
            goPrev();
            break;
          case 'thumbs_up':
            setIsStoryPaused(false);
            setSceneIndex(0);
            setScreen('story');
            break;
          default:
            break;
        }
      } catch (error) {
        console.warn('Gesture polling failed:', error);
      } finally {
        polling = false;
      }
    };

    const timer = setInterval(() => {
      void pollGesture();
    }, 400);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, session?.code, story?.id]);

  // Put every animation and picture back to its starting state, so the next
  // story never shows leftovers of the previous one (this was the flicker).
  const resetStageForNewStory = () => {
    fade.setValue(1);
    drift.setValue(0);
    enter.setValue(0);
    setIsStoryPaused(false);
    setCaptionIndex(0);
    setBgShown(null);
    bookAnim.setValue(0);
    setBookPhase('closed');
  };

  const returnToGenres = () => {
    resetStageForNewStory();
    setStory(null);
    setSceneIndex(0);
    setErrorMessage('');
    setScreen('genres');
  };

  // ---- Storybook opening: the closed book waits, then swings open ----------
  useEffect(() => {
    if (screen !== 'story' || bookPhase !== 'closed') {
      return;
    }

    bookAnim.setValue(0);

    const seq = Animated.sequence([
      Animated.delay(BOOK_HOLD_MS),
      Animated.timing(bookAnim, {
        toValue: 1,
        duration: BOOK_OPEN_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    seq.start(({finished}) => {
      if (finished) {
        setBookPhase('done');
      }
    });

    return () => seq.stop();
  }, [screen, bookPhase, story?.id, bookAnim]);

  // ---- Entrance of the pairing / genre / ending screens --------------------
  useEffect(() => {
    if (screen === 'story') {
      return;
    }

    screenIn.setValue(0);

    const anim = Animated.timing(screenIn, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    anim.start();
    return () => anim.stop();
  }, [screen, screenIn]);

  // ---- Scene change: restart camera drift and fade in ----------------------
  useEffect(() => {
    if (screen !== 'story') {
      return;
    }

    drift.setValue(0);
    fade.setValue(1);

    const intro = Animated.parallel([
      Animated.timing(drift, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);

    intro.start();
    return () => intro.stop();
  }, [screen, sceneIndex, story?.id, drift, fade]);

  // ---- Hero entrance move: restarts at the start of every scene ------------
  useEffect(() => {
    if (screen !== 'story') {
      return;
    }

    enter.setValue(0);

    // wait until the storybook has opened
    if (bookPhase !== 'done') {
      return;
    }

    const motion =
      SCENE_PLAN[Math.min(sceneIndex, SCENE_PLAN.length - 1)].motion;

    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: ENTER_MS[motion],
      easing: Easing.linear,
      useNativeDriver: true,
    });

    anim.start();
    return () => anim.stop();
  }, [screen, sceneIndex, story?.id, enter, bookPhase]);

  // ---- Narration: one player per scene; the audio drives the story ---------
  useEffect(() => {
    if (
      screen !== 'story' ||
      !story ||
      !currentScene ||
      isStoryPaused ||
      bookPhase !== 'done'
    ) {
      return;
    }

    let active = true;
    let finished = false;
    let player: any = null;
    let captionTimer: ReturnType<typeof setInterval> | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // ---- Captions: one short line at a time, following the narration ------
    const lines = splitCaptions(currentScene.narration);
    const weights = lines.map(line => line.length + 12);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const estimatedMs = Math.max(3500, weightSum * 62);
    let captionStart = Date.now();
    setCaptionIndex(0);

    const startCaptions = () => {
      captionStart = Date.now();
      if (captionTimer) {
        clearInterval(captionTimer);
      }
      captionTimer = setInterval(() => {
        const t = Number(player?.currentTime);
        const d = Number(player?.duration);
        const elapsed =
          isFinite(t) && t > 0 ? t * 1000 : Date.now() - captionStart;
        const total = isFinite(d) && d > 1 ? d * 1000 : estimatedMs;
        const progress = Math.min(0.999, elapsed / total);
        let run = 0;
        let index = lines.length - 1;
        for (let i = 0; i < weights.length; i++) {
          run += weights[i] / weightSum;
          if (progress < run) {
            index = i;
            break;
          }
        }
        setCaptionIndex(prev => (prev === index ? prev : index));
      }, 200);
    };

    const finish = () => {
      if (!active || finished) {
        return;
      }
      finished = true;
      goNext();
    };

    const startFallbackTimer = () => {
      timers.push(setTimeout(finish, FALLBACK_SCENE_MS));
      startCaptions();
    };

    const onEnded = () => {
      setAudioDebug('audio: ended');
      finish();
    };
    const onError = () => {
      console.warn('Narration error code:', player?.error?.code);
      setAudioDebug(`audio: ERROR code ${player?.error?.code}`);
      startFallbackTimer();
    };

    const url = currentScene.audioUrl;

    if (!url && !AUDIO_TEST_URL) {
      setAudioDebug('audio: NO audioUrl from server');
      startFallbackTimer();
    } else {
      setAudioDebug(`audio: loading ${AUDIO_TEST_URL || url}`);
      (async () => {
        try {
          player = new AudioPlayer();
          player.addEventListener('ended', onEnded);
          player.addEventListener('error', onError);
          await player.initialize();

          if (!active) {
            return;
          }

          player.src = AUDIO_TEST_URL || `${API_BASE}${url}`;
          player.autoplay = true;
          await player.play();
          setAudioDebug(`audio: playing ${AUDIO_TEST_URL || url}`);
          startCaptions();

          // Safety net in case neither 'ended' nor 'error' ever fires.
          timers.push(setTimeout(finish, MAX_SCENE_MS));
        } catch (error) {
          console.warn('Narration playback failed:', error);
          setAudioDebug(`audio: FAILED ${String(error)}`);
          if (active) {
            startFallbackTimer();
          }
        }
      })();
    }

    return () => {
      active = false;
      timers.forEach(clearTimeout);
      if (captionTimer) {
        clearInterval(captionTimer);
      }

      if (player) {
        try {
          player.removeEventListener('ended', onEnded);
          player.removeEventListener('error', onError);
        } catch {
          // ignore
        }
        void Promise.resolve(player.deinitialize?.()).catch(() => {});
      }
    };
    // goNext is intentionally omitted: it is recreated every render and this
    // effect already re-runs whenever the scene changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, story?.id, sceneIndex, isStoryPaused, bookPhase]);

  // ---- Hero staging for the current scene ----------------------------------
  const plan = SCENE_PLAN[Math.min(sceneIndex, SCENE_PLAN.length - 1)];
  const maxHeroW = stage.w * 0.6;
  const heroW = Math.min(stage.h * plan.h * heroAspect, maxHeroW);
  const heroH = heroW / heroAspect;
  const sceneFloorY = currentScene?.floorY ?? plan.y;
  const heroLeft = plan.x * stage.w - heroW / 2;
  const heroTop = sceneFloorY * stage.h - heroH + heroH * FEET_SINK;

  const dir = HERO_FACES_RIGHT ? 1 : -1;
  const W = stage.w;
  const SH = stage.h;
  const H = heroH;

  // Sideways movement of the hero (the shadow uses the same value).
  const shiftX = (): any => {
    switch (plan.motion) {
      case 'walkin':
        return kf(
          enter,
          [-0.3, -0.21, -0.14, -0.085, -0.045, -0.018, 0].map(v => v * W * dir),
        );
      case 'tiptoe':
        return kf(enter, [0, W * 0.07 * dir]);
      case 'shake':
        return kf(
          enter,
          [0, -10, 10, -10, 10, -6, 6, -3, 3, 0, 0].map(v => (v * W) / 1000),
        );
      case 'lean':
        return kf(enter, [0, W * 0.015 * dir]);
      default:
        return 0;
    }
  };

  // Soft breathing that keeps the feet on the ground.
  const breathing = (): any[] => [
    {translateY: kf(breath, [0, -H * 0.015])},
    {scaleY: kf(breath, [1, 1.03])},
    {scaleX: kf(breath, [1, 0.985])},
  ];

  const heroTransform = (): any[] => {
    switch (plan.motion) {
      case 'walkin': {
        const tilt = steps(6, 3).map((_, i) =>
          i % 2 === 0 ? '0deg' : `${i % 4 === 1 ? 3 : -3}deg`,
        );
        return [
          {translateX: shiftX()},
          {translateY: kf(enter, steps(6, 9))},
          {rotate: kf(enter, tilt)},
          ...breathing(),
        ];
      }
      case 'breathe':
        return [{rotate: kf(breath, ['-2deg', '2deg'])}, ...breathing()];
      case 'lean':
        return [
          {translateX: shiftX()},
          {rotate: kf(enter, ['0deg', `${6 * dir}deg`])},
          ...breathing(),
        ];
      case 'shake': {
        const xs = [0, -10, 10, -10, 10, -6, 6, -3, 3, 0, 0];
        return [
          {translateX: shiftX()},
          {rotate: kf(enter, xs.map(v => `${(v * 0.3).toFixed(1)}deg`))},
          {scale: kf(enter, xs.map((_, i) => (i > 0 && i < 8 ? 1.04 : 1)))},
          ...breathing(),
        ];
      }
      case 'tiptoe':
        return [
          {translateX: shiftX()},
          {translateY: kf(enter, steps(4, 5))},
          ...breathing(),
        ];
      case 'hop':
        return [
          {translateY: kf(beat, [H * 0.03, -SH * 0.14 - H * 0.03])},
          {scaleY: kf(beat, [0.94, 1.06])},
          {scaleX: kf(beat, [1.05, 0.96])},
        ];
      case 'jump':
        return [
          {translateY: kf(beat, [H * 0.04, -SH * 0.24 - H * 0.05])},
          {scaleY: kf(beat, [0.92, 1.1])},
          {scaleX: kf(beat, [1.08, 0.94])},
          {rotate: kf(beat, ['-4deg', '4deg'])},
        ];
      default:
        return [
          {translateY: kf(beat, [0, -SH * 0.06])},
          {rotate: kf(beat, ['-8deg', '8deg'])},
          {scale: 1.05},
        ];
    }
  };

  const heroJumping =
    plan.motion === 'hop' ||
    plan.motion === 'jump' ||
    plan.motion === 'celebrate';

  const heroSource = characterUri ? {uri: characterUri} : FALLBACK_HERO;
  const captionLines = splitCaptions(currentScene?.narration || '');

const backgroundUri = currentScene?.backgroundUrl
  ? `${API_BASE}${currentScene.backgroundUrl}`
  : null;

  // =========================================================================
  // STORY SCREEN: full-screen stage
  // =========================================================================
  if (screen === 'story' && story && currentScene) {
    return (
      <View style={styles.storyRoot}>
        <View
          style={styles.stage}
          onLayout={e => {
  const {width, height} = e.nativeEvent.layout;
  setStage(prev =>
    prev.w === width && prev.h === height
      ? prev
      : {w: width, h: height},
  );
}}
          >
          {/* Pictures of all scenes load in the background (invisible) */}
          {story.scenes.map((sc: any, i: number) =>
            sc.backgroundUrl ? (
              <Image
                key={`pre-${i}-${sc.backgroundUrl}`}
                source={{uri: `${API_BASE}${sc.backgroundUrl}`}}
                style={{position: 'absolute', width: 1, height: 1, opacity: 0}}
              />
            ) : null,
          )}

          {/* Previous picture stays visible until the new one has loaded */}
          {bgShown && bgShown !== backgroundUri ? (
            <Image
              source={{uri: bgShown}}
              resizeMode="contain"
              style={{position: 'absolute', width: '100%', height: '100%'}}
            />
          ) : null}

          {/* Background: full stage, keep aspect ratio (no stretch zoom) */}
          {backgroundUri ? (
            <Image
              key={backgroundUri}
              source={{uri: backgroundUri}}
              resizeMode="contain"
              onLoad={() => setBgShown(backgroundUri)}
              style={{position: 'absolute', width: '100%', height: '100%'}}
            />
          ) : null}

          {/* Twinkling sparkles */}
          {SPARKS.map((spark, i) => (
            <Sparkle key={i} {...spark} />
          ))}

          {/* Soft shadow under the hero */}
          <Animated.View
            style={[
              styles.shadow,
              {
                width: heroW * 0.55,
                left: plan.x * stage.w - (heroW * 0.55) / 2,
                top: sceneFloorY * stage.h - 8,
                opacity: heroJumping ? kf(beat, [0.35, 0.12]) : 0.3,
                transform: [
                  {translateX: shiftX()},
                  {scaleX: heroJumping ? kf(beat, [1, 0.65]) : 1},
                ],
              },
            ]}
          />

          {/* Film surface: only mounted when USE_VIDEO is true. When it is
              mounted it covers the background images above. */}
          {USE_VIDEO ? (
            <KeplerVideoSurfaceView
              scalingmode="fit"
              onSurfaceViewCreated={handleVideoSurfaceCreated}
              onSurfaceViewDestroyed={handleVideoSurfaceDestroyed}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}

          {/* The child's drawing, as the hero */}
          <Animated.View
            style={{
              position: 'absolute',
              width: heroW,
              height: heroH,
              left: heroLeft,
              top: heroTop,
              transform: heroTransform(),
            }}>
            <Image
              source={heroSource}
              resizeMode="contain"
              style={{
                width: '100%',
                height: '100%',
                transform: [{scaleX: HERO_FACES_RIGHT ? 1 : -1}],
              }}
            />
          </Animated.View>

          {/* Temporary ground guide – remove when positions look correct */}
          {SHOW_GROUND_GUIDE ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: sceneFloorY * stage.h,
                height: 2,
                backgroundColor: 'lime',
                opacity: 0.85,
              }}
            />
          ) : null}

          {/* Foreground strip in front of the hero (optional) */}
          {FOREGROUND ? (
            <Image
              source={FOREGROUND}
              resizeMode="stretch"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: stage.h * 0.2,
              }}
            />
          ) : null}

          {/* Top bar: title, progress dots, small controls */}
          <View style={styles.topBar}>
            <View style={styles.titlePill}>
              <Text style={styles.titlePillText}>{story.title}</Text>
            </View>

            <View style={styles.topRight}>
              <View style={styles.dots}>
                {story.scenes.map((scene, i) => (
                  <View
                    key={scene.number}
                    style={[styles.dot, i <= sceneIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <Pressable
                focusable
                disabled={isFirstScene}
                onPress={goPrev}
                style={() => [
                  styles.miniButton,
                  isFirstScene && styles.controlDisabled,
                ]}>
                <Text style={styles.miniButtonText}>‹</Text>
              </Pressable>
              <Pressable
                focusable
                onPress={goNext}
                style={() => [styles.miniButton]}>
                <Text style={styles.miniButtonText}>›</Text>
              </Pressable>
            </View>
          </View>

          {/* Playback status and temporary audio diagnostics */}
          <Text
            style={{
              position: 'absolute',
              left: SAFE,
              top: 78,
              color: '#FFE08A',
              fontSize: 14,
            }}>
            {isStoryPaused ? 'PAUSED · show open palm to resume' : ''}
          </Text>

          {/* Small caption: one short line at a time */}
          {captionLines[Math.min(captionIndex, captionLines.length - 1)] ? (
            <View style={styles.captionBar} pointerEvents="none">
              <Text style={styles.captionText} numberOfLines={2}>
                {captionLines[Math.min(captionIndex, captionLines.length - 1)]}
              </Text>
            </View>
          ) : null}

          {/* Fade-in overlay on every scene change */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {backgroundColor: '#100E20', opacity: fade},
            ]}
          />

          {/* Closed storybook that opens to reveal the first scene */}
          {bookPhase === 'closed' ? (
            <BookCover
              progress={bookAnim}
              pulse={breath}
              w={stage.w}
              h={stage.h}
              title={story.title}
            />
          ) : null}
        </View>
      </View>
    );
  }

  // =========================================================================
  // OTHER SCREENS: pairing, genres, ending
  // =========================================================================
  const showcaseSource = characterUri
    ? heroSource
    : drawingUri
    ? {uri: drawingUri}
    : null;

  return (
    <View
      style={styles.screen}
      onLayout={e => {
        const {width, height} = e.nativeEvent.layout;
        setScreenSize(prev =>
          prev.w === width && prev.h === height ? prev : {w: width, h: height},
        );
      }}>
      <SkyBackdrop w={screenSize.w} h={screenSize.h} />
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandIcon}>✦</Text>
        </View>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>SKETCHTALES</Text>
          <Text style={styles.edition}>YOUR ART. YOUR ADVENTURE.</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>A LITTLE WORLD OF WONDER</Text>
        </View>
      </View>

      {screen === 'pairing' && (
        <View style={styles.pairingContent}>
          <Animated.View
            style={[
              styles.intro,
              {
                opacity: screenIn.interpolate({
                  inputRange: [0, 0.6, 1],
                  outputRange: [0, 1, 1],
                }),
                transform: [
                  {
                    translateX: screenIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-70, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrow}>✦  LET IMAGINATION TAKE FLIGHT</Text>
            </View>
            <Text style={styles.welcomeTitle}>Every drawing</Text>
            <Text style={[styles.welcomeTitle, styles.welcomeGold]}>
              has a story.
            </Text>
            <Text style={styles.description}>
              Bring your little artist's creation to life. Connect a phone,
              upload a drawing and turn it into a storybook adventure.
            </Text>

            {[
              ['01', 'Connect your phone', 'Scan the QR code to get started.', '#FF8FB8'],
              ['02', 'Upload your drawing', 'Your artwork becomes the hero.', '#FFD166'],
              [
                '03',
                'Choose an adventure',
                'Pick a world and let the story begin.',
                '#5EEAD4',
              ],
            ].map(item => (
              <View style={styles.stepRow} key={item[0]}>
                <View
                  style={[
                    styles.stepNumber,
                    {backgroundColor: item[3], borderColor: item[3]},
                  ]}>
                  <Text style={[styles.stepNumberText, {color: '#2A1450'}]}>
                    {item[0]}
                  </Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{item[1]}</Text>
                  <Text style={styles.stepDescription}>{item[2]}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          <Animated.View
            style={[
              styles.qrWrap,
              {
                opacity: screenIn.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1, 1],
                }),
                transform: [
                  {
                    translateY: screenIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [80, 0],
                    }),
                  },
                  {
                    scale: screenIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              },
            ]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.qrGlow,
                {
                  opacity: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.22, 0.55],
                  }),
                  transform: [
                    {
                      scale: breath.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={styles.qrCard}>
              <View style={styles.scanPill}>
                <Text style={styles.scanPillText}>SCAN ME ✦</Text>
              </View>
              <Text style={styles.cardTitle}>Connect your phone</Text>
              <Text style={styles.cardSubtitle}>Scan to begin your story</Text>
              <View style={styles.qrBox}>
                {session ? (
                  <Image
                    source={{uri: session.qrCode}}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.qrLoading}>Loading QR...</Text>
                )}
              </View>
              <Text style={styles.codeLabel}>YOUR PAIRING CODE</Text>
              <Text style={styles.code}>{session?.code || '------'}</Text>
              <View style={styles.connectionRow}>
                <View
                  style={[
                    styles.statusDot,
                    session?.status === 'paired' && styles.statusDotActive,
                  ]}
                />
                <Text style={styles.status}>{status}</Text>
              </View>
            </View>
            <Animated.Image
              source={FALLBACK_HERO}
              resizeMode="contain"
              style={[
                styles.mascot,
                {
                  transform: [
                    {
                      translateY: bob.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -10],
                      }),
                    },
                    {
                      rotate: breath.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-6deg', '6deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
        </View>
      )}

      {screen === 'genres' && (
        <View style={styles.mainContent}>
          <Animated.View
            style={[
              styles.genreIntro,
              {
                opacity: screenIn.interpolate({
                  inputRange: [0, 0.6, 1],
                  outputRange: [0, 1, 1],
                }),
                transform: [
                  {
                    translateY: screenIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-30, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrow}>✦  YOUR HERO IS READY!</Text>
            </View>
            <Text style={styles.pageTitle}>Pick your adventure ✨</Text>
            <Text style={styles.description}>
              Bring your drawing to life in a magical adventure!
            </Text>
          </Animated.View>

          <View style={styles.genreLayout}>
            <Animated.View
              style={[
                styles.heroPanel,
                {
                  opacity: screenIn.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 1, 1],
                  }),
                  transform: [
                    {
                      scale: screenIn.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [0.2, 1.1, 1],
                      }),
                    },
                    {
                      rotate: screenIn.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-14deg', '0deg'],
                      }),
                    },
                  ],
                },
              ]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.heroSpot,
                  {
                    opacity: breath.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.14, 0.3],
                    }),
                    transform: [
                      {
                        scale: breath.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.cardEyebrow}>MEET YOUR LITTLE HERO</Text>
              {showcaseSource ? (
                <Animated.Image
                  source={showcaseSource}
                  style={[
                    styles.heroImage,
                    {
                      transform: [
                        {
                          translateY: bob.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -9],
                          }),
                        },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={styles.heroCaption}>
                One drawing. A thousand possibilities.
              </Text>
              <Burst x="50%" y="45%" delay={450} />
            </Animated.View>

            <Animated.View
              style={[
                styles.genrePanel,
                {
                  opacity: screenIn.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 1],
                  }),
                  transform: [
                    {
                      translateY: screenIn.interpolate({
                        inputRange: [0, 1],
                        outputRange: [70, 0],
                      }),
                    },
                  ],
                },
              ]}>
              <View style={styles.genreGrid}>
                <Pressable
                  focusable
                  onPress={() => void createStory('magical')}
                  disabled={storyLoading}
                  style={({pressed}) => [
                    styles.genreCard,
                    pressed && styles.genreCardPressed,
                    storyLoading && styles.genreCardDisabled,
                  ]}>
                  <Text style={styles.genreEmoji}>✨</Text>
                  <Text style={styles.genreTitle}>Start Your Story</Text>
                  <Text style={styles.genreDescription}>
                    Bring your drawing to life in a magical adventure.
                  </Text>
                  <View style={styles.genreActionPill}>
                    <Text style={styles.genreAction}>
                      {storyLoading ? 'CREATING…' : 'LET’S BEGIN  ›'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
            </Animated.View>
          </View>

          {/* While the story and narration are being prepared */}
          {storyLoading && (
            <View style={styles.loadingOverlay}>
              <Animated.Image
                source={heroSource}
                resizeMode="contain"
                style={[
                  styles.loadingHero,
                  {
                    transform: [
                      {
                        translateY: bob.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -14],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.loadingTitle}>
                Your hero is getting ready...
              </Text>
              <Text style={styles.loadingSubtitle}>
                Painting the first page of your adventure
              </Text>
            </View>
          )}
        </View>
      )}

      {screen === 'ending' && (
        <View style={styles.endingContent}>
          <Animated.Image
            source={heroSource}
            resizeMode="contain"
            style={[
              styles.endingHero,
              {
                transform: [
                  {
                    translateY: beat.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -18],
                    }),
                  },
                ],
              },
            ]}
          />
          <Burst x="50%" y="28%" delay={250} />
          <Text style={styles.endingTitle}>The End</Text>
          <Text style={styles.endingText}>
            Every great adventure begins with a little imagination.
          </Text>
          <Pressable
            focusable
            onPress={returnToGenres}
            style={({pressed}) => [
              styles.controlButton,
              styles.nextButton,
              pressed && styles.controlPressed,
            ]}>
            <Text style={styles.nextButtonText}>New Adventure  ↻</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>MADE FOR LITTLE STORYTELLERS</Text>
        <Text style={styles.footerRight}>A NEW ADVENTURE AWAITS ✦</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#120C3D',
    paddingHorizontal: 48,
    paddingTop: 20,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    marginBottom: 12,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFD166',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    color: '#3A2300',
    fontSize: 23,
    fontWeight: 'bold',
  },
  brandBlock: {
    marginLeft: 12,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  edition: {
    color: '#A89BCB',
    fontSize: 8,
    letterSpacing: 1.7,
    marginTop: 4,
  },
  headerRight: {
    marginLeft: 'auto',
  },
  headerLabel: {
    color: '#81769F',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  pairingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 38,
  },
  intro: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#C4ADFF',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 12,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: 'bold',
    lineHeight: 49,
  },
  description: {
    color: '#B8B2CB',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 19,
    maxWidth: 420,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#67558E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#D8CAFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepText: {
    marginLeft: 11,
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepDescription: {
    color: '#A49DB9',
    fontSize: 10,
    marginTop: 3,
  },
  qrCard: {
    width: 290,
    minHeight: 360,
    borderRadius: 26,
    backgroundColor: '#2A1F6B',
    borderWidth: 3,
    borderColor: '#FFD166',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    color: '#C4B4E8',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 13,
    textAlign: 'center',
  },
  qrBox: {
    width: 142,
    height: 142,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: {
    width: 136,
    height: 136,
  },
  qrLoading: {
    color: '#100E20',
    fontSize: 12,
  },
  codeLabel: {
    color: '#A89BCB',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 12,
  },
  code: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: 'bold',
    letterSpacing: 5,
    marginTop: 4,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D5A65A',
  },
  statusDotActive: {
    backgroundColor: '#62D8A0',
  },
  status: {
    color: '#B8B2CB',
    fontSize: 10,
    textAlign: 'center',
    flexShrink: 1,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  genreIntro: {
    marginBottom: 17,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: 'bold',
  },
  genreLayout: {
    flexDirection: 'row',
    gap: 20,
    flex: 1,
    maxHeight: 385,
  },
  heroPanel: {
    width: '32%',
    borderRadius: 22,
    backgroundColor: '#2A1F6B',
    borderWidth: 2,
    borderColor: '#FFD166',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEyebrow: {
    color: '#C4ADFF',
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 9,
  },
  heroImage: {
    width: '100%',
    height: 215,
  },
  heroCaption: {
    color: '#C8BFDC',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  genrePanel: {
    flex: 1,
    justifyContent: 'center',
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genreCard: {
    width: '100%',
    minHeight: 190,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFD166',
    backgroundColor: '#5B34B8',
    padding: 22,
    justifyContent: 'center',
  },
  genreCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{scale: 1}],
  },
  genreCardPressed: {
    opacity: 0.8,
  },
  genreCardDisabled: {
    opacity: 0.6,
  },
  genreEmoji: {
    fontSize: 27,
    marginBottom: 6,
  },
  genreTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  genreDescription: {
    color: '#F0EAF9',
    fontSize: 12,
    marginTop: 6,
  },
  genreAction: {
    color: '#3A2300',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  genreActionPill: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFD166',
  },
  errorText: {
    color: '#FFB8B8',
    fontSize: 11,
    marginTop: 8,
  },

  // Loading overlay (while the story is being created)
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#100E20F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingHero: {
    width: 170,
    height: 190,
  },
  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 14,
  },
  loadingSubtitle: {
    color: '#C8BFDC',
    fontSize: 13,
    marginTop: 6,
  },

  // Story stage
  storyRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#100E20',
  },
  shadow: {
    position: 'absolute',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: SAFE - 16,
    left: SAFE,
    right: SAFE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titlePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#100E20B3',
  },
  titlePillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#100E20B3',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4B3E67',
  },
  dotActive: {
    backgroundColor: '#FFE08A',
  },
  miniButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#100E20B3',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  miniButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#B9A0FF',
  },
  miniButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2,
  },
  captionBar: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    bottom: SAFE * 0.6,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#100E20A6',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },

  // Ending
  endingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endingHero: {
    width: 190,
    height: 210,
  },
  endingTitle: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: 'bold',
    marginTop: 8,
  },
  endingText: {
    color: '#C8BFDC',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 22,
    textAlign: 'center',
  },

  // Shared buttons
  controlButton: {
    minWidth: 125,
    minHeight: 43,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#67558E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#211B39',
  },
  controlDisabled: {
    opacity: 0.35,
  },
  controlFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  controlPressed: {
    opacity: 0.75,
  },
  nextButton: {
    backgroundColor: '#B9A0FF',
    borderColor: '#B9A0FF',
  },
  nextButtonText: {
    color: '#100E20',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    minHeight: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
  },
  footerLeft: {
    color: '#716785',
    fontSize: 8,
    letterSpacing: 1.5,
  },
  footerRight: {
    color: '#A89BCB',
    fontSize: 8,
    letterSpacing: 1.2,
  },
  // ---- New look: first page, hero reveal, storybook cover -------------------
  eyebrowPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,209,102,0.16)',
  },
  welcomeGold: {
    color: '#FFD166',
    marginBottom: 12,
  },
  qrWrap: {
    width: 290,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrGlow: {
    position: 'absolute',
    left: -16,
    right: -16,
    top: -16,
    bottom: -16,
    borderRadius: 40,
    backgroundColor: '#FFD166',
  },
  scanPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#FFD166',
  },
  scanPillText: {
    color: '#3A2300',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  mascot: {
    position: 'absolute',
    left: -58,
    bottom: -14,
    width: 100,
    height: 100,
  },
  heroSpot: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#FFD166',
  },
  bookPanel: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#2B1D6B',
  },
  bookFrameOuter: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    bottom: 10,
    borderWidth: 4,
    borderColor: '#FFD166',
    borderRadius: 12,
  },
  bookFrameInner: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: 28,
    bottom: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,209,102,0.5)',
    borderRadius: 8,
  },
  bookCorner: {
    position: 'absolute',
    color: '#FFD166',
    fontSize: 26,
  },
  bookStarSmall: {
    position: 'absolute',
    color: 'rgba(255,209,102,0.45)',
    fontSize: 20,
  },
  bookSpine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: '#E6A817',
  },
  bookMedal: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 5,
    borderColor: '#FFD166',
    backgroundColor: '#4B2FB0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMedalStar: {
    color: '#FFD166',
    fontSize: 56,
  },
  bookKicker: {
    color: '#FFE9A8',
    fontSize: 12,
    letterSpacing: 3,
    marginTop: 14,
  },
  bookRibbon: {
    marginTop: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#C2185B',
    borderWidth: 2,
    borderColor: '#FFD166',
  },
  bookTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bookHint: {
    color: '#D9D2F5',
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 12,
  },
});


export default App;