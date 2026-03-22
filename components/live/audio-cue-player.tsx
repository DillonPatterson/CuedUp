"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AudioCueEvent } from "@/lib/live/audio-cue-engine";

type AudioCuePlayerProps = {
  cue: AudioCueEvent | null;
  playRequest: number;
};

export function AudioCuePlayer({
  cue,
  playRequest,
}: AudioCuePlayerProps) {
  const lastRequestRef = useRef(0);
  const [status, setStatus] = useState("idle");
  const isSupported = useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
    () => false,
  );
  const effectiveStatus = isSupported ? status : "unsupported";

  useEffect(() => {
    if (!cue || playRequest === 0 || playRequest === lastRequestRef.current) {
      return;
    }

    lastRequestRef.current = playRequest;

    if (!isSupported) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cue.text);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setStatus("playing");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("error");

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [cue, isSupported, playRequest]);

  return (
    <div
      id="audio-cue-player-status"
      aria-live="polite"
      className="sr-only"
      data-audio-status={effectiveStatus}
      data-audio-cue={cue?.text ?? ""}
    >
      {effectiveStatus === "playing"
        ? `Playing audio cue ${cue?.text ?? ""}`
        : effectiveStatus === "unsupported"
          ? "Speech synthesis unavailable"
          : effectiveStatus === "error"
            ? "Speech synthesis error"
            : "Audio cue idle"}
    </div>
  );
}
