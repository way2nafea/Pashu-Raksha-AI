# Voice-First Farmer Experience

Uses the browser's native Web Speech API (`SpeechRecognition` for input,
`speechSynthesis` for text-to-speech) — no external service, no API key.

## What's real

- `lib/voice.ts` detects actual browser support (`speechSupport()`) and
  never shows a mic button or claims voice works on a device that doesn't
  support it — the assistant (`components/VoiceAssistant.tsx`) renders
  nothing at all if neither recognition nor synthesis is available.
- Rendered only for the `FARMER` role (`PortalShell.tsx`), across every
  farmer page, per the brief's "voice-first farmer experience" focus.
- Supports English, Hindi, and Marathi via `lang` codes `en-IN`/`hi-IN`/`mr-IN`.
- Text-to-speech reads the AI risk result aloud on the report submission
  screen ("🔊 Listen to this result").

## Honest limitations

- **Command matching is keyword-based, not full NLU.** `matchCommand()` in
  `VoiceAssistant.tsx` checks whether the transcript contains one of a
  short list of English/Hindi/Marathi phrases per command. It will miss
  phrasings outside that list and say so ("Sorry, I didn't understand
  that...") rather than guessing.
- **Hindi/Marathi phrases are a reasonable best-effort translation**, not
  reviewed by a native speaker. Before a real deployment, have a native
  Hindi and Marathi speaker verify the phrases in `COMMANDS` and the
  spoken responses in `VoiceAssistant.tsx`.
- **Browser support varies.** `SpeechRecognition` (input) is well
  supported in Chrome/Edge on Android and desktop, but not in Safari/iOS
  at the time of writing — those users will see the assistant with voice
  input disabled (or the whole button hidden if `speechSynthesis` is also
  unavailable), never a mic that silently does nothing.
- Commands implemented: report sick animal, show my animals, where is my
  case, show nearby warnings, is my herd at risk, show vaccination status,
  what should I do, call veterinarian (points to the phone number already
  on the case page — there is no dialer integration).

## Where it lives

- `apps/web/src/lib/voice.ts` — `useVoiceInput()` hook + `speak()`/`stopSpeaking()`.
- `apps/web/src/components/VoiceAssistant.tsx` — floating mic button, language
  toggle, command routing.
- `apps/web/src/components/PortalShell.tsx` — mounts it for `FARMER` only.
- `apps/web/src/app/farmer/report/page.tsx` — TTS "Listen to this result" button.
