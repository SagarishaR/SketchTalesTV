# SketchTales TV — Friction Log

## Overview

| ID | Area | Issue | Status |
|---|---|---|---|
| FL-001 | Audio playback | MP3 loaded but no sound played in the Vega simulator | Resolved with a manifest change; exact root cause unconfirmed |
| FL-002 | Drawing upload and display | Uploaded drawing needed additional API integration to appear on the TV | Resolved and tested |
| FL-003 | OpenCV character extraction | Background removal and large photo cutouts needed debugging and resizing | Prototype works; generalization pending |
| FL-004 | TV background rendering | Background sizing and stage dimensions needed adjustment to preserve image proportions and character positioning | Resolved and tested in the current simulator setup |

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

I started by testing the upload endpoint with a small PNG image. The upload and retrieval worked, but the test image was only 1 × 1 pixel, so it was not useful for checking the actual drawing display.

I then updated the phone page to support image selection, preview, and upload. During testing, I initially could not see the upload section until I refreshed the page and scrolled down.

The backend could receive the image, but the TV only checked whether a drawing had been uploaded. I had to add another API request so the TV could retrieve the actual image.

While integrating the display logic, I also encountered a JSX parenthesis mismatch that stopped the app from building.

**How I resolved it:**

1. Added Multer-based uploads with an 8 MB size limit and JPEG/PNG validation.
2. Added an API endpoint to retrieve the uploaded drawing.
3. Updated the phone page to select, preview, and upload images.
4. Updated the TV app to poll for new uploads, retrieve the image, and display it.
5. Corrected the JSX syntax and rebuilt the app.
6. Tested the flow using an actual drawing image.

**Expected result:** The phone should upload a drawing, and the TV should retrieve and display the same image.

**Actual result:** The upload succeeded, and the drawing appeared on the Vega simulator. The end-to-end phone-to-TV drawing flow is working.

**Severity:** High — transferring and displaying the child's drawing is essential to the core experience.

**Workaround used:** Added a dedicated drawing retrieval endpoint and connected it to the TV's polling logic.

**Actionable suggestion:** Provide an end-to-end Vega example covering mobile image uploads, multipart requests, image retrieval, and React Native image rendering, with troubleshooting guidance for common integration errors.

**Remaining limitations:** Drawings are currently stored in backend memory and transferred as Base64 data. Persistent storage, image preprocessing, and hero cutout were still pending at this stage of development.

---

## FL-003: OpenCV character extraction and oversized cutout

**Task attempted:** Remove the paper background from an uploaded drawing and prepare a transparent character PNG for story-scene composition.

**What happened:**

I installed OpenCV and NumPy in a dedicated Python virtual environment under `backend/.venv`. I first tested extraction using a 680 × 680 cartoon elephant image. The initial diagnostic reported 0% transparency, so I investigated the flood-fill mask and corrected the extraction script.

The corrected approach identified white regions connected to the image border as background while preserving enclosed white regions inside the elephant. A preview on a contrasting purple background showed that the elephant's main shape and white interior were preserved. The source watermark remained in the image.

I then created a reusable Python extraction script and a Node.js helper that invokes it through a subprocess. The Node-to-Python bridge successfully generated a transparent PNG.

During end-to-end testing, a photograph uploaded from the phone measured 3072 × 4080 pixels. The resulting cutout was approximately 16 MB, and its Base64 API response was about 20.6 million characters. This was too large for an efficient TV story pipeline.

**How I resolved it:**

1. Created an isolated Python virtual environment and installed OpenCV and NumPy.
2. Developed and tested a flood-fill-based background-removal script.
3. Added a Node.js-to-Python processing bridge.
4. Integrated processing into the drawing-upload endpoint and added a separate cutout retrieval endpoint.
5. Limited the longest output dimension to 1024 pixels and enabled PNG compression.
6. Re-uploaded a drawing and verified that the processed output measured 771 × 1024 pixels and was approximately 653 KB.

**Expected result:** Uploaded drawings should produce transparent PNG assets that can later be composited onto story backgrounds without displaying the cutout as a separate screen on the TV.

**Actual result:** The processing pipeline and cutout endpoint work, and resizing reduced the tested output from approximately 16 MB to 653 KB. The phone-to-TV flow continued to display the original photograph.

**Severity:** High — character extraction is a key part of preserving the child's artwork in generated story scenes.

**Remaining limitations:**

- The extraction approach works best with near-white backgrounds and sufficiently enclosed outlines.
- The tested source image still contains a watermark.
- Photographs with shadows, colored paper, gaps in outlines, or surrounding screen/laptop backgrounds may produce inaccurate cutouts.
- The output has not yet been validated against a diverse set of real drawings.
- The backend stores images in memory as Base64 data, so they are lost when the backend restarts.
- The TV had not yet consumed the cutout for scene composition at the time of the initial extraction tests.

**Next action:** Validate extraction on varied drawings, improve image validation and background removal, and use the cutout as an internal asset in the story-scene composition pipeline.

---

## FL-004: TV story background rendering and stage sizing

**Task attempted:** Ensure story backgrounds fit the Vega TV stage correctly without distortion, while preserving character positioning and animation.

**What happened:**

During story playback testing, the stage dimensions and background rendering needed further adjustment. The stage was initially initialized with fixed dimensions of 1200 × 650 pixels. Since the actual TV layout can differ, the rendering logic needed to account for the stage's measured dimensions.

The background images were also being rendered using `resizeMode="stretch"`, which could distort images when their aspect ratio differed from the TV stage. The scene backgrounds were mapped directly in `src/App.tsx`, while the separate background-generation script was not integrated into the current rendering flow.

**How I resolved it:**

1. Used React Native's `onLayout` to obtain the actual stage width and height.
2. Stored the measured dimensions in the stage state and used them in the rendering and character-positioning calculations.
3. Updated the background rendering to use an absolutely positioned image with `resizeMode="contain"`.
4. Rebuilt and tested the app in the Vega virtual TV simulator.
5. Verified that the background rendering, character animation, and scene transitions worked as expected.

**Expected result:** Story backgrounds should fit the TV stage without distortion, while character positioning, animation, and scene transitions remain functional.

**Actual result:** The updated rendering works correctly in the tested simulator setup. Background display, character animation, and scene transitions are working as expected.

**Severity:** Medium — incorrect background sizing can affect the visual quality and presentation of the story.

**Workaround used:** Used dynamically measured stage dimensions and aspect-ratio-preserving image rendering instead of stretching backgrounds.

**Remaining limitations:**

- The `contain` resize mode may leave unused space when the background and stage have different aspect ratios.
- The current scene-background rendering does not automatically generate new backgrounds for each story.
- Layout behavior should be validated on additional supported TV resolutions and aspect ratios.

**Next action:** Preserve the current working implementation, validate the rendering on other screen sizes if available, and investigate integrating story-specific backgrounds into the existing scene-generation pipeline.

---

## Notes

This log records issues encountered during development, the steps taken to resolve them, and the limitations that remain. The observations are based on testing performed during the SketchTales TV implementation.

Resolved issues are retained for traceability. Remaining limitations describe the state of the implementation and may change as development progresses.
