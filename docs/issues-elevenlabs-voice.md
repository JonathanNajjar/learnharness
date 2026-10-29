# Issues — ElevenLabs voice (dictation provider + read aloud)

Vertical slices of [the PRD](prd-elevenlabs-voice.md), in dependency order. Each slice is a separate issue. Each one carries the `needs-triage` label when it's published to a tracker. "Blocked by" refers to slice numbers in this file. Story numbers refer to the PRD's user stories.

Every slice updates the docs its change touches (`docs/architecture.md`, `docs/development.md`, `docs/keyboard.md`, README) in the same change. That's how story 52 is covered.

---

## 1. Live ElevenLabs API checks

**Type:** HITL · **Labels:** needs-triage · **Stories:** none (unblocks slice 5)

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

Settle the two ElevenLabs behaviors the docs don't cover, using a real key that the developer puts in `.env.local` themselves. First: does a realtime Scribe session with no `language_code` auto-detect the spoken language? Second: can a key restricted to `speech_to_text`, `text_to_speech`, `voices_read` and `models_read` create a `realtime_scribe` single-use token? Record both results in the PRD. If either contradicts the PRD's assumptions, take it to the owner before slice 5 starts.

### Acceptance criteria

- [ ] A realtime session opened without `language_code` and fed a non-English phrase is tested. The PRD records whether the `committed_transcript` came back in that language, and what `session_started.config.language_code` echoed.
- [ ] Token creation with the four-scope key is tested. The PRD records the smallest working permission set.
- [ ] The ElevenLabs key help text wording is finalized from that result.
- [ ] If auto-detect doesn't work, the owner has decided the fallback for "Multilingual" and unsupported languages, and the decision is in the PRD.

### Blocked by

None - can start immediately.

---

## 2. ElevenLabs key in Settings → Keys

**Type:** AFK · **Labels:** needs-triage · **Stories:** 1–8

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

A learner can save an ElevenLabs API key. The key list gains `ELEVENLABS_API_KEY` with a length-floor shape check, like Deepgram's, and env/auth.json support like the other curated keys. Settings → Keys shows the Dictation group with the Deepgram and ElevenLabs rows, and a new Read aloud group with the same ElevenLabs row. Both rows edit one stored value through the existing keys route and update together live. Help text is specific to each group and names the required permissions. The Deepgram row is labeled as dictation only, so nobody expects Deepgram to read aloud.

### Acceptance criteria

- [ ] Saving a valid ElevenLabs key in either group stores it once, shows it masked (last four characters), and updates both rows without a reload.
- [ ] A truncated or whitespace-containing paste is rejected with 400 and a clear message.
- [ ] Existing Deepgram key behavior and its tests are unchanged.
- [ ] Each group's help text names its required ElevenLabs permissions and links to the ElevenLabs console.
- [ ] Tests: key list and shape check (like `auth-keys`), the server key path (like `server-keys`), and a render test showing the row in both groups updating together (like `render-settings` and `zero-keys`).
- [ ] `docs/development.md` lists `ELEVENLABS_API_KEY`.

### Blocked by

None - can start immediately.

---

## 3. Dictation engine adapter refactor

**Type:** AFK · **Labels:** needs-triage · **Stories:** 50

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

Move the provider-specific socket work out of the dictation hook and behind a small engine adapter interface. The adapter builds the URL and auth from a token, encodes an audio frame, parses a message into final transcripts or an error, sends the end-of-stream signal, and recognizes when the stream has finished. Deepgram becomes the first adapter, with exactly today's behavior. Everything provider-neutral stays in the hook: the generation counter, optimistic meter, shared AudioContext and worklet, frame queue before the socket opens, deferred buffer, finish waiters, warm token, and reconnect-once.

### Acceptance criteria

- [ ] Dictation with Deepgram behaves exactly as before, verified manually: meter, Stop, ⌘D, Esc discard, deferred flush, submit-while-dictating.
- [ ] All existing dictation tests pass unchanged (`dictation-flow`, `dictation-warm`, `dictation-language`, `dictation-picker`).
- [ ] New unit tests cover the Deepgram adapter's frame encoding, message parsing, end signal and finished detection.

### Blocked by

None - can start immediately.

---

## 4. ElevenLabs dictation, end to end

**Type:** AFK · **Labels:** needs-triage · **Stories:** 9–18

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

A learner can dictate with ElevenLabs. The settings gain `dictation.provider` (`"deepgram"` | `"elevenlabs"`), picked in Settings → Dictation next to Language. A pure provider-resolving function encodes the rules: an explicit choice wins, and with no choice the app uses whichever key exists, Deepgram if both. The token route resolves the provider on the server and returns `{ provider, token }`. For ElevenLabs it creates a `realtime_scribe` single-use token.

