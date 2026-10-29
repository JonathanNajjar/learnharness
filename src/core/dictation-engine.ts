import { deepgramListenUrl, type DictationLanguage } from "./dictation.ts";

/** What one incoming socket message means to the dictation hook. */
export type DictationParsed = {
	/** Final transcript strings carried by the message (usually zero or one). */
	finals: string[];
	/** A provider error to surface; the hook ends the run with it. */
	error?: string;
	/** This message alone says the stream is finished (the hook finalizes and
	 *  closes the socket). Providers that finish on a close code leave it unset. */
	finished?: boolean;
};

/** The provider-specific half of dictation: everything about one streaming
 *  STT socket. The hook keeps the lifecycle (frame queue, deferred buffer,
 *  reconnect, safety net); an engine only speaks the wire protocol. Pure and
 *  browser-safe — no WebSocket here, only what to open, send and read. */
export interface DictationEngine {
	/** URL + subprotocols (auth) for `new WebSocket(url, protocols)`. */
	socket(token: string, language: DictationLanguage): { url: string; protocols: string[] };
	/** One worklet PCM frame → the payload to `send`. */
	encodeFrame(frame: ArrayBuffer): string | ArrayBuffer;
	/** One incoming text message → finals, an error, or a finished signal. */
	parseMessage(raw: string): DictationParsed;
	/** Messages to send, in order, to end the stream after the last frame. */
	endOfStream(): string[];
	/** Does this close code mean our end-of-stream landed (finalize now)? */
	isFinishedClose(code: number): boolean;
}

/** Deepgram: binary linear16 frames, JSON `Results`, `CloseStream`, and the
 *  server closes with 1000 once it has flushed. */
export const deepgramEngine: DictationEngine = {
	// Minted JWTs authenticate via the "bearer" subprotocol — ["token", jwt]
	// is rejected at the handshake (verified live; "token" is for raw API keys
	// only, as in the owner's pi dictate extension).
	socket: (token, language) => ({ url: deepgramListenUrl(language), protocols: ["bearer", token] }),
	encodeFrame: (frame) => frame,
	parseMessage(raw) {
		let msg: any;
		try {
			msg = JSON.parse(raw);
		} catch {
			return { finals: [] };
		}
		if (msg?.type !== "Results") return { finals: [] };
		const text: string | undefined = msg.channel?.alternatives?.[0]?.transcript;
		// Only finals stream (interim_results=false).
		return { finals: msg.is_final && text ? [text] : [] };
	},
	endOfStream: () => [JSON.stringify({ type: "CloseStream" })],
	isFinishedClose: (code) => code === 1000,
};
