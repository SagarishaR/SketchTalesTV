# Friction Log: SketchTales TV

Project: SketchTales TV, built for **Build, Ship, Shape: Amazon Developer Hackathon** (Fire TV track, Vega OS, AWS Builder mini challenge).

**Severity scale:** **Blocker** = stopped the feature until solved. **High** = cost serious time or forced a design change. **Medium** = confusing, solved with effort. **Low** = annoyance.

| # | Tool                          | Problem                                                                  | Severity |
|---|-------------------------------|--------------------------------------------------------------------------|----------|
| F1 | Amazon Bedrock               | "Operation not allowed" from CLI/SDK while the console playground worked | Blocker  |
| F2 | Amazon Bedrock (Nova 2 Lite) | Model sometimes ignores the "mention something from the picture" rule    | Medium   |
| F3 | Amazon Bedrock (Nova 2 Lite) | About 4-5 s to write 8 scenes                                            | Low      |
| F4 | DynamoDB                     | `update-time-to-live` errors when TTL is already on                      | Low      |
| F5 | AWS CLI                      | Pager made finished output look unfinished                               | Low      |
| F6 | Vega OS / React Native       | Video surface covered the background pictures                            | High     |
| F7 | Vega OS                      | Camera not supported, so hand tracking moved to a phone web page         | High     |


---

## F1. Bedrock: "Operation not allowed" from CLI and SDK, console works

- **Task attempted:** Call Amazon Nova 2 Lite from our Node.js server to write story narration.
- **Steps taken:**
  1. Opened the Bedrock console playground in `ap-southeast-2`, chose Nova 2 Lite, sent a prompt. It worked and returned a story.
  2. In the terminal (IAM role session `AccountFullAccessRole`), ran:
     `aws bedrock-runtime converse --region ap-southeast-2 --model-id global.amazon.nova-2-lite-v1:0 --messages '[{"role":"user","content":[{"text":"Say hi in five words"}]}]'`
  3. Repeated with `--model-id amazon.nova-2-lite-v1:0`.
  4. Ran our Node smoke test (`node bedrockStory.js`), which uses the AWS SDK for JavaScript v3 `ConverseCommand`.
- **Expected:** The same model that answers in the console answers from the CLI/SDK, or the error says what is missing.
- **Actual:** Every call returned `ValidationException: Operation not allowed`, for both model IDs, from both the CLI and the SDK. The message names no account, role, model-access or region problem. (The first account we tried gave the same message in the playground itself.)
- **Severity:** Blocker at the time. It held up testing until the workaround below.
- **Status: resolved.** Bedrock now works fully in our app: Nova 2 Lite writes the narration for every story, and the code path has been run live many times.
- **Workaround:** Created a **Bedrock API key** on the console's API keys page and exported it as `AWS_BEARER_TOKEN_BEDROCK` in the terminal. The same CLI command then succeeded (646 ms). Our app also has a local-story fallback, so the demo kept working while we sorted this out.
- **Root cause:** Not identified. We do not know why the role credentials were refused while the console and the API key were accepted.
- **Suggestion:** Return an error that says which check failed (account state, model access, role policy, Marketplace subscription, region) with a link to the fix. `ValidationException` is the wrong class for an access problem. Document the API-key path in the Converse quickstart as the fastest way to a working call.


## F2. Nova 2 Lite: sometimes ignores the grounding rule

- **Task attempted:** Make narration match the local background picture of each scene. We send each scene's plot beat plus the picture's landmark list and ask for JSON with one narration per scene that mentions something from that list.
- **Steps taken:** Four real runs of the smoke test (`node bedrockStory.js`) against Nova 2 Lite.
- **Expected:** Every scene's text mentions something in its picture.
- **Actual:** The JSON parsed in 4 of 4 runs, which was good. But in several runs 1-3 scenes did not follow the rule (for example the text said "arch" while the rule check expected another landmark word, or it wrote about the plot instead of the picture). In one run the model correctly refused to write about a treasure chest in a crystal-bell story, which exposed a wrong picture tag on our side, not a model fault.
- **Severity:** Medium.
- **Workaround:** A validator checks length, banned words, weather words underwater, and that each scene mentions a landmark of its picture. One failed scene keeps its local text; more than two failed scenes triggers one retry; if that fails the whole story uses the local generator.
- **Suggestion:** Document a recommended pattern for guaranteed structured output with Nova 2 Lite on Converse (schema-constrained output or tool use), with a worked example that includes validation and retry. If schema-constrained output already exists for this model, surface it in the Converse quickstart.