The ElevenLabs adapter connects to `wss://api.elevenlabs.io/v1/speech-to-text/realtime`:
- Query parameters: `token`, `model_id=scribe_v2_realtime`, `audio_format=pcm_16000`, `commit_strategy=vad`, `vad_silence_threshold_secs=0.3`.
- Audio goes out as base64 JSON `input_audio_chunk` frames.
- Each `committed_transcript` is buffered, and Stop sends a chunk with `commit: true`.
- The run finishes on the final commit, and the client closes the socket.
- The ElevenLabs error message types surface as errors on the dictation button.

The keyless error names the missing key and its click opens that provider's key box. Language is fixed to English in this slice; slice 5 adds the conversion.

### Acceptance criteria

- [ ] With only an ElevenLabs key, dictation works with no setting chosen: the meter shows, text lands in the composer or answer field on Stop, ⌘D and Esc behave as with Deepgram.
- [ ] With both keys, the provider picker switches engines on the next run without a reload.
- [ ] Choosing ElevenLabs without its key shows "Dictation needs an ElevenLabs key", and clicking it opens the ElevenLabs key box.
- [ ] Words spoken before the socket opens are kept. Submitting while dictating waits for the last commit. A dropped socket reconnects once with a fresh token.
- [ ] The real key never appears in any response to the renderer.
- [ ] Tests:
  - the provider-resolving function's full decision table (like `settings-resolution`)
  - the settings sanitizer for `provider`
  - the token route per provider, including 503 keyless and 502 upstream errors, with a fake fetch
  - the ElevenLabs adapter's unit behavior
  - the hook's flow over a fake ElevenLabs socket (like `dictation-flow`)
- [ ] `docs/architecture.md` describes the ElevenLabs dictation path.

### Blocked by

- Slice 2 (ElevenLabs key)
- Slice 3 (engine adapter refactor)

---

## 5. Dictation language for ElevenLabs

**Type:** AFK · **Labels:** needs-triage · **Stories:** 19–22

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

The single saved dictation language applies to ElevenLabs too. A pure function converts it: a regional code becomes its base language (`en-GB` → `en`). "Multilingual" and languages ElevenLabs doesn't support follow whatever slice 1 established, which is either omitting `language_code` for auto-detect or the owner's chosen fallback. The ElevenLabs adapter uses the converted code in place of the fixed English.

### Acceptance criteria

- [ ] Every entry in the existing dictation language list converts to a valid ElevenLabs value or the agreed auto/fallback behavior.
- [ ] Dictating in a non-English language with ElevenLabs gives text in that language. The PRD notes it was checked manually.
- [ ] Deepgram's language handling is unchanged.
- [ ] Tests: a conversion table (like `dictation-language`).

### Blocked by

- Slice 1 (live API checks)
- Slice 4 (ElevenLabs dictation)

---

## 6. Listen button on assistant messages

**Type:** AFK · **Labels:** needs-triage · **Stories:** 23–27, 29–31, 33, 34, 49

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

Every assistant message gets a Listen/Stop button that reads it aloud with ElevenLabs. Three pieces make it work:

- **Markdown-to-speech conversion** (pure and browser-safe). Markdown becomes ordered chunks to speak. Headings, lists and emphasis become sentences. Code, mermaid, tables and display math become one short spoken marker each. Inline math is simplified for common forms and stripped otherwise. Chunk boundaries are short first.
- **The `/api/tts` route.** POST `{ text, voiceId, modelId }` calls `POST /v1/text-to-speech/{voice_id}/stream` with the server-side key and `output_format=mp3_44100_64`, and pipes the audio back. It enforces a text length cap.
- **A one-per-window player.** It plays one source at a time, queues chunks and fetches the next while the current one plays, and has an error state.

This slice uses a fixed default voice and the resolved default model.

### Acceptance criteria

- [ ] Clicking Listen on a long reply starts speech within about a second and reads all chunks in order. The button shows Stop while playing, and clicking it stops playback.
- [ ] Starting another message's Listen stops the first.
- [ ] Code, diagrams, tables and display math are replaced by spoken markers, and markdown symbols are never spoken.
- [ ] With no ElevenLabs key, Listen shows "Read aloud needs an ElevenLabs key" and opens that key box. Upstream errors such as quota, permission or network show inline.
- [ ] The real key never reaches the renderer.
- [ ] Tests:
  - fixture tables for the markdown-to-speech conversion (like `markdown-export` and `session-markdown`)
  - `/api/tts` with a fake upstream, covering streaming pass-through, the length cap, 503 and 502
  - the player with fake fetch and audio, covering one-at-a-time, order and prefetch, stop, and errors
  - render tests for the Listen/Stop button states

### Blocked by

- Slice 2 (ElevenLabs key)

---

## 7. Esc stops playback, and dictation wins

**Type:** AFK · **Labels:** needs-triage · **Stories:** 28, 47, 48

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

