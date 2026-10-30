/**
 * The read-aloud player — framework-free core (ElevenLabs voice slice 6).
 *
 * One per window (the hook in components/read-aloud.tsx holds the singleton).
 * It owns ONE audio element, so only one source plays at a time: play() on a
 * new source stops the current one. A source is a list of text chunks (see
 * core/speech-text.ts); they play in order, and chunk n+1 is requested the
 * moment chunk n starts playing, so a long reply streams without audible gaps
 * while the first chunk (short by construction) starts fast.
 *
 * Transport (chosen over MediaSource, 2026-10-29): plain fetch of each chunk's
 * MP3 → Blob → object URL → the audio element. MediaSource would splice the
 * chunks into one stream, but it drags in MIME-support checks, append-buffer
 * state and Safari/Electron variance for a gain (no gap between chunks) the
 * prefetch already mostly buys. Every object URL is revoked once it has
 * played, been stopped, or failed.
 *
 * Seams for later slices, not built here:
 *  - `loadChunk` is where an in-memory audio cache (slice 8) wraps the
 *    network: it turns (text, signal) into audio bytes, nothing more.
 *  - `stop()` is public and idempotent, so Esc and dictation (slice 7) and
 *    auto-read (slice 10) can call it.
 *
 * Errors keep keyless apart from upstream (the keyless one deep-links to the
 * key box; the rest show inline). An abort from stop() is never an error.
 */

/** The client-authored KEYLESS line (the route's 503 body is dev-speak):
 *  the Listen button shows it and deep-links Settings → Keys → Read aloud. */
export const READ_ALOUD_KEYLESS = "Read aloud needs an ElevenLabs key";

export interface ReadAloudError {
	/** The source that failed — the error shows on that message only. */
	sourceId: string;
	kind: "keyless" | "upstream";
	message: string;
}

export interface ReadAloudSnapshot {
	/** The source being read (or fetched for) right now; null when idle. */
	sourceId: string | null;
	error: ReadAloudError | null;
}

/** The slice of HTMLAudioElement the player uses. */
export interface AudioLike {
	src: string;
	onended: ((event: Event) => unknown) | null;
	onerror: ((event: Event | string) => unknown) | null;
	play(): Promise<void>;
	pause(): void;
}

export interface ReadAloudDeps {
	/** Defaults to the global fetch (POST /api/tts). */
	fetch?: typeof fetch;
	/** Defaults to `new Audio()`; created on first playback. */
	createAudio?: () => AudioLike;
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
	/** Text → audio bytes. Defaults to the /api/tts request; the cache seam. */
	loadChunk?: (text: string, signal: AbortSignal) => Promise<Blob>;
	/** Whether dictation is live (slice 7). Defaults to never. */
	isDictationActive?: () => boolean;
}

export interface ReadAloudPlayer {
	/** Read `chunks` aloud as `sourceId`, stopping whatever played before.
	 *  Resolves when the source finished, failed or was stopped. */
	play(sourceId: string, chunks: readonly string[]): Promise<void>;
	/** Stop now. Idempotent. Leaves an error showing; the next play() clears it. */
	stop(): void;
	clearError(): void;
	/** True while dictation is live: auto-read (slice 10) must not start playback then. */
	dictationActive(): boolean;
	getSnapshot(): ReadAloudSnapshot;
	subscribe(listener: () => void): () => void;
}

class ReadAloudFailure extends Error {
	constructor(
		readonly kind: ReadAloudError["kind"],
		message: string,
	) {
		super(message);
	}
}

