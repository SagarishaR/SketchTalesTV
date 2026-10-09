# SketchTales TV — Friction Log

## Overview

| ID | Area | Issue | Status |
|---|---|---|---|
| FL-001 | Audio playback | MP3 loaded but no sound played in the Vega simulator | Resolved with a manifest change; exact root cause unconfirmed |
| FL-002 | Drawing upload and display | Uploaded drawing needed additional API integration to appear on the TV | Resolved and tested |

---

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

---

## FL-002: Getting drawing uploads working between phone and TV

**Task attempted:** Allow a user to connect a phone to SketchTales TV, upload a child's drawing, and see the same drawing displayed on the TV.

**What happened:**

I started by testing the upload endpoint with a small PNG image. The upload and retrieval worked, but the test image was only 1 × 1 pixel, so it wasn't useful for checking the actual drawing display.

I then updated the phone page to support image selection, preview, and upload. During testing, I initially couldn't see the upload section until I refreshed the page and scrolled down.

The backend could receive the image, but the TV only checked whether a drawing had been uploaded. I had to add another API request so the TV could retrieve the actual image.

While integrating the display logic, I also encountered a JSX parenthesis mismatch that stopped the app from building.

**How I resolved it:**

1. Added Multer-based uploads with an 8 MB size limit and JPEG/PNG validation.
2. Added an API endpoint to retrieve the uploaded drawing.
3. Updated the phone page to select, preview, and upload images.
4. Updated the TV app to poll for new uploads, retrieve the image, and display it.
5. Corrected the JSX syntax and rebuilt the app.
6. Tested the complete flow using an actual drawing image.

**Expected result:** The phone should upload a drawing, and the TV should retrieve and display the same image.

**Actual result:** The upload succeeded, and the drawing appeared on the Vega simulator. The end-to-end phone-to-TV drawing flow is working.

**Severity:** High — transferring and displaying the child's drawing is essential to the core experience.

**Workaround used:** Added a dedicated drawing retrieval endpoint and connected it to the TV's polling logic.

**Actionable suggestion:** Provide an end-to-end Vega example covering mobile image uploads, multipart requests, image retrieval, and React Native image rendering, with troubleshooting guidance for common integration errors.

**Remaining limitation:** Drawings are currently stored in backend memory and transferred as Base64 data. Persistent storage, image preprocessing, and hero cutout are still pending.

---

## Notes

This log records issues encountered during development, the steps taken to resolve them, and the limitations that remain. The observations are based on testing performed during the SketchTales TV implementation.