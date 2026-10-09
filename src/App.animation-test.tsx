import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export const App = () => {
  const bob = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    const bobAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -14,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    const panAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pan, {
          toValue: 20,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(pan, {
          toValue: -20,
          duration: 5000,
          useNativeDriver: true,
        }),
      ]),
    );

    bobAnimation.start();
    panAnimation.start();

    return () => {
      bobAnimation.stop();
      panAnimation.stop();
    };
  }, [bob, pan]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SketchTales TV</Text>
      <Text style={styles.subtitle}>
        Feasibility test: animated story hero
      </Text>

      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.hero,
            {
              transform: [
                {translateX: pan},
                {translateY: bob},
              ],
            },
          ]}>
          <Image
            source={require('./assets/vega.png')}
            style={styles.image}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Text style={styles.footer}>
        The hero should drift sideways and gently bob up and down.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151329',
    paddingHorizontal: 48,
    paddingVertical: 28,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#D5C8FF',
    fontSize: 22,
    marginTop: 8,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 12,
  },
  hero: {
    width: 400,
    height: 290,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    color: '#FFFFFF',
    fontSize: 18,
    paddingBottom: 8,
  },
});
