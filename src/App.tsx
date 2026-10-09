
import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

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

export const App = () => {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [status, setStatus] = useState(
    'Connecting to pairing service...',
  );
  const [drawingUri, setDrawingUri] = useState<string | null>(null);

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

            if (!latest.hasDrawing) {
              setStatus('Phone connected! Upload your drawing to continue.');
              return;
            }

            if (drawingLoaded) {
              return;
            }

            setStatus('Drawing uploaded! Loading your little hero...');

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
            setStatus('Drawing received! Your adventure is ready.');
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

  const steps = [
    {
      title: 'Open the pairing page',
      description: 'Connect your phone to this TV.',
    },
    {
      title: 'Upload your drawing',
      description: "Your drawing becomes the story's hero.",
    },
    {
      title: 'Watch it come alive',
      description: 'Discover an animated, narrated adventure.',
    },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandIcon}>✦</Text>
        </View>

        <Text style={styles.brand}>SKETCHTALES</Text>
        <Text style={styles.edition}>YOUR ART. YOUR ADVENTURE.</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.eyebrow}>LET IMAGINATION TAKE FLIGHT</Text>

          <Text style={styles.title}>
            {drawingUri
              ? 'Meet your little hero.'
              : 'Every drawing\nhas a story.'}
          </Text>

          <Text style={styles.description}>
            {drawingUri
              ? 'Your artwork has arrived! This is the hero who will star in your adventure.'
              : "Bring your little artist's creation to life. Connect a phone to begin your adventure together."}
          </Text>

          {steps.map((item, index) => (
            <View style={styles.stepRow} key={item.title}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>

              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.right}>
          {drawingUri ? (
            <View style={styles.drawingCard}>
              <Text style={styles.cardTitle}>YOUR LITTLE HERO</Text>

              <Text style={styles.cardSubtitle}>
                Your drawing is ready for its story
              </Text>

              <View style={styles.drawingFrame}>
                <Image
                  source={{uri: drawingUri}}
                  style={styles.drawingImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.status}>{status}</Text>
            </View>
          ) : (
            <>
              <View style={styles.artCard}>
                <Text style={styles.cardTitle}>Connect your phone</Text>

                <Text style={styles.cardSubtitle}>
                  Scan this code to start your story
                </Text>

                <View style={styles.qrBox}>
                  {session ? (
                    <Image
                      source={{uri: session.qrCode}}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.qrLoading}>Loading QR…</Text>
                  )}
                </View>

                <Text style={styles.codeLabel}>YOUR PAIRING CODE</Text>

                <Text style={styles.code}>
                  {session ? session.code : '------'}
                </Text>

                <Text style={styles.status}>{status}</Text>
              </View>

              <View style={styles.connectionCard}>
                <View style={styles.phoneIcon}>
                  <Text style={styles.phoneSymbol}>▯</Text>
                </View>

                <View style={styles.connectionText}>
                  <Text style={styles.connectionTitle}>
                    Phone connection
                  </Text>

                  <Text style={styles.connectionSubtitle}>
                    {session?.status === 'paired'
                      ? 'Connected'
                      : 'Waiting for phone'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.pendingDot,
                    session?.status === 'paired' && styles.connectedDot,
                  ]}
                />
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>MADE FOR LITTLE STORYTELLERS</Text>
        <Text style={styles.footerRight}>A NEW ADVENTURE AWAITS ✦</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#100E20',
    paddingHorizontal: 54,
    paddingVertical: 25,
  },
  header: {
    alignItems: 'flex-start',
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#B9A0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    color: '#100E20',
    fontSize: 21,
    fontWeight: 'bold',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginTop: 9,
  },
  edition: {
    color: '#A89BCB',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 5,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
  },
  left: {
    flex: 1.05,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#C4ADFF',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 43,
    fontWeight: 'bold',
    lineHeight: 51,
  },
  description: {
    color: '#B8B2CB',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 17,
    marginBottom: 24,
    maxWidth: 370,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
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
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepText: {
    marginLeft: 12,
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepDescription: {
    color: '#A49DB9',
    fontSize: 11,
    marginTop: 4,
  },
  right: {
    flex: 0.95,
    maxWidth: 360,
  },
  artCard: {
    minHeight: 370,
    borderRadius: 24,
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
    fontSize: 12,
    marginTop: 7,
    marginBottom: 16,
    textAlign: 'center',
  },
  qrBox: {
    width: 145,
    height: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: {
    width: 135,
    height: 135,
  },
  qrLoading: {
    color: '#100E20',
    fontSize: 12,
  },
  codeLabel: {
    color: '#B9A0FF',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 15,
  },
  code: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: 'bold',
    letterSpacing: 6,
    marginTop: 5,
  },
  status: {
    color: '#C4B4E8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
  connectionCard: {
    marginTop: 13,
    height: 65,
    borderRadius: 14,
    backgroundColor: '#1B172E',
    borderWidth: 1,
    borderColor: '#332A4B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  phoneIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#302548',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSymbol: {
    color: '#D2BEFF',
    fontSize: 24,
  },
  connectionText: {
    flex: 1,
    marginLeft: 11,
  },
  connectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectionSubtitle: {
    color: '#A49BB9',
    fontSize: 10,
    marginTop: 4,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7B96B',
  },
  connectedDot: {
    backgroundColor: '#8FE0B1',
  },
  drawingCard: {
    minHeight: 370,
    borderRadius: 24,
    backgroundColor: '#211B39',
    borderWidth: 1,
    borderColor: '#3E335B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  drawingFrame: {
    width: '100%',
    height: 245,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    overflow: 'hidden',
  },
  drawingImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2540',
  },
  footerLeft: {
    color: '#827A9A',
    fontSize: 9,
    letterSpacing: 1.3,
  },
  footerRight: {
    color: '#B9A0FF',
    fontSize: 9,
    letterSpacing: 1.2,
  },
});