Esc gains a "stop read aloud" step in the priority chain, after "cancel dictation" and before "abort turn". Starting dictation, by click or ⌘D, immediately stops any playback, and stopping dictation never restarts it.

### Acceptance criteria

- [ ] While a message plays, Esc stops it. With dictation active, Esc cancels dictation first, as today.
- [ ] Starting dictation during playback stops the audio before the mic opens, and nothing resumes afterwards.
- [ ] Tests: the Esc chain order (like `esc-layering`), and the player stopping when dictation becomes active.
- [ ] `docs/keyboard.md` documents the new Esc step.

### Blocked by

- Slice 6 (Listen button)

---

## 8. In-memory audio cache

**Type:** AFK · **Labels:** needs-triage · **Stories:** 32

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

The player keeps generated audio chunks in memory, keyed by chunk text, voice and model, capped at about 50 MB with the oldest entries removed first. Replaying a message in the same window starts instantly and makes no ElevenLabs request. Nothing is written to disk.

### Acceptance criteria

- [ ] A second Listen on the same message plays with no new `/api/tts` request.
- [ ] Changing voice or model makes a new request rather than serving cached audio.
- [ ] Past the cap, the oldest entries are removed and memory stays bounded.
- [ ] Tests: a cache hit makes no request, the key includes voice and model, and eviction works at the cap.

### Blocked by

- Slice 6 (Listen button)

---

## 9. Read aloud settings: voice and model pickers

**Type:** AFK · **Labels:** needs-triage · **Stories:** 42–46, 51

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

A new Settings → Read aloud section with a voice picker, a model picker and a billing note. The settings gain `readAloud.voiceId` and `readAloud.modelId`.

- **Voices route:** lists the account's voices from `GET /v2/voices`, following `next_page_token` until `has_more` is false. Each voice returns id, name and category, so cloned voices appear too.
- **Models route:** lists models from `GET /v1/models` that have `can_do_text_to_speech`.
- **Default model:** `eleven_v4_turbo` if listed, else `eleven_flash_v2_5`, else the first TTS model. A saved model that's no longer listed falls back the same way, and the picker shows the model actually used.
- **Route design:** `/api/tts` and these routes resolve the provider internally, so another read-aloud provider can be added later.

### Acceptance criteria

- [ ] The voice picker shows the account's voices, including cloned ones. Choosing one changes the voice on the next Listen.
- [ ] The model picker shows only TTS-capable models, and the default and fallback rules hold.
- [ ] If the list can't load, the section shows a clear error instead of a stale or fake list.
- [ ] The section says ElevenLabs bills your account separately and isn't shown in the cost meter.
- [ ] Tests:
  - the voices route's pagination, keyless and upstream errors with a fake fetch
  - the models route's filtering
  - default-model resolution as a pure function
  - the settings sanitizer for `readAloud`
  - render tests for the section

### Blocked by

- Slice 6 (Listen button)

---

## 10. Auto-read replies

**Type:** AFK · **Labels:** needs-triage · **Stories:** 35, 36, 39–41

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

A "Read replies aloud" toggle in Settings → Read aloud (`readAloud.autoRead`, off by default). When it's on, each new assistant reply plays automatically once it has finished streaming. Replies loaded from history on open or reload don't play, and neither do aborted or failed turns. A reply that finishes while dictation is active is skipped.

### Acceptance criteria

- [ ] With the toggle on, a new reply plays once it has finished, never while it's still streaming.
- [ ] Opening or reloading a session plays nothing.
- [ ] Aborted and failed turns don't play.
- [ ] A reply finishing during dictation is skipped and doesn't play later.
- [ ] With the toggle off (the default), nothing plays automatically.
- [ ] Tests: the auto-read controller's trigger rules (finished, history, aborted, failed, dictating), the sanitizer default, and a render test for the toggle.

### Blocked by

- Slice 7 (Esc stop and dictation wins)

---

## 11. Read aloud for dock questions

**Type:** AFK · **Labels:** needs-triage · **Stories:** 37, 38

### Parent

https://github.com/amosblomqvist/learnharness/issues/189

### What to build

The pending question in the question dock gets a Listen button that reads its **prompt only**, never the answer options. When auto-read is on, a newly shown question's prompt plays automatically after the reply that introduced it, under the same rules: no history, no dictation. The markdown-to-speech conversion gains a function for dock questions.

### Acceptance criteria

- [ ] Listen on a pending quiz or ask question speaks the prompt and no options.
- [ ] With auto-read on, a new question's prompt plays after its reply finishes, in order.
- [ ] A question restored when a session is reopened doesn't auto-play.
- [ ] Tests: the dock-question speech function excludes options for every question mode, auto-read sequencing works, and the dock Listen button renders (like `pending-question-form`).

### Blocked by

- Slice 10 (auto-read replies)
