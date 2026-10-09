# SketchTales TV — Friction Log

## FL-001: Vega simulator audio playback failure

**Task attempted:** Verify that the Vega app can play an MP3 from a URL for story narration.

**Steps taken:**
1. Installed `@amazon-devices/react-native-w3cmedia`.
2. Created an audio feasibility test using `AudioPlayer`.
3. Built, installed, and launched the app on the Vega simulator.
4. Confirmed that the app loaded the MP3 source but no sound was audible.
5. Added audio service declarations to `manifest.toml`.
6. Rebuilt and reinstalled the app.

**Expected result:** The MP3 should play audibly in the Vega simulator.

**Actual result:** Initially, no sound was audible and the app displayed media error code 4. After adding the audio service declarations and rebuilding, audio became audible. The exact root cause has not been isolated.

**Severity:** High — audio narration is a core requirement of SketchTales TV.

**Workaround used:** Added audio service declarations to the manifest, rebuilt the app, and reinstalled it.

**Actionable suggestion:** Provide a minimal, tested Vega audio-playback example that includes the required manifest declarations, supported media formats, and troubleshooting guidance for media error codes.
