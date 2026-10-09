
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

export const App = () => {
  const [status, setStatus] = useState('Testing HTTPS...');

  useEffect(() => {
    let active = true;

    fetch('https://www.amazon.com')
      .then(response => {
        if (active) {
          setStatus(`HTTPS response received: ${response.status}`);
        }
      })
      .catch(error => {
        if (active) {
          setStatus(`HTTPS failed: ${String(error)}`);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SketchTales TV</Text>
      <Text style={styles.status}>{status}</Text>
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
    marginBottom: 24,
  },
  status: {
    color: '#D5C8FF',
    fontSize: 22,
  },
});
