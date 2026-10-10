
import React, {useEffect, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const API_BASE = 'http://192.168.29.48:3000';

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
};

type Story = {
  id: string;
  genre: string;
  title: string;
  scenes: StoryScene[];
  mode: string;
};

const genres = [
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

export const App = () => {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [status, setStatus] = useState(
    'Connecting to pairing service...',
  );
  const [drawingUri, setDrawingUri] = useState<string | null>(null);
  const [screen, setScreen] = useState<'pairing' | 'genres' | 'story'>(
    'pairing',
  );
  const [selectedGenre, setSelectedGenre] = useState('magical');
  const [story, setStory] = useState<Story | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [storyLoading, setStoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    let drawingLoaded = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let isPolling = false;

    const startPairing = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/pairing`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            phoneUrl: `${API_BASE}/phone.html`,
          }),
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
          if (isPolling || !active || drawingLoaded) {
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

            if (!latest.hasDrawing) {
              setStatus('Phone connected! Upload your drawing to continue.');
              return;
            }

            setStatus('Drawing uploaded! Preparing your hero...');

            const drawingResponse = await fetch(
              `${API_BASE}/api/pairing/${data.code}/drawing`,
            );

            if (!drawingResponse.ok) {
              throw new Error('Could not retrieve the drawing');
            }

            const drawingData: DrawingResponse =
              await drawingResponse.json();

            if (!active) {
              return;
            }

            setDrawingUri(
              `data:${drawingData.mimeType};base64,${drawingData.data}`,
            );

            drawingLoaded = true;
            setScreen('genres');
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

      setStory(result as Story);
      setSceneIndex(0);
      setScreen('story');
      setStatus('Your adventure is ready!');
    } catch (error) {
      setErrorMessage(
        `${String(error)}. Check that the backend is running.`,
      );
    } finally {
      setStoryLoading(false);
    }
  };

  const currentScene = story?.scenes[sceneIndex];
  const isFirstScene = sceneIndex === 0;
  const isLastScene = story
    ? sceneIndex === story.scenes.length - 1
    : false;

  const returnToGenres = () => {
    setStory(null);
    setSceneIndex(0);
    setErrorMessage('');
    setScreen('genres');
  };

  return (
    <View style={styles.screen}>
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
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>LET IMAGINATION TAKE FLIGHT</Text>
            <Text style={styles.welcomeTitle}>
              Every drawing{'\n'}has a story.
            </Text>
            <Text style={styles.description}>
              Bring your little artist's creation to life. Connect a phone,
              upload a drawing and turn it into a storybook adventure.
            </Text>

            {[
              ['01', 'Connect your phone', 'Scan the QR code to get started.'],
              ['02', 'Upload your drawing', 'Your artwork becomes the hero.'],
              ['03', 'Choose an adventure', 'Pick a world and let the story begin.'],
            ].map(item => (
              <View style={styles.stepRow} key={item[0]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{item[0]}</Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{item[1]}</Text>
                  <Text style={styles.stepDescription}>{item[2]}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.qrCard}>
            <Text style={styles.cardTitle}>Connect your phone</Text>
            <Text style={styles.cardSubtitle}>
              Scan to begin your story
            </Text>
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
        </View>
      )}

      {screen === 'genres' && (
        <View style={styles.mainContent}>
          <View style={styles.genreIntro}>
            <Text style={styles.eyebrow}>YOUR DRAWING IS READY</Text>
            <Text style={styles.pageTitle}>Choose a story adventure</Text>
            <Text style={styles.description}>
              Pick the world you want to explore. Your little hero is waiting!
            </Text>
          </View>

          <View style={styles.genreLayout}>
            <View style={styles.heroPanel}>
              <Text style={styles.cardEyebrow}>MEET YOUR LITTLE HERO</Text>
              {drawingUri ? (
                <Image
                  source={{uri: drawingUri}}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={styles.heroCaption}>
                One drawing. A thousand possibilities.
              </Text>
            </View>

            <View style={styles.genrePanel}>
              <View style={styles.genreGrid}>
                {genres.map(genre => (
                  <Pressable
                    key={genre.id}
                    focusable
                    onPress={() => void createStory(genre.id)}
                    disabled={storyLoading}
                    style={({focused, pressed}) => [
                      styles.genreCard,
                      {backgroundColor: genre.color},
                      focused && styles.genreCardFocused,
                      pressed && styles.genreCardPressed,
                      storyLoading && styles.genreCardDisabled,
                    ]}>
                    <Text style={styles.genreEmoji}>{genre.emoji}</Text>
                    <Text style={styles.genreTitle}>{genre.title}</Text>
                    <Text style={styles.genreDescription}>
                      {genre.description}
                    </Text>
                    <Text style={styles.genreAction}>
                      {storyLoading && selectedGenre === genre.id
                        ? 'Creating...'
                        : 'SELECT  ›'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {storyLoading && (
                <Text style={styles.status}>
                  Creating your adventure. Just a moment...
                </Text>
              )}
              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {screen === 'story' && story && currentScene && (
        <View style={styles.storyContent}>
          <View style={styles.storyTop}>
            <View style={styles.storyTitleBlock}>
              <Text style={styles.eyebrow}>
                YOUR DRAWING, YOUR ADVENTURE
              </Text>
              <Text style={styles.storyTitle}>{story.title}</Text>
            </View>
            <View style={styles.sceneBadge}>
              <Text style={styles.sceneBadgeText}>
                SCENE {sceneIndex + 1} OF {story.scenes.length}
              </Text>
            </View>
          </View>

          <View style={styles.storyBody}>
            <View style={styles.storyArt}>
              {drawingUri ? (
                <Image
                  source={{uri: drawingUri}}
                  style={styles.storyHeroImage}
                  resizeMode="contain"
                />
              ) : null}
              <View style={styles.artPlaceholder}>
                <Text style={styles.artPlaceholderEmoji}>✦</Text>
                <Text style={styles.artPlaceholderTitle}>
                  Storybook scene
                </Text>
                <Text style={styles.artPlaceholderText}>
                  {currentScene.visualPrompt}
                </Text>
              </View>
            </View>

            <View style={styles.narrationPanel}>
              <Text style={styles.sceneNumber}>
                CHAPTER {String(currentScene.number).padStart(2, '0')}
              </Text>
              <Text style={styles.sceneTitle}>{currentScene.title}</Text>
              <View style={styles.narrationDivider} />
              <ScrollView
                style={styles.narrationScroll}
                contentContainerStyle={styles.narrationScrollContent}>
                <Text style={styles.narrationText}>
                  {currentScene.narration}
                </Text>
              </ScrollView>
              <Text style={styles.narrationNote}>
                NARRATION TEXT PREVIEW · AUDIO COMING NEXT
              </Text>
            </View>
          </View>

          <View style={styles.storyControls}>
            <Pressable
              focusable
              disabled={isFirstScene}
              onPress={() =>
                setSceneIndex(index => Math.max(0, index - 1))
              }
              style={({focused, pressed}) => [
                styles.controlButton,
                isFirstScene && styles.controlDisabled,
                focused && styles.controlFocused,
                pressed && styles.controlPressed,
              ]}>
              <Text style={styles.controlText}>‹  Previous</Text>
            </Pressable>

            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        ((sceneIndex + 1) / story.scenes.length) * 100
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {sceneIndex + 1} / {story.scenes.length} scenes
              </Text>
            </View>

            <Pressable
              focusable
              onPress={() => {
                if (isLastScene) {
                  returnToGenres();
                } else {
                  setSceneIndex(index =>
                    Math.min(story.scenes.length - 1, index + 1),
                  );
                }
              }}
              style={({focused, pressed}) => [
                styles.controlButton,
                styles.nextButton,
                focused && styles.controlFocused,
                pressed && styles.controlPressed,
              ]}>
              <Text style={styles.nextButtonText}>
                {isLastScene ? 'New Adventure  ↻' : 'Next Scene  ›'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>MADE FOR LITTLE STORYTELLERS</Text>
        <Text style={styles.footerRight}>
          {screen === 'story'
            ? 'EVERY STORY LEAVES A LITTLE MAGIC ✦'
            : 'A NEW ADVENTURE AWAITS ✦'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#100E20',
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
    backgroundColor: '#B9A0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    color: '#100E20',
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
    borderRadius: 22,
    backgroundColor: '#211B39',
    borderWidth: 1,
    borderColor: '#3E335B',
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
    borderRadius: 18,
    backgroundColor: '#211B39',
    borderWidth: 1,
    borderColor: '#3E335B',
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
    width: '48%',
    minHeight: 155,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF20',
    padding: 13,
    justifyContent: 'center',
  },
  genreCardFocused: {
    borderColor: '#FFFFFF',
    transform: [{scale: 1.025}],
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
    fontSize: 17,
    fontWeight: 'bold',
  },
  genreDescription: {
    color: '#F0EAF9',
    fontSize: 10,
    marginTop: 4,
  },
  genreAction: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 10,
  },
  errorText: {
    color: '#FFB8B8',
    fontSize: 11,
    marginTop: 8,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  storyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  storyTitleBlock: {
    flex: 1,
  },
  storyTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: 'bold',
  },
  sceneBadge: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#302447',
    borderWidth: 1,
    borderColor: '#67558E',
  },
  sceneBadgeText: {
    color: '#D8CAFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  storyBody: {
    flex: 1,
    flexDirection: 'row',
    gap: 18,
    maxHeight: 330,
  },
  storyArt: {
    flex: 1.1,
    borderRadius: 18,
    backgroundColor: '#211B39',
    borderWidth: 1,
    borderColor: '#3E335B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  storyHeroImage: {
    width: '78%',
    height: '78%',
  },
  artPlaceholder: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#302447',
    padding: 12,
    alignItems: 'center',
  },
  artPlaceholderEmoji: {
    color: '#D8CAFF',
    fontSize: 20,
  },
  artPlaceholderTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  artPlaceholderText: {
    color: '#C8BFDC',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 5,
  },
  narrationPanel: {
    flex: 0.9,
    borderRadius: 18,
    backgroundColor: '#211B39',
    borderWidth: 1,
    borderColor: '#3E335B',
    padding: 18,
  },
  sceneNumber: {
    color: '#C4ADFF',
    fontSize: 9,
    letterSpacing: 2,
  },
  sceneTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: 'bold',
    marginTop: 9,
  },
  narrationDivider: {
    height: 1,
    backgroundColor: '#4B3E67',
    marginVertical: 13,
  },
  narrationScroll: {
    flex: 1,
  },
  narrationScrollContent: {
    flexGrow: 1,
  },
  narrationText: {
    color: '#E0DAED',
    fontSize: 15,
    lineHeight: 24,
  },
  narrationNote: {
    color: '#9486B2',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 10,
  },
  storyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 13,
  },
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
  controlText: {
    color: '#E0DAED',
    fontSize: 12,
    fontWeight: 'bold',
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
  progressBlock: {
    flex: 1,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    maxWidth: 260,
    height: 5,
    backgroundColor: '#382E4D',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    backgroundColor: '#B9A0FF',
    borderRadius: 3,
  },
  progressText: {
    color: '#A89BCB',
    fontSize: 10,
    marginTop: 7,
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
});

export default App;
