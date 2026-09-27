"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLang = "en" | "hi" | "mr";

const LANG_CODES: Record<VoiceLang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
};

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function speechSupport() {
  if (typeof window === "undefined") {
    return { recognitionSupported: false, synthesisSupported: false };
  }
  return {
    recognitionSupported: !!getSpeechRecognition(),
    synthesisSupported: "speechSynthesis" in window,
  };
}

/** Read text aloud in the given language. No-ops silently (never throws)
 * if the browser doesn't support speech synthesis — callers should check
 * speechSupport().synthesisSupported to show/hide the control instead of
 * relying on this failing loudly. */
export function speak(text: string, lang: VoiceLang = "en") {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel(); // don't queue/overlap previous utterances
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_CODES[lang];
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Voice input hook. `supported` must be checked before showing any mic
 * UI — on unsupported browsers/devices this always reports false and
 * listen() is a no-op, so callers fall back to normal UI instead of
 * pretending voice works. */
export function useVoiceInput(lang: VoiceLang) {
  const [supported] = useState(() => speechSupport().recognitionSupported);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);

  const start = useCallback((onResult?: (text: string) => void) => {
    if (!supported) return;
    const SpeechRecognition = getSpeechRecognition();
    const recognition = new SpeechRecognition();
    recognition.lang = LANG_CODES[lang];
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setListening(true); setError(""); };
    recognition.onerror = (e: any) => { setError(e.error || "Voice input error"); setListening(false); };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || "";
      setTranscript(text);
      onResult?.(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, listening, transcript, error, start, stop };
}
