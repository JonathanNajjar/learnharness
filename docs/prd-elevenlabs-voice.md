# PRD — ElevenLabs voice: dictation provider + read aloud

Tracks [issue #189](https://github.com/amosblomqvist/learnharness/issues/189) ("Elevenlabs api key"). Status: draft, decisions agreed in a design interview 2026-10-29; not yet implemented.

## Problem Statement

LearnHarness is built around thinking out loud: dictation is described as "a requirement, not a luxury." But voice only works one way, and only with one vendor.

- **Dictation is Deepgram-only.** A learner who already pays for ElevenLabs, or who prefers its transcription, has to open and fund a second account (with a Member-role Deepgram key) just to talk to the app.
- **Nothing talks back.** Every teacher reply, explanation and question has to be read on screen. A learner who wants to listen while looking at a diagram, rest their eyes, study hands-free, or simply absorbs material better by ear has no option. The issue author asked to use their ElevenLabs key "to transcribe and TTS the interactions with the AI."

## Solution

One ElevenLabs API key unlocks two things:

1. **ElevenLabs as a dictation provider**, alongside Deepgram. The learner picks the provider in the Dictation settings. Everything dictation does today keeps working the same way: the optimistic meter, the deferred transcript, transcripts that are never lost, Esc to cancel, ⌘D to toggle and the warm token.
2. **Read aloud (text-to-speech)** for AI output, using ElevenLabs. Every assistant message gets a Listen/Stop button. An optional "Read replies aloud" setting speaks each new reply automatically once it has finished, plus the prompt of any question that appears in the question dock. Code, diagrams, tables and display math aren't read out. A short spoken marker says they're on screen instead.

The real key never leaves the local server, which is the same rule dictation follows today.

## User Stories

### Keys and setup

1. As a learner with an ElevenLabs account, I want to paste my ElevenLabs API key once, so that both dictation and read aloud work without a second vendor.
2. As a learner, I want the ElevenLabs key box to appear in both the Dictation and the Read aloud groups of Settings → Keys, so that I find it wherever I look for the feature I want.
3. As a learner, I want editing the ElevenLabs key in either group to update the same stored key, so that I never wonder whether there are two different keys.
4. As a learner, I want the key's help text to name the ElevenLabs permissions it needs (`speech_to_text`, `text_to_speech`, `voices_read`, `models_read`), so that a scoped key I create works the first time.
5. As a learner, I want a mis-pasted or truncated ElevenLabs key to be rejected when I save it, so that a broken key never lands in my settings.
6. As a learner, I want the stored key shown masked (last four characters), so that I can tell which key is saved without exposing it.
7. As a Deepgram-only learner, I want my existing dictation setup to keep working untouched after this change, so that the update costs me nothing.
8. As a Deepgram-only learner, I want it to be clear that read aloud needs an ElevenLabs key, so that I don't expect Deepgram to read aloud.

### Dictation provider

9. As a learner with both keys, I want to choose Deepgram or ElevenLabs for dictation in Settings → Dictation, so that I use the transcription I prefer.
10. As a learner who hasn't chosen yet, I want the app to use whichever dictation key I have, preferring Deepgram if I have both, so that dictation just works.
11. As a learner who picked ElevenLabs but has no ElevenLabs key, I want the dictation button to say it needs an ElevenLabs key and take me to that key box on click, so that I can fix it in one step. Today's Deepgram keyless message works the same way.
12. As a learner, I want switching providers to take effect on my next dictation without reloading, so that I can compare them quickly.
13. As a learner dictating with ElevenLabs, I want the same meter, Stop pill, ⌘D toggle and Esc-to-discard behavior I know from Deepgram, so that the provider is invisible in daily use.
14. As a learner dictating with ElevenLabs, I want my words to land in the answer field or composer only when I stop, the same deferred behavior as today, so that live text doesn't distract me.
15. As a learner, I want speech captured before the ElevenLabs connection opens to be kept and sent once it opens, so that my first words are never lost.
16. As a learner, I want submitting an answer while ElevenLabs dictation is still running to wait for my last words before sending, so that no spoken reasoning is lost.
17. As a learner, I want a dropped ElevenLabs connection to reconnect once with a fresh token, so that a network blip doesn't end my dictation.
18. As a learner, I want a clear error on the dictation button if ElevenLabs refuses my key or is unreachable, so that I know what went wrong.

### Dictation language

19. As a learner, I want my one saved dictation language to apply to whichever provider I use, so that I set it once.
20. As a learner on "Multilingual", I want ElevenLabs to auto-detect my language, so that mixed-language speech still works.
21. As a learner with a regional language such as English (UK), I want ElevenLabs to use the base language (English), so that my choice still means something.
22. As a learner whose chosen language ElevenLabs doesn't support, I want ElevenLabs to fall back to auto-detection rather than fail, so that dictation still works.

### Read aloud: listening

23. As a learner, I want a Listen button on every assistant message, so that I can hear any reply, including older ones.
24. As a learner, I want the Listen button to turn into Stop while that message plays, so that I can end it with the same control.
25. As a learner, I want starting a different message to stop the current one, so that two voices never overlap.
26. As a learner, I want speech to start within about a second of pressing Listen, even for long replies, so that it feels responsive.
27. As a learner, I want long replies read in order, piece by piece, without gaps I notice, so that listening feels natural.
28. As a learner, I want Esc to stop playback, so that I can silence it from the keyboard.
29. As a learner, I want headings, lists and emphasis read as plain sentences, so that I don't hear markdown symbols.
30. As a learner, I want code blocks, diagrams, tables and display equations replaced with a short spoken note that they're on screen, so that I know to look rather than hear gibberish.
31. As a learner, I want simple inline math such as x² read naturally, and other inline math read without LaTeX symbols, so that sentences containing math still make sense.
32. As a learner, I want replaying a message I already heard in this window to start instantly and not hit ElevenLabs again, so that I don't pay twice.
33. As a learner, I want a clear inline error if read aloud fails (bad key, quota exhausted, network), so that I know why nothing is playing.
34. As a learner without an ElevenLabs key, I want clicking Listen to tell me read aloud needs an ElevenLabs key and take me to that key box, so that setup is one click away.

### Read aloud: automatic

35. As a hands-free learner, I want a "Read replies aloud" setting (off by default), so that each new reply plays automatically.
36. As a hands-free learner, I want auto-read to start only after a reply has fully finished streaming, so that it never reads half-formed text.
37. As a hands-free learner, I want auto-read to also speak the prompt of a question that appears in the question dock, without reading out the answer options, so that I hear what is being asked without a long list.
38. As a learner, I want a Listen button on the pending question in the dock, so that I can hear a question prompt on demand.
39. As a learner, I want old replies not to auto-play when I open or reload a session, so that only new replies speak.
40. As a learner, I want auto-read to skip a reply that arrives while I'm dictating, so that the mic never transcribes the AI's own voice.
41. As a learner, I want auto-read to stay quiet for replies that were aborted or failed, so that I only hear complete answers.

### Read aloud: voice settings

42. As a learner, I want to pick a voice from my own ElevenLabs account, including cloned voices, so that the teacher sounds the way I like.
43. As a learner, I want to choose the speech model from the text-to-speech models my ElevenLabs account offers, so that I can trade speed and cost for quality, and new models show up without an app update.
44. As a learner, I want a sensible default voice and model before I choose, so that read aloud works right after I add the key.
45. As a learner, I want the voice list to load from my account when I open the settings, with a clear error if it can't, so that I'm never shown a stale or fake list.
46. As a learner, I want the Read aloud settings to note that ElevenLabs bills my account separately and is not shown in the cost meter, so that I'm not surprised by usage.

### Dictation and read aloud together

47. As a learner, I want starting dictation (click or ⌘D) to stop any playback immediately, so that the mic never picks up the speaker.
48. As a learner, I want stopping dictation not to restart the reply that was cut off, so that the app does nothing unexpected.

### Maintainer

49. As the maintainer, I want the real ElevenLabs key to stay server-side with only short-lived tokens or proxied audio reaching the renderer, so that the existing key-safety rule holds.
50. As the maintainer, I want the provider-specific parts of dictation behind one small adapter interface, so that adding another provider later doesn't touch the hook's lifecycle logic.
51. As the maintainer, I want the TTS route written so that Deepgram Aura could later be added as a read-aloud provider without a rewrite, so that the scope cut is cheap to undo.
52. As the maintainer, I want the architecture, development and keyboard docs updated in the same change, so that the docs keep describing the system as it actually is.

## Implementation Decisions

### Modules

**1. Speech-text core (new, pure, browser-safe core).**
Interface: markdown in, ordered list of speakable chunks out. One function turns a reply's markdown into plain speech text. Headings, list items and emphasis become sentences. Fenced code, mermaid, tables and display math become one short spoken marker each ("code shown on screen" and similar). Inline math becomes simplified words for common forms (powers, simple fractions, subscripts) and stripped source otherwise. Links read their label. The output is split into chunks at paragraph or sentence boundaries under a maximum character length, so the first chunk is short and playback starts fast. A second entry point produces the speakable text for a dock question: the prompt only, never the options. No DOM, no network.

**2. ElevenLabs language mapper (new, pure core, beside the existing dictation language list).**
Interface: dictation language in, ElevenLabs language code or "auto" out. "multi" becomes auto. A regional code becomes its base language. A base language ElevenLabs doesn't support becomes auto. Deepgram's URL builder is unchanged.

**3. Voice provider resolver (new, pure core).**
Interface: (saved settings, which voice keys are present) → { dictation provider or "none, needs <key>", read-aloud availability }. This encodes the agreed rules: an explicit provider choice wins, with a keyless state if its key is missing. With no choice, it uses the key that exists, Deepgram if both. Read aloud needs the ElevenLabs key. The token route and the settings UI both use it, so there is only one source of truth.

**4. Dictation engine adapters (refactor of the dictation hook).**
The hook keeps everything provider-neutral as it is today: generation counter, optimistic meter, shared AudioContext and PCM worklet, pending frame queue, deferred buffer, finish waiters, warm token, reconnect-once. The provider-specific socket work moves behind a small adapter interface: build the URL and auth for a token, encode an audio frame, parse a message into zero or more final transcripts or an error, send the end-of-stream signal, and recognize that the stream has finished. "Finished" is not always a socket close. Deepgram's adapter is today's behavior: binary linear16 frames, the "bearer" subprotocol, CloseStream, and close code 1000 meaning finished. The ElevenLabs adapter follows the verified protocol below. The token goes in a `token` query parameter. Audio is sent as JSON `input_audio_chunk` messages carrying base64 PCM. Phrases commit on pauses (`commit_strategy=vad`, 0.3 s silence), and stopping sends a chunk with `commit: true`. The run is finished when the final `committed_transcript` arrives, and **the client closes the socket** because the server does not. The existing 3 s safety net still covers a commit that never answers. The keyless error line and its Settings deep link become provider-aware.

**5. Read-aloud player (new client module, one per window).**
Interface: play(source id, chunks), stop(), the current playing source id (subscribable), and an error state. It owns a single audio element, so only one source plays at a time and starting another stops the current one. It queues chunks, requesting the next chunk while the current one plays. It keeps an in-memory audio cache keyed by (chunk text, voice, model) with a size cap (~50 MB) that evicts the oldest entries. Dictation always wins: it stops when dictation becomes active and refuses auto-play while dictation is active. It never resumes after dictation. The auto-read controller listens for turn completion and newly shown dock questions. It ignores history loaded on open, aborted turns and failed turns.

**6. Server routes.**
- **Speech-to-text token route (modified):** GET returns `{ provider, token }`. It resolves the provider on the server with module 3. For Deepgram it creates a grant as today. For ElevenLabs it requests a `realtime_scribe` single-use token. Keyless returns 503, as today, now naming the missing key. Upstream failures return 502 with a short message. ElevenLabs tokens are single-use and expire after 15 minutes, which fits the existing warm-token cache: its 3-minute TTL is well inside that, each run uses one token, and reconnect always gets a fresh one.
- **Text-to-speech route (new):** POST `{ text, voiceId, modelId }` calls ElevenLabs' streaming text-to-speech endpoint with the server-side key and pipes the MP3 stream back. It enforces a maximum text length per request, well below every model's limit, since chunks are short anyway. It returns 503 when keyless and 502 with a short message for upstream errors, including quota and permission errors. The provider is resolved internally so another provider can be added later.
- **Voices and models routes (new):** GET lists the account's voices (id, name, category), following ElevenLabs' page token until `has_more` is false. A second GET lists TTS-capable models (`can_do_text_to_speech`) with their per-request character limit. Both use the same keyless and upstream-error semantics.

**7. Settings and keys UI.**
- **Settings schema:** `dictation` gains an optional `provider` ("deepgram" | "elevenlabs"). A new `readAloud` section holds `autoRead` (boolean, default off), `voiceId` and `modelId` (absent means the resolved default: `eleven_v4_turbo` if available, else `eleven_flash_v2_5`). Both are sanitized like the existing sections, so unknown values drop to defaults. This is additive and needs no migration.
- **Settings sections:** Settings → Dictation gains a provider picker next to Language. A new Settings → Read aloud section has the auto-read toggle, the voice picker, the model picker and the billing note.
- **Keys:** the key registry gains `ELEVENLABS_API_KEY`, with a length-floor shape check like Deepgram's, plus env/auth.json support like the other curated keys. Settings → Keys shows the Dictation group with the Deepgram and ElevenLabs rows, and a new Read aloud group that renders the same ElevenLabs row. It's one stored value, saved through the existing keys route, and both rows update live. The help text is specific to each group.
- **Message and dock UI:** a Listen/Stop control on each assistant message and on the pending dock question.
- **Keyboard:** Esc gains a "stop read aloud" step in the priority chain after "cancel dictation" and before "abort turn". No new shortcut.

### Agreed product decisions (from the design interview)

- ElevenLabs sits alongside Deepgram for dictation and doesn't replace it.
- Provider choice is an explicit setting, defaulting to whichever key exists (Deepgram if both).
- One dictation language setting, converted for ElevenLabs.
- One token route, with the server deciding the provider.
- Read aloud is ElevenLabs-only in this change.
- Read aloud has per-message buttons plus an auto-read toggle that is off by default.
- Speech is prose only, with spoken markers for skipped content.
- Dock questions: the prompt is spoken, the options are not.
- Audio goes through a server proxy, streamed.
- Auto-read waits for the reply to finish.
- Voice picker and model picker. The model list is live from the account, defaulting to v4 Turbo with a Flash v2.5 fallback. No speed control.
- Dictation commits on pauses (VAD, 0.3 s) plus a final commit at Stop. Read-aloud audio is `mp3_44100_64`.
- **Keyless deep links land in the matching group** (decided 2026-10-29, after slice 2): a dictation error opens the Dictation group's ElevenLabs row, and a read-aloud error opens the Read aloud group's row. Targets are built with the core helper `keyRowTarget(id, group?)`: the bare id means Dictation, and `keyRowTarget(id, "read-aloud")` means Read aloud. `open("keys", row)` keeps its signature. Clicking one ElevenLabs row unfolds only that row.
- **Default voice: Alice** (`Xb7hH8MSUJpSbSDYk0k2`, premade "Clear, Engaging Educator"), used until the learner picks one (decided 2026-10-29).
- **Spoken markers** name what was skipped: "Code shown on screen.", "Diagram shown on screen.", "Table shown on screen.", "Equation shown on screen." (2026-10-29).
- **Chunking** (an internal tuning choice): split at paragraphs, then sentences. The first chunk is at most ~200 characters so speech starts fast, and later chunks at most ~1000. `/api/tts` rejects text over 2500 characters. Until slice 9 adds the live-list fallback, the route's default model is `eleven_v4_turbo`.
- **ElevenLabs Stop waits for quiet** (2026-10-29, after slice 4): after Stop, transcripts keep buffering. The run ends once ~400 ms pass with no new message after a committed transcript (or `insufficient_audio_activity`), or on the 3 s safety net. A late VAD commit of an earlier phrase therefore can't end the run before the Stop commit's trailing words arrive.
- **Listen button**: always visible and muted under every assistant message, hidden on the newest message while a turn is still running (as built in slice 6).
- **Bare URLs** in a reply are spoken as their host name ("en.wikipedia.org").
- **Worker-authored wording and behavior kept** (2026-10-29): the dictation "Provider" picker (a simple dropdown showing the provider that would be used even when its key is missing), the ElevenLabs dictation error lines ("ElevenLabs quota exceeded" and the like), the read-aloud error lines ("Read aloud couldn't connect", "Read aloud couldn't play the audio", "Read aloud failed (<status>)"), and leaving unrecognized math operators as-is.
- **Key wording signed off** (2026-10-29): the labels "Deepgram (dictation only)" and "ElevenLabs", with the description "Speech key for dictation and read aloud — one key for both". Each group's hint names the four permissions and warns that token creation may need a broader key. The Read aloud group sits between Dictation and Search.
- The key box appears in both groups and edits one value.
- Dictation always wins over playback.
- Controls are the button plus Esc. No pause, seek or new shortcut.
- In-memory audio cache per window.
- Voice usage is **not** shown in the cost meter, matching Deepgram today.
- Delivered as one PR.

## Testing Decisions

**What makes a good test here:** test behavior visible at a module's boundary (inputs to outputs, requests to responses, user actions to rendered state), never internal structure. Tests stay deterministic, with no LLM, no network and no real audio, as the repo's `npm test` requires. Upstream services are faked at the fetch or WebSocket seam. The browser is faked at the audio element and media device level.

Every module is tested:

- **Speech-text core:** fixture-style tables. Markdown in, chunks out: headings and lists flattened, each skipped block type getting exactly one marker, inline math simplification and fallback, chunk size limits and ordering, the dock-question prompt with options excluded. Prior art: the pure core tests such as `dictation-language`, `markdown-export` and `session-markdown`.
- **Language mapper:** multi becomes auto, regional becomes base, unsupported becomes auto, and every entry in the existing language list maps to something valid. Prior art: `dictation-language`.
- **Provider resolver:** the full decision table of explicit choice × keys present → provider, keyless state and read-aloud availability. Prior art: `settings-resolution` and `settings-pure`.
- **Dictation engine adapters:** each adapter's frame encoding, message → final-transcript parsing, end-of-stream signal and clean-close detection. The hook's flow with the ElevenLabs adapter over a fake WebSocket covers queued pre-open frames, the deferred flush on stop, finish waiting for the last final, and reconnect once with a fresh token. Prior art: `dictation-flow`, `dictation-warm`.
- **Read-aloud player:** with fake fetch and audio, cover single playback (a new source stops the old), chunk order and prefetch, a cache hit with no second request, the size-cap eviction, stop, playback stopping when dictation starts, auto-play refused while dictating, no auto-play for history, aborted or failed turns, and the error state. Prior art: `dictation-warm`, `esc-layering`.
- **Server routes:** with a fake upstream fetch, cover the token route per provider plus keyless (503) and upstream failure (502), the TTS route's streaming pass-through, text length cap, keyless and upstream errors, and the voices and models routes. The real key must never appear in any response. Prior art: `server-keys`, `custom-provider-route`.
- **Settings and keys UI:** the sanitizer for the new `dictation.provider` and `readAloud` fields, which drops bad values. Render tests cover the Dictation provider picker, the Read aloud section, and the ElevenLabs row in both key groups updating together. The keyless deep link and the Listen/Stop button states are covered too. Prior art: `render-settings`, `dictation-picker`, `zero-keys`, `auth-keys`, `settings-store`.

## Out of Scope

- Deepgram Aura (or any provider other than ElevenLabs) for read aloud. The TTS route is shaped so it can be added later.
- Showing voice usage or cost in the cost meter, or any separate voice meter.
- Speed control, pause/resume, seeking, skipping a chunk, or a full inline player.
- A new keyboard shortcut for read aloud (Esc stop only).
- Speaking replies while they stream (paragraph-level auto-read).
- Reading answer options aloud, or reading tool cards, plan blocks, artifacts or graph content.
- Rewriting replies into a spoken script with an LLM.
- Persisting generated audio to disk or across restarts.
- Separate per-provider dictation language lists.
- Live (interim) dictation text. Dictation stays deferred.
- On-device or offline speech recognition or synthesis.

## Verified ElevenLabs API facts (checked against elevenlabs.io/docs, 2026-10-29)

Authentication for server-side calls uses the `xi-api-key` header.

**Single-use token**
- `POST https://api.elevenlabs.io/v1/single-use-token/{token_type}` with `token_type` = `realtime_scribe`. The response is `{ "token": "sutkn_…" }`.
- The token expires after 15 minutes and is consumed on use. A `tts_websocket` token type also exists, but this PRD doesn't use it (TTS goes through the server proxy).

**Realtime speech-to-text WebSocket**
- URL: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`.
- The browser authenticates with the `token` query parameter.
- Query parameters:
  - `model_id=scribe_v2_realtime` (the only value)
  - `audio_format=pcm_16000` (the default, and recommended; it matches the existing worklet's 16 kHz linear16)
  - `language_code` (ISO 639-1 or 639-3)
  - `commit_strategy` = `manual` (the default) | `vad` | `turn_prediction`, plus VAD tuning such as `vad_silence_threshold_secs` (0.192–3.0)

**Realtime speech-to-text messages**
- Client → server: `{ "message_type": "input_audio_chunk", "audio_base_64": "<b64>", "commit": false, "sample_rate": 16000 }`. Frames are base64 JSON, **not** binary like Deepgram.
- To flush at the end, send a chunk with `commit: true`. Committing many times in quick succession degrades quality. In manual mode the model auto-commits after about 36 s of accumulated audio.
- Server → client:
  - `session_started`
  - `partial_transcript` {text}
  - `committed_transcript` {text}, which counts as the final
  - `warning` {warning}
  - error types, each carrying {error}: `auth_error`, `quota_exceeded`, `rate_limited`, `commit_throttled`, `session_time_limit_exceeded`, `insufficient_audio_activity`, `invalid_request` (which closes the socket), `input_error`, `chunk_size_exceeded`, `transcriber_error`, `error`, and others.
- The server doesn't close the socket after a commit, so the client closes it.
- The server drops the connection after 15 s with no client messages. That doesn't matter here: the worklet streams continuously, and frames queue before the socket opens.

**Streaming TTS**
- `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream`.
- Body: `text`, `model_id`, and optional `voice_settings` (including `speed`, default 1). The `output_format` query parameter defaults to `mp3_44100_128`.
- `language_code` is not supported for `eleven_multilingual_v2`.
- No response header reports character cost, which is irrelevant now that there's no meter.

**Model IDs and per-request character limits**
- Low latency: `eleven_flash_v2_5` (40,000 characters) and `eleven_v4_turbo` (newer; ElevenLabs now recommends it for low latency).
- Quality: `eleven_v4` (10,000) and `eleven_multilingual_v2` (10,000). ElevenLabs recommends either for quality.
- `GET /v1/models` returns a bare array with `can_do_text_to_speech` and `maximum_text_length_per_request`.

**Voices**
- `GET /v2/voices` returns `{ voices[], has_more, next_page_token }`, with `page_size` up to 100.
- Each voice has `voice_id`, `name` and `category` (premade, cloned, generated, professional, and others).

**API key permissions** (exact scope names): `speech_to_text`, `text_to_speech`, `voices_read`, `models_read`. The docs don't name a scope for creating single-use tokens.

### What changed from the PRD's earlier assumptions

- The audio framing is base64 JSON, not binary.
- Auth is a query parameter, not a WebSocket subprotocol.
- "End of stream" is a commit followed by a client-side close, not waiting for the server to close.
- The key help text should name four scopes: `speech_to_text`, `text_to_speech`, `voices_read`, `models_read`.
- The model picker can be filled from `GET /v1/models` instead of a hardcoded pair. Newer `eleven_v4` / `eleven_v4_turbo` models exist alongside Flash v2.5 and Multilingual v2.

### Decisions on the questions the docs left open (2026-10-29)

1. **Commit strategy: commit on pauses and at Stop.** Use `commit_strategy=vad` with `vad_silence_threshold_secs=0.3`, which mirrors Deepgram's tuned `endpointing=300`. Each phrase is committed as the learner pauses, and Stop sends one final `commit: true` chunk for the last words. The transcript stays deferred: committed text buffers and lands in the input only when the run ends.
2. **Model picker: live list, v4 Turbo default.** The picker lists every model from `GET /v1/models` with `can_do_text_to_speech`, so new models appear without an app update. The default is `eleven_v4_turbo` when the list includes it, otherwise `eleven_flash_v2_5`, otherwise the first TTS-capable model. A saved model that is no longer listed falls back the same way, and the picker shows the model actually in use.
3. **Output format: `mp3_44100_64`.** It's plenty for one speaking voice, works on every plan, and uses half the bandwidth and cache memory of the 128 kbps default. The ~50 MB cache holds about 1.7 hours of speech.

### Live check results (2026-10-29, slice 1)

These were run with the developer's own key from `.env.local`, created by the ElevenLabs CLI's `onboard connect`.

- **Auto-detect works.** A realtime session with no `language_code` returned `language_code: null` in `session_started.config`. When fed French speech, it committed the exact French text: "Bonjour, je voudrais apprendre la physique quantique aujourd'hui." The language mapper therefore omits `language_code` for "Multilingual" and for unsupported languages, as planned.
- **Server defaults to override.** Without overrides, the session defaults are `vad_silence_threshold_secs: 1.5`, `vad_threshold: 0.4` and `vad_commit_strategy: false`. The adapter must send `commit_strategy=vad` and `vad_silence_threshold_secs=0.3` explicitly.
- **The CLI-created key has every capability the app needs.** It created a `realtime_scribe` token (200, `sutkn_…`), ran streaming STT, did TTS at `pcm_16000`, listed voices (`GET /v2/voices`: 21 premade voices) and listed models (`GET /v1/models`).
- **TTS models the account lists**, with their `maximum_text_length_per_request`: `eleven_v4` (10000), `eleven_v4_turbo` (10000), `eleven_v3` (5000), `eleven_v3_conversational` (5000), `eleven_multilingual_v2` (10000), `eleven_flash_v2_5` (40000), `eleven_turbo_v2_5` (40000), `eleven_turbo_v2` (30000), `eleven_flash_v2` (30000). `eleven_v4_turbo` is available, so the planned default holds.
- **Still open: the minimum scopes for token creation.** No key restricted to the four scopes has been tested yet. This only affects the wording of the key help text in slice 2, not any code path. Until it's tested, the help text names the four scopes and says token creation may need a broader key.

### Checks to run first during implementation

These need a real ElevenLabs key, which the developer puts in `.env.local` themselves. Run them before building the parts that depend on them, and take the results back to the owner if they contradict the assumptions here.

- **Auto-detect when `language_code` is omitted.** Open a realtime session without `language_code`, speak a non-English phrase, and check that the `committed_transcript` comes back in that language (and what `session_started.config.language_code` echoes). Until this is confirmed, the language mapper omits `language_code` for "Multilingual" and for unsupported languages. If omitting it does **not** auto-detect, don't guess a fallback; ask the owner.
- **Token creation with a scoped key.** Create a key restricted to `speech_to_text` + `text_to_speech` + `voices_read` + `models_read`, and call `POST /v1/single-use-token/realtime_scribe` with it. If it's refused, find the smallest working permission set and put that in the ElevenLabs key help text, the way the Deepgram row explains its Member-role requirement. Until then, the help text says token creation may need a broader key.

## Further Notes
- **Repo process:** `AGENTS.md` requires a human-approved plan before implementation and forbids guessing design decisions. Anything this PRD leaves open must be asked, not assumed. Examples are the exact spoken marker wording, the default voice, and the chunk size limit.
- **Docs to update with the change:** architecture (process boundaries, voice services), development (new env key), keyboard (Esc chain step), and the README's dictation paragraph.
- **Upstream etiquette:** one PR against the main repository referencing issue #189. The README promises local storage and inspectable behavior, so the PR should say plainly that read-aloud text is sent to ElevenLabs.
