/**
 * The auto-read controller (ElevenLabs voice slice 10): fed by what chat.tsx
 * already knows each render (busy, failure, the projected messages), it decides
 * whether the turn that just ended is read aloud. Pure: `play` and `dictating`
 * are the only seams.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAutoRead, finalAssistantStop, listenSourceId, spokenText, type AutoReadMessage, type AutoReadObservation } from "../components/auto-read.ts";

const text = (t: string) => ({ type: "text", text: t });
const user = (id: string): AutoReadMessage => ({ id, role: "user", parts: [text("hi")] });
const reply = (id: string, ...texts: string[]): AutoReadMessage => ({ id, role: "assistant", parts: [{ type: "step-start" }, ...texts.map(text)] });

function fixture(opts: { dictating?: boolean } = {}) {
	const played: Array<{ sourceId: string; markdown: string }> = [];
	let dictating = opts.dictating ?? false;
	const auto = createAutoRead({
		play: (sourceId, markdown) => { played.push({ sourceId, markdown }); },
		dictating: () => dictating,
	});
	const base: AutoReadObservation = { busy: false, failed: false, enabled: true, finalStop: "stop", messages: [] };
	const observe = (patch: Partial<AutoReadObservation>) => auto.observe({ ...base, ...patch });
	return { played, observe, setDictating: (d: boolean) => { dictating = d; } };
}

describe("auto-read: when a turn plays", () => {
	it("plays the final reply once the turn has finished, with the Listen button's id and text", () => {
		const f = fixture();
		const history = [user("u0"), reply("a0", "old")];
		f.observe({ messages: history });
		f.observe({ busy: true, messages: [...history, user("u1")] });
		f.observe({ busy: true, messages: [...history, user("u1"), reply("a1", "Hel")] });
		assert.deepEqual(f.played, [], "never while streaming");
		f.observe({ messages: [...history, user("u1"), reply("a1", "Hello", "World")] });
		assert.deepEqual(f.played, [{ sourceId: "a1", markdown: "Hello\n\nWorld" }]);
		f.observe({ messages: [...history, user("u1"), reply("a1", "Hello", "World")] });
		assert.equal(f.played.length, 1, "at most once");
	});

	it("falls back to the m-<index> id when a message has no id, like the button", () => {
		const f = fixture();
		f.observe({});
		f.observe({ busy: true, messages: [user("u")] });
		f.observe({ messages: [user("u"), reply("", "Yo")] });
		assert.deepEqual(f.played, [{ sourceId: "m-1", markdown: "Yo" }]);
	});

	it("history present at open or reload plays nothing, however it arrives", () => {
		const f = fixture();
		f.observe({ messages: [user("u0"), reply("a0", "old")] });
		f.observe({ messages: [user("u0"), reply("a0", "old"), user("u1"), reply("a1", "also old")] }); // adopted record
		assert.deepEqual(f.played, []);
	});

	it("a turn already running when the view opened is not read", () => {
		const f = fixture();
		f.observe({ busy: true, messages: [user("u0")] });
		f.observe({ messages: [user("u0"), reply("a0", "reattached")] });
		assert.deepEqual(f.played, []);
		f.observe({ busy: true, messages: [user("u0"), reply("a0", "reattached"), user("u1")] });
		f.observe({ messages: [user("u0"), reply("a0", "reattached"), user("u1"), reply("a1", "next")] });
		assert.deepEqual((f.played as Array<{ sourceId: string }>).map((p) => p.sourceId), ["a1"], "the next turn is");
	});

	it("is off when the setting is off at the moment the turn finishes", () => {
		const f = fixture();
		f.observe({ enabled: false });
		f.observe({ busy: true, enabled: false, messages: [user("u")] });
		f.observe({ enabled: false, messages: [user("u"), reply("a", "x")] });
		assert.deepEqual(f.played, []);
	});

	it("aborted and failed turns do not play, and do not play later", () => {
		for (const patch of [{ finalStop: "aborted" }, { finalStop: "error" }, { failed: true }] as Array<Partial<AutoReadObservation>>) {
			const f = fixture();
			f.observe({});
			f.observe({ busy: true, messages: [user("u")] });
			f.observe({ ...patch, messages: [user("u"), reply("a", "partial")] });
			f.observe({ messages: [user("u"), reply("a", "partial")] });
			assert.deepEqual(f.played, [], JSON.stringify(patch));
		}
	});

	it("a reply that finishes during dictation is skipped and never played later", () => {
		const f = fixture({ dictating: true });
		f.observe({});
		f.observe({ busy: true, messages: [user("u")] });
		f.observe({ messages: [user("u"), reply("a", "x")] });
		f.setDictating(false);
		f.observe({ messages: [user("u"), reply("a", "x")] });
		f.observe({ messages: [user("u"), reply("a", "x")] });
		assert.deepEqual(f.played, []);
	});

	it("a tool-only final message reads nothing, and the turn's final reply is the whole group's text", () => {
		const f = fixture();
		f.observe({});
		f.observe({ busy: true, messages: [user("u")] });
		f.observe({ messages: [user("u"), { id: "a", role: "assistant", parts: [{ type: "tool-search" }] }] });
		assert.deepEqual(f.played, []);
		f.observe({ busy: true, messages: [user("u"), user("u2")] });
		f.observe({ messages: [user("u"), user("u2"), { id: "b", role: "assistant", parts: [text("before"), { type: "tool-search" }, text("after")] }] });
		assert.deepEqual(f.played, [{ sourceId: "b", markdown: "before\n\nafter" }]);
	});

	it("a turn that produced no new assistant text reads nothing (the previous reply is not repeated)", () => {
		const f = fixture();
		const history = [user("u0"), reply("a0", "old")];
		f.observe({ messages: history });
		f.observe({ busy: true, messages: history });
		f.observe({ messages: history });
		assert.deepEqual(f.played, []);
	});

	it("a retry that adds text to the same group reads it, once", () => {
		const f = fixture();
		const before = [user("u"), reply("a", "partial")];
		f.observe({ messages: before });
		f.observe({ busy: true, messages: before });
		f.observe({ messages: [user("u"), reply("a", "partial", "full answer")] });
		assert.deepEqual(f.played, [{ sourceId: "a", markdown: "partial\n\nfull answer" }]);
	});
});

describe("auto-read helpers", () => {
	it("spokenText joins text parts and ignores blanks, reasoning and tools", () => {
		assert.equal(spokenText([{ type: "reasoning", text: "hm" }, text("  "), text("a"), { type: "tool-x" }, text("b")]), "a\n\nb");
	});
	it("listenSourceId", () => {
		assert.equal(listenSourceId({ id: "x" }, 3), "x");
		assert.equal(listenSourceId({ id: "" }, 3), "m-3");
	});
	it("finalAssistantStop reads the last native assistant message", () => {
		assert.equal(finalAssistantStop([]), undefined);
		assert.equal(finalAssistantStop([{ role: "assistant", stopReason: "stop" }, { role: "toolResult" }, { role: "assistant", stopReason: "aborted" }, { role: "custom" }]), "aborted");
	});
});