## F3. Nova 2 Lite: latency for an 8-scene rewrite

- **Task attempted:** Rewrite all 8 scenes in one Converse call during story generation.
- **Steps taken:** Timed the call in four runs.
- **Expected:** Under about 2 s.
- **Actual:** 4.2 to 4.8 s per call (4348, 4201, 4840, 4315 ms). A tiny test prompt took 646 ms, so the time scales with output length.
- **Severity:** Low. It sits inside our "your hero is getting ready" loading screen.
- **Workaround:** One call for all 8 scenes (not 8 calls), 20 s timeout, local fallback.
- **Suggestion:** None for the model. A docs example of streaming one scene at a time (`ConverseStream`) would help; we did not try it.


## F4. DynamoDB: `update-time-to-live` is not idempotent

- **Task attempted:** Enable TTL on `ttl`.
- **Steps taken:** Re-ran `aws dynamodb update-time-to-live --table-name sessions --time-to-live-specification Enabled=true,AttributeName=ttl`.
- **Expected:** Success with no change.
- **Actual:** `ValidationException: TimeToLive is already enabled`.
- **Severity:** Low.
- **Workaround:** Ignore the error.
- **Suggestion:** Return success when the requested state already holds, so setup scripts can be re-run.

## F5. AWS CLI: pager made finished output look unfinished

- **Task attempted:** Read the output of `aws dynamodb create-table`.
- **Steps taken:** Ran the command in the VS Code integrated terminal.
- **Expected:** Output ends and the prompt returns.
- **Actual:** The output opened in a pager (`less`), with rows of `~` and a missing prompt. It looked as if the command had stopped halfway. The command had finished.
- **Severity:** Low.
- **Workaround:** `export AWS_PAGER=""` (or press `q`).
- **Suggestion:** Do not page short outputs, or show a "press q" hint in the pager footer.

## F6. Vega OS: video surface covers the background pictures

- **Task attempted:** Play a generated MP4 of each scene on the Vega Virtual Device, with the library background and the hero drawing layered on screen.
- **Steps taken:** [CONFIRM: add the exact component and layering you used, and what you saw]
- **Expected:** Video and React Native layers composite in the order we set.
- **Actual:** The video surface drew over the background pictures. [CONFIRM: add the exact symptom]
- **Severity:** High. It made us drop the video path.
- **Workaround:** Disabled the MP4 path (`USE_VIDEO = false`). The TV now shows the background picture, the child's cut-out hero animated with React Native `Animated`, a shadow, sparkles, captions and narration audio.
- **Suggestion:** [CONFIRM: your suggestion]. At minimum, document how the video surface layers with other views on Vega.

## F7. Vega OS: no camera support, so hand tracking moved to a phone web page

- **Task attempted:** Let the child control the story with hand gestures (pause, next, previous, restart), using a camera and hand tracking inside the Vega TV app.
- **Steps taken:** Looked for a way to open a camera from the React Native app on Vega OS. [CONFIRM: add what you tried or the docs page/error you found]
- **Expected:** A supported camera API in the Vega SDK / Vega Virtual Device, as on phones.
- **Actual:** Camera access is not supported on Vega OS, so hand tracking could not run in the TV app.
- **Severity:** High. It forced a change in the design.
- **Workaround:** The phone's web page (`phone.html`) opens the camera and runs MediaPipe hand tracking on the phone. It sends only text events (`open_palm`, `swipe_left`, `swipe_right`, `thumbs_up`) to the server, and the TV app polls for them every 400 ms. The remote always works too. A side benefit: video never leaves the phone, which suits a children's app.
- **Suggestion:** State clearly in the Vega docs which hardware APIs (camera, microphone) are supported. If camera support is planned, say so, and offer a documented pattern (such as a companion phone) for apps that need it.



