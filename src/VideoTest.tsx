import React, { useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Video } from '@amazon-devices/react-native-w3cmedia';

export function VideoTest() {
  const videoRef = useRef<any>(null);
  const [events, setEvents] = useState<string[]>(['Waiting for media events...']);

  const log = (name: string) => {
    setEvents(previous => [name, ...previous].slice(0, 8));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#101522', padding: 24 }}>
      <Text style={{ color: 'white', fontSize: 26, marginBottom: 12 }}>
        SketchTales TV — Media Diagnostics
      </Text>
      <Video
        ref={(ref: any) => { videoRef.current = ref; }}
        src="https://hits-refused-continent-technological.trycloudflare.com/scene1_vega_test.mp4"
        autoplay={true}
        controls={true}
        scalingmode="fit"
        width={1280}
        height={720}
        onLoadStart={() => log('loadstart')}
        onLoadedMetadata={() => log('loadedmetadata')}
        onLoadedData={() => log('loadeddata')}
        onCanPlay={() => log('canplay')}
        onPlaying={() => log('playing')}
        onStalled={() => log('stalled')}
        onSuspend={() => log('suspend')}
        onAbort={() => log('abort')}
        onError={(event: any) => log('ERROR: ' + JSON.stringify(event))}
      />
      <View style={{ marginTop: 16 }}>
        {events.map((event, index) => (
          <Text key={index} style={{ color: '#8FE3B0', fontSize: 18 }}>
            {event}
          </Text>
        ))}
      </View>
    </View>
  );
}
