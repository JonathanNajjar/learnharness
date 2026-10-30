/**
 * The auto-read controller (ElevenLabs voice slice 10): fed by what chat.tsx
 * already knows each render (busy, failure, the projected messages), it decides
 * whether the turn that just ended is read aloud. Pure: `play` and `dictating`
 * are the only seams.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAutoRead, finalAssistantStop, listenSourceId, pendingQuestionSource, spokenText, type AutoReadMessage, type AutoReadObservation } from "../components/auto-read.ts";

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

describe("pendingQuestionSource", () => {
	const quizInput = { question: "Pick one?", options: [{ label: "A-OPT", value: "a" }, { label: "B-OPT", value: "b" }], correctAnswer: "a", explanation: "WHY" };

	it("derives the key, the q-<toolCallId> source id and the prompt-only markdown for every question tool", () => {
		const cases: Array<[string, unknown, string]> = [
			["quiz", quizInput, "Pick one?"],
			["probe", quizInput, "Pick one?"],
			["ask_user_question", { question: "Why?", details: "Be brief." }, "Why?\n\nBe brief."],
			["ask_user_question", { question: "Which?", options: [{ label: "X-OPT" }, { label: "Y-OPT" }], multiSelect: true }, "Which?"],
			["explain", { question: "Explain it.", correctAnswer: "SECRET" }, "Explain it."],
			["recall", { question: "Recall it.", correctAnswer: "SECRET" }, "Recall it."],
		];
		for (const [tool, input, markdown] of cases) {
			assert.deepEqual(pendingQuestionSource({ key: "m1:0", toolCallId: "c1", tool, input }), { key: "m1:0", sourceId: "q-c1", markdown }, tool);
		}
	});

	it("no pending question, or a malformed one, is nothing to read", () => {
		assert.equal(pendingQuestionSource(null), null);
		assert.equal(pendingQuestionSource({ key: "k", toolCallId: "c", tool: "quiz", input: { question: 3 } }), null);
	});
});

describe("auto-read: a new question's prompt (slice 11)", () => {
	const ask = (key: string, markdown = `Prompt ${key}?`) => ({ key, sourceId: `q-${key}`, markdown });

	/** play() returns a promise the test settles: the player's "source ended" (true) or "was cut off" (false). */
	function sequenced(opts: { dictating?: boolean } = {}) {
		const played: Array<{ sourceId: string; markdown: string }> = [];
		const ends: Array<(finished: boolean) => void> = [];
		let dictating = opts.dictating ?? false;
		const auto = createAutoRead({
			play: (sourceId, markdown) => {
				played.push({ sourceId, markdown });
				return new Promise<boolean>((resolve) => ends.push(resolve));
			},
			dictating: () => dictating,
		});
		const base: AutoReadObservation = { busy: false, failed: false, enabled: true, finalStop: "stop", messages: [] };
		const observe = (patch: Partial<AutoReadObservation>) => auto.observe({ ...base, ...patch });
		const ids = () => played.map((p) => p.sourceId);
		const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
		return { played, ends, observe, ids, flush, setDictating: (d: boolean) => { dictating = d; } };
	}

	/** A turn this view watched: idle, busy with the question arriving mid-turn, then finished. */
	function turnWithQuestion(f: ReturnType<typeof sequenced>, key = "k1", replyText: string | null = "Here is a question.") {
		const history = [user("u0"), reply("a0", "old")];
		f.observe({ messages: history });
		f.observe({ busy: true, messages: [...history, user("u1")] });
		f.observe({ busy: true, question: ask(key), messages: [...history, user("u1"), reply("a1", "Here")] });
		const reply1 = replyText === null ? { id: "a1", role: "assistant", parts: [{ type: "tool-quiz" }] } : reply("a1", replyText);
		f.observe({ question: ask(key), messages: [...history, user("u1"), reply1] });
		return [...history, user("u1"), reply1];
	}

	it("plays the reply first and the prompt only once the reply has finished playing", async () => {
		const f = sequenced();
		turnWithQuestion(f);
		assert.deepEqual(f.ids(), ["a1"], "the reply starts; the prompt waits its turn");
		await f.flush();
		assert.deepEqual(f.ids(), ["a1"], "still waiting while the reply plays");
		f.ends[0]!(true);
		await f.flush();
		assert.deepEqual(f.played, [
			{ sourceId: "a1", markdown: "Here is a question." },
			{ sourceId: "q-k1", markdown: "Prompt k1?" },
		]);
	});

	it("a tool-only turn plays the prompt alone", () => {
		const f = sequenced();
		turnWithQuestion(f, "k1", null);
		assert.deepEqual(f.played, [{ sourceId: "q-k1", markdown: "Prompt k1?" }]);
	});

	it("a question that arrives with the very observation that ends the turn counts too", async () => {
		const f = sequenced();
		f.observe({});
		f.observe({ busy: true, messages: [user("u")] });
		f.observe({ question: ask("k1"), messages: [user("u"), reply("a", "Look.")] });
		f.ends[0]!(true);
		await f.flush();
		assert.deepEqual(f.ids(), ["a", "q-k1"]);
	});

	it("a question already pending at mount, or restored with a reopened session, never plays", async () => {
		const f = sequenced();
		f.observe({ question: ask("k0"), messages: [user("u0"), reply("a0", "old")] });
		f.observe({ question: ask("k0"), messages: [user("u0"), reply("a0", "old")] });
		assert.deepEqual(f.played, []);
		// It stays quiet through a later turn too: it is not new.
		f.observe({ busy: true, question: ask("k0"), messages: [user("u0"), reply("a0", "old"), user("u1")] });
		f.observe({ question: ask("k0"), messages: [user("u0"), reply("a0", "old"), user("u1"), reply("a1", "Still there.")] });
		f.ends[0]!(true);
		await f.flush();
		assert.deepEqual(f.ids(), ["a1"], "only the reply; the old question is not re-announced");
	});

	it("a turn already running at mount that produces a question is not read", async () => {
		const f = sequenced();
		f.observe({ busy: true, messages: [user("u0")] });
		f.observe({ question: ask("k1"), messages: [user("u0"), reply("a0", "reattached")] });
		await f.flush();
		assert.deepEqual(f.played, []);
	});

	it("a question that shows up outside a turn this view watched (an adopted record) is not read", () => {
		const f = sequenced();
		f.observe({ messages: [user("u0")] });
		f.observe({ question: ask("k1"), messages: [user("u0"), reply("a0", "adopted")] });
		assert.deepEqual(f.played, []);
	});

	it("Stop (or Esc, or another Listen) during the reply cancels the queued prompt", async () => {
		const f = sequenced();
		turnWithQuestion(f);
		f.ends[0]!(false);
		await f.flush();
		assert.deepEqual(f.ids(), ["a1"]);
	});

	it("dictation skips the prompt: at the end of the turn, or starting while the reply plays", async () => {
		const atEnd = sequenced({ dictating: true });
		turnWithQuestion(atEnd);
		await atEnd.flush();
		assert.deepEqual(atEnd.played, []);

		const during = sequenced();
		turnWithQuestion(during);
		during.setDictating(true);
		during.ends[0]!(true);
		await during.flush();
		assert.deepEqual(during.ids(), ["a1"]);
	});

	it("is off with the setting off, and after an aborted or failed turn", async () => {
		for (const patch of [{ enabled: false }, { finalStop: "aborted" }, { finalStop: "error" }, { failed: true }] as Array<Partial<AutoReadObservation>>) {
			const f = sequenced();
			f.observe({ ...patch, messages: [user("u0")] });
			f.observe({ ...patch, busy: true, messages: [user("u0"), user("u1")] });
			f.observe({ ...patch, busy: true, question: ask("k1"), messages: [user("u0"), user("u1")] });
			f.observe({ ...patch, question: ask("k1"), messages: [user("u0"), user("u1"), { id: "a", role: "assistant", parts: [{ type: "tool-quiz" }] }] });
			await f.flush();
			assert.deepEqual(f.played, [], JSON.stringify(patch));
		}
	});

	it("plays each question once: re-observing it, or the reply finishing again, replays nothing", async () => {
		const f = sequenced();
		const messages = turnWithQuestion(f);
		f.ends[0]!(true);
		await f.flush();
		f.ends[1]!(true);
		f.observe({ question: ask("k1"), messages });
		f.observe({ question: ask("k1"), messages });
		await f.flush();
		assert.deepEqual(f.ids(), ["a1", "q-k1"]);
	});

	it("the learner answering before the reply ends drops the prompt", async () => {
		const f = sequenced();
		const messages = turnWithQuestion(f);
		f.observe({ question: null, messages });
		f.ends[0]!(true);
		await f.flush();
		assert.deepEqual(f.ids(), ["a1"]);
	});

	it("a new turn starting before the reply ends drops the stale prompt", async () => {
		const f = sequenced();
		const messages = turnWithQuestion(f);
		f.observe({ busy: true, question: null, messages: [...messages, user("u2")] });
		f.ends[0]!(true);
		await f.flush();
		assert.deepEqual(f.ids(), ["a1"]);
	});

	it("a later question in a later turn plays again, after its own reply", async () => {
		const f = sequenced();
		turnWithQuestion(f, "k1");
		f.ends[0]!(true);
		await f.flush();
		f.ends[1]!(true);
		f.observe({ busy: true, messages: [user("x")] });
		f.observe({ busy: true, question: ask("k2"), messages: [user("x"), reply("a9", "Next.")] });
		f.observe({ question: ask("k2"), messages: [user("x"), reply("a9", "Next.")] });
		f.ends[2]!(true);
		await f.flush();
		assert.deepEqual(f.ids(), ["a1", "q-k1", "a9", "q-k2"]);
	});
});
