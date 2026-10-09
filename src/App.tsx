
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const TEST_MESSAGE = 'SketchTales-TV-WebSocket-Test';

export const App = () => {
  const [status, setStatus] = useState('Connecting to WebSocket...');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let receivedReply = false;

    const updateStatus = (message: string) => {
      if (active) {
        setStatus(message);
      }
    };

    let socket: WebSocket;

    try {
      socket = new WebSocket('wss://echo.websocket.org');
      socketRef.current = socket;

      socket.onopen = () => {
        updateStatus('Connected. Sending test message...');

        try {
          socket.send(TEST_MESSAGE);
        } catch (error) {
          updateStatus(`Send failed: ${String(error)}`);
        }
      };

      socket.onmessage = event => {
        const message = String(event.data);

        if (message === TEST_MESSAGE) {
          receivedReply = true;
          updateStatus('PASS: WebSocket connected and echo received.');
        } else {
          updateStatus(`Message received: ${message}`);
        }
      };

      socket.onerror = () => {
        updateStatus('WebSocket error. Check logs for details.');
      };

      socket.onclose = event => {
        if (!receivedReply) {
          updateStatus(
            `WebSocket closed before echo. Code: ${event.code}`,
          );
        }
      };
    } catch (error) {
      updateStatus(`WebSocket setup failed: ${String(error)}`);
    }

    return () => {
      active = false;
      socketRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SketchTales TV</Text>
      <Text style={styles.subtitle}>WebSocket feasibility test</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.footer}>
        Testing a secure WebSocket connection and message round-trip.
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
