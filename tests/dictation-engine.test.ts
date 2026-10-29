import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deepgramListenUrl } from "../src/core/dictation.ts";
import { deepgramEngine } from "../src/core/dictation-engine.ts";

describe("Deepgram dictation engine adapter", () => {
	it("builds today's socket: listen URL plus the bearer subprotocol carrying the token", () => {
		assert.deepEqual(deepgramEngine.socket("jwt-1", "en-GB"), {
			url: deepgramListenUrl("en-GB"),
			protocols: ["bearer", "jwt-1"],
		});
	});

	it("passes a PCM frame through as binary", () => {
		const frame = new ArrayBuffer(8);
		assert.equal(deepgramEngine.encodeFrame(frame), frame);
	});

	it("yields the transcript of a final Results message", () => {
		const raw = JSON.stringify({ type: "Results", is_final: true, channel: { alternatives: [{ transcript: "hello there" }] } });
		assert.deepEqual(deepgramEngine.parseMessage(raw), { finals: ["hello there"] });
	});

	it("yields nothing for non-final, empty, other-typed or malformed messages", () => {
		const alt = (transcript: string) => ({ alternatives: [{ transcript }] });
		for (const raw of [
			JSON.stringify({ type: "Results", is_final: false, channel: alt("interim") }),
			JSON.stringify({ type: "Results", is_final: true, channel: alt("") }),
			JSON.stringify({ type: "Results", is_final: true }),
			JSON.stringify({ type: "Metadata" }),
			"{not json",
		]) {
			assert.deepEqual(deepgramEngine.parseMessage(raw), { finals: [] }, raw);
		}
	});

	it("ends the stream with a CloseStream message", () => {
		assert.deepEqual(deepgramEngine.endOfStream(), ['{"type":"CloseStream"}']);
	});

	it("treats close code 1000 as finished and any other code as not", () => {
		assert.equal(deepgramEngine.isFinishedClose(1000), true);
		for (const code of [1001, 1006, 1008, 1011, 4000]) assert.equal(deepgramEngine.isFinishedClose(code), false, String(code));
	});

	it("never marks a message as finishing the stream (the close does that)", () => {
		const raw = JSON.stringify({ type: "Results", is_final: true, channel: { alternatives: [{ transcript: "x" }] } });
		assert.notEqual(deepgramEngine.parseMessage(raw).finished, true);
	});
});
