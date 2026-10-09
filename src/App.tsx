
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AudioPlayer} from '@amazon-devices/react-native-w3cmedia';

export const App = () => {
  const audio = useRef<AudioPlayer | null>(null);
  const [status, setStatus] = useState('Initializing audio player...');

  useEffect(() => {
    let active = true;
    const player = new AudioPlayer();
    audio.current = player;

    const updateStatus = (message: string) => {
      if (active) {
        setStatus(message);
      }
    };

    const onError = () => {
      const mediaError = (player as any).error;
      updateStatus(
        `Media error: code=${mediaError?.code ?? 'unknown'}, message=${mediaError?.message ?? 'no details'}`,
      );
    };

    const onCanPlay = () => {
      updateStatus('MP3 can play. Checking audible playback...');
    };

    const onPlaying = () => {
      updateStatus('Playback started. Check whether sound is audible.');
    };

    const onEnded = () => {
      updateStatus('MP3 playback ended.');
    };

    player.addEventListener('error', onError);
    player.addEventListener('canplay', onCanPlay);
    player.addEventListener('playing', onPlaying);
    player.addEventListener('ended', onEnded);

    const start = async () => {
      try {
        await player.initialize();

        if (!active) {
          await player.deinitialize();
          return;
        }

        player.src =
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

        player.autoplay = true;
        updateStatus('MP3 source set. Requesting playback...');

        await player.play();
        updateStatus(
          `Play request resolved. Ready state: ${player.readyState}; network state: ${player.networkState}.`,
        );
      } catch (error) {
        updateStatus(`Audio error: ${String(error)}`);
      }
    };

    void start();

    return () => {
      active = false;
      player.removeEventListener('error', onError);
      player.removeEventListener('canplay', onCanPlay);
      player.removeEventListener('playing', onPlaying);
      player.removeEventListener('ended', onEnded);
      audio.current = null;
      void player.deinitialize().catch(() => {});
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SketchTales TV</Text>
      <Text style={styles.subtitle}>Audio feasibility test</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.footer}>
        Listen for the MP3. A successful play request does not guarantee
        audible sound.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 48,
    backgroundColor: '#151329',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#D5C8FF',
    fontSize: 24,
    marginTop: 12,
  },
  status: {
    color: '#FFFFFF',
    fontSize: 20,
    marginTop: 32,
  },
  footer: {
    color: '#D5C8FF',
    fontSize: 16,
    marginTop: 20,
  },
});
