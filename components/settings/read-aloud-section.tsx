"use client";

import { useEffect, useState } from "react";
import {
	DEFAULT_TTS_VOICE_ID, keyRowTarget, resolveTtsModel,
	type TtsModel, type TtsVoice,
} from "@/src/core";
import { Hint } from "@/components/ui/hint";
import { SettingsRow, ThinSelect } from "@/components/settings/controls";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { useReadAloudSettings } from "@/components/read-aloud-preference";

/** The ElevenLabs key's id in the keys store (same as components/read-aloud.tsx). */
const ELEVENLABS_KEY_ID = "ELEVENLABS_API_KEY";

type Loaded<T> =
	| { status: "loading" }
	| { status: "ready"; items: T[] }
	| { status: "keyless" }
	| { status: "error"; message: string };

/** One account list from the proxy (/api/tts/voices or /api/tts/models).
 *  Never a stale or fake list: a failure is its own state, with its message. */
async function fetchList<T>(url: string, what: string): Promise<Loaded<T>> {
	try {
		const res = await fetch(url);
		if (res.ok) return { status: "ready", items: await res.json() as T[] };
		const body = await res.json().catch(() => null) as { message?: unknown; keyless?: unknown } | null;
		if (res.status === 503 && typeof body?.keyless === "string") return { status: "keyless" };
		return { status: "error", message: typeof body?.message === "string" && body.message ? body.message : `Could not load ${what} (${res.status})` };
	} catch {
		return { status: "error", message: `Could not load ${what}` };
	}
}

function useList<T>(url: string, what: string): Loaded<T> {
	const [state, setState] = useState<Loaded<T>>({ status: "loading" });
	useEffect(() => {
		let live = true;
		void fetchList<T>(url, what).then((next) => { if (live) setState(next); });
		return () => { live = false; };
	}, [url, what]);
	return state;
}

/** Settings → Read aloud: the voice and model ElevenLabs speaks with. Both
 *  lists come live from the account; an unset choice shows what would play
 *  (Alice; the resolved model), so the picker never claims otherwise. */
export function ReadAloudSection() {
	const { open: openSettings } = useSettingsDialog();
	const { voiceId, modelId, loaded, saving, error, saveVoice, saveModel } = useReadAloudSettings();
	const voices = useList<TtsVoice>("/api/tts/voices", "voices");
	const models = useList<TtsModel>("/api/tts/models", "models");
	const keyless = voices.status === "keyless" || models.status === "keyless";

	return <>
		<p data-testid="read-aloud-billing-note" className="text-xs text-muted-foreground/70">
			ElevenLabs bills your account separately, so read aloud is not shown in the cost meter.
		</p>
		{keyless ? (
			<button
				type="button"
				data-testid="read-aloud-keyless"
				onClick={() => openSettings("keys", keyRowTarget(ELEVENLABS_KEY_ID, "read-aloud"))}
				className="self-start text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
			>
				Read aloud needs an ElevenLabs key
			</button>
		) : <>
			<VoiceRow state={voices} saved={voiceId} disabled={saving || !loaded} onChange={(v) => void saveVoice(v)} error={error} />
			<ModelRow state={models} saved={modelId} disabled={saving || !loaded} onChange={(m) => void saveModel(m)} error={error} />
		</>}
		{error && !keyless && <p role="alert" data-testid="read-aloud-save-error" className="text-xs text-destructive">{error}</p>}
	</>;
}

function ListError({ testid, message }: { testid: string; message: string }) {
	return <p role="alert" data-testid={testid} className="text-xs text-destructive">{message}</p>;
}

function VoiceRow({ state, saved, disabled, onChange, error }: {
	state: Loaded<TtsVoice>; saved: string | undefined; disabled: boolean; onChange: (id: string) => void; error: string | null;
}) {
	if (state.status === "error") return <SettingsRow label="Voice" testid="row-read-aloud-voice"><ListError testid="read-aloud-voices-error" message={state.message} /></SettingsRow>;
	const value = saved ?? DEFAULT_TTS_VOICE_ID;
	const items = state.status === "ready" ? state.items : [];
	const known = items.some((v) => v.id === value);
	return <SettingsRow label="Voice" testid="row-read-aloud-voice">
		<Hint label={error ?? "Read aloud voice"} side="top">
			<ThinSelect value={value} ariaLabel="Read aloud voice" testid="read-aloud-voice" disabled={disabled || state.status !== "ready"} onChange={onChange}>
				{!known && <option value={value}>{state.status === "loading" ? "Loading voices…" : value === DEFAULT_TTS_VOICE_ID ? "Alice (default)" : `${value} (not on this account)`}</option>}
				{items.map((v) => <option key={v.id} value={v.id}>{v.category ? `${v.name} (${v.category})` : v.name}</option>)}
			</ThinSelect>
		</Hint>
	</SettingsRow>;
}

function ModelRow({ state, saved, disabled, onChange, error }: {
	state: Loaded<TtsModel>; saved: string | undefined; disabled: boolean; onChange: (id: string) => void; error: string | null;
}) {
	if (state.status === "error") return <SettingsRow label="Model" testid="row-read-aloud-model"><ListError testid="read-aloud-models-error" message={state.message} /></SettingsRow>;
	const items = state.status === "ready" ? state.items : [];
	// What actually plays: a saved model that is no longer listed shows the fallback.
	const value = state.status === "ready" ? resolveTtsModel(saved, items.map((m) => m.id)) : "";
	return <SettingsRow label="Model" testid="row-read-aloud-model">
		<Hint label={error ?? "Read aloud model"} side="top">
			<ThinSelect value={value} ariaLabel="Read aloud model" testid="read-aloud-model" disabled={disabled || state.status !== "ready"} onChange={onChange}>
				{state.status !== "ready" && <option value="">Loading models…</option>}
				{items.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
			</ThinSelect>
		</Hint>
	</SettingsRow>;
}
