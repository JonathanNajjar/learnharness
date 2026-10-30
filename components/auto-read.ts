/**
 * Auto-read (ElevenLabs voice slice 10): decides whether the turn that just
 * ended is read aloud. Framework-free and fed by what chat.tsx already knows
 * each render, so every rule is testable without React.
 *
 * A turn is only eligible if this view SAW it begin (busy false -> true) and
 * see it end (true -> false). That one rule is what keeps history out: a
 * session opened or reloaded with replies already in it, a record adopted
 * from the server, and a turn that was already running when the view mounted
 * never play. The verdict is taken once, at the end; a skipped reply (setting
 * off, aborted, failed, dictating, nothing to say) is never revisited.
 *
 * The slice 11 hook for dock questions is a second event fed into this same
 * controller; it is deliberately not built here.
 */

/** The slice of a projected view message the controller needs. */
export interface AutoReadMessage {
	id: string;
	role: string;
	parts: ReadonlyArray<{ type: string; text?: string }>;
}

export interface AutoReadObservation {
	/** A turn is in flight: local stream or a server-side turn being watched. */
	busy: boolean;
	/** The turn ended in a failure the view shows (error status or banner). */
	failed: boolean;
	/** The read-aloud setting, as loaded; false until it has loaded. */
	enabled: boolean;
	/** stopReason of the final native assistant message (see finalAssistantStop). */
	finalStop: string | undefined;
	/** The projected transcript, as rendered. */
	messages: readonly AutoReadMessage[];
}

/** The text of a message the Listen button reads: its text parts only (never
 *  reasoning or tool cards), blank ones dropped, joined by a blank line. */
export function spokenText(parts: AutoReadMessage["parts"]): string {
	return parts
		.flatMap((part) => (part.type === "text" && part.text?.trim() ? [part.text] : []))
		.join("\n\n");
}

/** The Listen button's source id for the message at `index`. */
export function listenSourceId(message: { id: string }, index: number): string {
	return message.id || `m-${index}`;
}

/** stopReason of the last assistant message in the native record. */
export function finalAssistantStop(native: ReadonlyArray<{ role: string; stopReason?: string }>): string | undefined {
	for (let i = native.length - 1; i >= 0; i--) {
		if (native[i]!.role === "assistant") return native[i]!.stopReason;
	}
	return undefined;
}

export interface AutoRead {
	observe(observation: AutoReadObservation): void;
}

export function createAutoRead({ play, dictating }: {
	/** Start reading `markdown` as `sourceId` (the window player, in the app). */
	play: (sourceId: string, markdown: string) => void;
	dictating: () => boolean;
}): AutoRead {
	let seen = false;
	let wasBusy = false;
	/** The spoken text of every assistant message when the turn began; null
	 *  for a turn the view did not see begin. */
	let before: Map<string, string> | null = null;
	const played = new Set<string>();

	const spokenById = (messages: readonly AutoReadMessage[]) => {
		const map = new Map<string, string>();
		messages.forEach((m, i) => { if (m.role === "assistant") map.set(listenSourceId(m, i), spokenText(m.parts)); });
		return map;
	};

	return {
		observe(o) {
			if (o.busy) {
				if (!wasBusy) before = seen ? spokenById(o.messages) : null;
				wasBusy = true;
				seen = true;
				return;
			}
			seen = true;
			if (!wasBusy) return;
			wasBusy = false;
			const start = before;
			before = null;
			if (!start || !o.enabled || o.failed) return;
			if (o.finalStop === "error" || o.finalStop === "aborted") return;
			if (dictating()) return;
			const index = o.messages.length - 1;
			const last = o.messages[index];
			if (!last || last.role !== "assistant") return;
			const sourceId = listenSourceId(last, index);
			const spoken = spokenText(last.parts);
			if (!spoken || played.has(sourceId) || start.get(sourceId) === spoken) return;
			played.add(sourceId);
			play(sourceId, spoken);
		},
	};
}