/** The /api/tts request for one chunk, errors mapped to keyless/upstream. */
function tts(fetchFn: typeof fetch): (text: string, signal: AbortSignal) => Promise<Blob> {
	return async (text, signal) => {
		let res: Response;
		try {
			res = await fetchFn("/api/tts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
				signal,
			});
		} catch (error) {
			if (signal.aborted) throw error;
			throw new ReadAloudFailure("upstream", "Read aloud couldn't connect");
		}
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: unknown; keyless?: unknown } | null;
			if (res.status === 503 && body && typeof body.keyless === "string") {
				throw new ReadAloudFailure("keyless", READ_ALOUD_KEYLESS);
			}
			const message = typeof body?.message === "string" && body.message ? body.message : `Read aloud failed (${res.status})`;
			throw new ReadAloudFailure("upstream", message);
		}
		return res.blob();
	};
}

export function createReadAloudPlayer(deps: ReadAloudDeps = {}): ReadAloudPlayer {
	const loadChunk = deps.loadChunk ?? tts(deps.fetch ?? ((input, init) => fetch(input, init)));
	const createAudio = deps.createAudio ?? (() => new Audio());
	const createObjectURL = deps.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
	const revokeObjectURL = deps.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));

	let snapshot: ReadAloudSnapshot = { sourceId: null, error: null };
	const listeners = new Set<() => void>();
	const set = (next: ReadAloudSnapshot) => {
		snapshot = next;
		for (const listener of [...listeners]) listener();
	};

	let audio: AudioLike | undefined;
	/** Bumped by every play()/stop(): a run whose generation is stale is dead. */
	let generation = 0;
	let controller: AbortController | undefined;
	/** Object URLs created and not yet revoked. */
	const live = new Set<string>();
	const revoke = (url: string) => {
		if (live.delete(url)) revokeObjectURL(url);
	};

	/** Silence the element and release everything the current run holds. */
	const halt = () => {
		generation++;
		controller?.abort();
		controller = undefined;
		if (audio) {
			audio.onended = null;
			audio.onerror = null;
			audio.pause();
		}
		for (const url of [...live]) revoke(url);
	};

	const playUrl = (url: string): Promise<void> =>
		new Promise((resolve, reject) => {
			const element = (audio ??= createAudio());
			const unplayable = () => reject(new ReadAloudFailure("upstream", "Read aloud couldn't play the audio"));
			element.onended = () => resolve();
			element.onerror = unplayable;
			element.src = url;
			element.play().catch(unplayable);
		});

	const run = async (id: number, sourceId: string, chunks: readonly string[], signal: AbortSignal) => {
		const loads: Promise<Blob>[] = [];
		const start = (i: number) => {
			const load = loadChunk(chunks[i]!, signal);
			load.catch(() => {}); // surfaced when its turn comes, never as an unhandled rejection
			loads[i] = load;
		};
		try {
			start(0);
			for (let i = 0; i < chunks.length; i++) {
				const blob = await loads[i]!;
				if (id !== generation) return;
				if (i + 1 < chunks.length) start(i + 1); // prefetch while this one plays
				const url = createObjectURL(blob);
				live.add(url);
				try {
					await playUrl(url);
				} finally {
					revoke(url);
				}
				if (id !== generation) return;
			}
			set({ sourceId: null, error: snapshot.error });
		} catch (error) {
			if (id !== generation) return; // stopped or superseded: not a failure
			halt();
			const failure =
				error instanceof ReadAloudFailure ? error : new ReadAloudFailure("upstream", "Read aloud failed");
			set({ sourceId: null, error: { sourceId, kind: failure.kind, message: failure.message } });
		}
	};

	return {
		play(sourceId, chunks) {
			halt();
			if (chunks.length === 0) {
				if (snapshot.sourceId !== null || snapshot.error !== null) set({ sourceId: null, error: null });
				return Promise.resolve();
			}
			controller = new AbortController();
			set({ sourceId, error: null });
			return run(generation, sourceId, chunks, controller.signal);
		},
		stop() {
			halt();
			if (snapshot.sourceId !== null) set({ sourceId: null, error: snapshot.error });
		},
		dictationActive: () => deps.isDictationActive?.() ?? false,
		clearError() {
			if (snapshot.error !== null) set({ sourceId: snapshot.sourceId, error: null });
		},
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
