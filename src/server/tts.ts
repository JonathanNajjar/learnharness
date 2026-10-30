/**
 * The read-aloud proxy (ElevenLabs voice slice 6): text in, MP3 stream out.
 *
 * The renderer never holds the ElevenLabs key — it POSTs text to /api/tts and
 * this module calls the provider with the server-side key (auth.json /
 * .env.local via keyValue, the same seam as the dictation token route) and
 * pipes the audio body straight back, unbuffered, so the first bytes reach the
 * player while the rest is still being synthesized.
 *
 * The provider is a small seam (TtsProvider): ElevenLabs is the only one in
 * this change, but its request shape, key id and defaults live behind the
 * interface so another provider can be added without touching the handler.
 *
 * Errors keep the client's job easy: 400 bad request, 503 keyless
 * ({ message, keyless: <key id> }), 502 upstream ({ message, upstreamStatus }
 * — the provider's own status, e.g. quota or permission). The key never
 * appears in any body, even one an upstream echoes it into.
 */

import { keyValue } from "./keys.ts";

/** The wire-callable shape the proxy closes over (tests inject a stub). */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Longest text one request may carry (owner, 2026-10-29): far below every
 *  model's own limit — the client sends short chunks anyway. */
export const TTS_MAX_TEXT_CHARS = 2500;

/** One text-to-speech provider behind the proxy. */
export interface TtsProvider {
	id: string;
	/** The key-store id of the provider's API key. */
	keyId: string;
	/** Human name for error messages. */
	label: string;
	defaultVoiceId: string;
	defaultModelId: string;
	/** The upstream streaming request for one chunk of text. */
	request(input: { key: string; text: string; voiceId: string; modelId: string }): { url: string; init: RequestInit };
	/** A short human line from an upstream error body ("" when none). */
	errorDetail(body: string): string;
}

/** Alice — premade "Clear, Engaging Educator" (owner, 2026-10-29). */
export const DEFAULT_TTS_VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2";
/** Until the live model list lands (slice 9): ElevenLabs' recommended low-latency model. */
export const DEFAULT_TTS_MODEL_ID = "eleven_v4_turbo";

export const elevenLabsTts: TtsProvider = {
	id: "elevenlabs",
	keyId: "ELEVENLABS_API_KEY",
	label: "ElevenLabs",
	defaultVoiceId: DEFAULT_TTS_VOICE_ID,
	defaultModelId: DEFAULT_TTS_MODEL_ID,
	request({ key, text, voiceId, modelId }) {
		return {
			url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_64`,
			init: {
				method: "POST",
				headers: { "xi-api-key": key, "Content-Type": "application/json" },
				body: JSON.stringify({ text, model_id: modelId }),
			},
		};
	},
	errorDetail(body) {
		// ElevenLabs errors are { detail: { status, message } } (or a bare string detail).
		try {
			const detail = (JSON.parse(body) as { detail?: unknown }).detail;
			if (typeof detail === "string") return detail;
			const d = detail as { message?: unknown; status?: unknown } | undefined;
			if (typeof d?.message === "string") return d.message;
			if (typeof d?.status === "string") return d.status;
		} catch {
			// Not JSON — no detail; the status alone says enough.
		}
		return "";
	},
};

/** Today's only provider; the seam a second one would slot into. */
function resolveTtsProvider(): TtsProvider {
	return elevenLabsTts;
}

export interface SpeakDeps {
	fetchFn?: FetchLike;
	/** The provider key; defaults to the server key store. */
	getKey?: (keyId: string) => string | undefined;
}

const PLAIN_ID = /^[A-Za-z0-9_.-]{1,100}$/;

function badRequest(message: string): Response {
	return Response.json({ message }, { status: 400 });
}

/** Scrub the key out of any text bound for a response body. */
function scrub(text: string, key: string): string {
	return key ? text.split(key).join("") : text;
}

/** POST /api/tts's body: `{ text, voiceId?, modelId? }` → streamed audio or an error response. */
export async function speak(body: unknown, deps: SpeakDeps = {}): Promise<Response> {
	const provider = resolveTtsProvider();
	const { text, voiceId, modelId } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
	if (typeof text !== "string" || text.trim() === "") return badRequest("text is required");
	if (text.length > TTS_MAX_TEXT_CHARS) return badRequest(`text is over the ${TTS_MAX_TEXT_CHARS}-character limit`);
	if (voiceId !== undefined && !(typeof voiceId === "string" && PLAIN_ID.test(voiceId))) return badRequest("invalid voiceId");
	if (modelId !== undefined && !(typeof modelId === "string" && PLAIN_ID.test(modelId))) return badRequest("invalid modelId");

	const key = (deps.getKey ?? keyValue)(provider.keyId);
	if (!key) {
		return Response.json(
			{
				message: `No ${provider.keyId} — add it to auth.json (desktop) or .env.local (dev).`,
				keyless: provider.keyId,
			},
			{ status: 503 },
		);
	}

	const fetchFn: FetchLike = deps.fetchFn ?? ((url, init) => fetch(url, init));
	const { url, init } = provider.request({
		key,
		text,
		voiceId: (voiceId as string | undefined) ?? provider.defaultVoiceId,
		modelId: (modelId as string | undefined) ?? provider.defaultModelId,
	});
	let upstream: Response;
	try {
		upstream = await fetchFn(url, init);
	} catch {
		return Response.json({ message: `${provider.label} unreachable` }, { status: 502 });
	}
	if (!upstream.ok || !upstream.body) {
		const detail = scrub(provider.errorDetail(await upstream.text().catch(() => "")), key).slice(0, 160);
		return Response.json(
			{
				message: `${provider.label} error (${upstream.status})${detail ? `: ${detail}` : ""}`,
				upstreamStatus: upstream.status,
			},
			{ status: 502 },
		);
	}
	return new Response(upstream.body, {
		status: 200,
		headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
	});
}
