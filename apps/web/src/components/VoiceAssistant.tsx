"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVoiceInput, speak, speechSupport, VoiceLang } from "@/lib/voice";
import { api } from "@/lib/api";

const LABELS: Record<VoiceLang, { name: string; help: string; noMatch: string }> = {
  en: { name: "English", help: "Try: \"report sick animal\", \"show my animals\", \"where is my case\", \"is my herd at risk\", \"show vaccination status\".",
        noMatch: "Sorry, I didn't understand that. Try: report sick animal, show my animals, or is my herd at risk." },
  hi: { name: "हिंदी", help: "कहें: \"बीमार जानवर की रिपोर्ट करो\", \"मेरे जानवर दिखाओ\", \"मेरा मामला कहाँ है\", \"क्या मेरा झुंड खतरे में है\"।",
        noMatch: "माफ़ कीजिए, मुझे समझ नहीं आया। कोशिश करें: बीमार जानवर की रिपोर्ट करो, या मेरे जानवर दिखाओ।" },
  mr: { name: "मराठी", help: "सांगा: \"आजारी जनावराची तक्रार करा\", \"माझी जनावरे दाखवा\", \"माझे प्रकरण कुठे आहे\", \"माझा कळप धोक्यात आहे का\".",
        noMatch: "माफ करा, मला समजले नाही. प्रयत्न करा: आजारी जनावराची तक्रार करा, किंवा माझी जनावरे दाखवा." },
};

// Best-effort keyword matching (not full NLU) across the three supported
// languages — translations are a reasonable approximation, not
// professionally verified, and should be reviewed by a native speaker
// before real-world deployment. See docs/voice-assistant.md.
const COMMANDS: { keywords: string[]; action: string }[] = [
  { keywords: ["report sick", "report a sick", "बीमार", "आजारी"], action: "report" },
  { keywords: ["show my animal", "my animals", "जानवर दिखाओ", "जनावरे दाखवा"], action: "animals" },
  { keywords: ["where is my case", "my case", "मामला", "प्रकरण"], action: "cases" },
  { keywords: ["nearby warning", "nearby alert", "चेतावनी", "इशारा"], action: "alerts" },
  { keywords: ["herd at risk", "herd risk", "झुंड", "कळप"], action: "herd_risk" },
  { keywords: ["vaccination status", "vaccination", "टीकाकरण", "लसीकरण"], action: "vaccination" },
  { keywords: ["what should i do", "क्या करना", "काय करावे"], action: "advice" },
  { keywords: ["call veterinarian", "call vet", "चिकित्सक", "पशुवैद्य"], action: "call_vet" },
];

function matchCommand(transcript: string): string | null {
  const t = transcript.toLowerCase();
  for (const c of COMMANDS) {
    if (c.keywords.some((k) => t.includes(k.toLowerCase()))) return c.action;
  }
  return null;
}

export default function VoiceAssistant() {
  const router = useRouter();
  const [lang, setLang] = useState<VoiceLang>("en");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const { supported: recognitionSupported, listening, start, stop } = useVoiceInput(lang);
  const { synthesisSupported } = speechSupport();

  async function handleTranscript(text: string) {
    setStatus(text);
    const action = matchCommand(text);
    try {
      switch (action) {
        case "report":
          speak(lang === "en" ? "Opening the symptom report form." : lang === "hi" ? "लक्षण रिपोर्ट फ़ॉर्म खोल रहे हैं।" : "लक्षण अहवाल फॉर्म उघडत आहे.", lang);
          router.push("/farmer/report");
          break;
        case "animals":
          speak(lang === "en" ? "Showing your farms and animals." : lang === "hi" ? "आपके खेत और जानवर दिखा रहे हैं।" : "तुमची शेती आणि जनावरे दाखवत आहे.", lang);
          router.push("/farmer/farms");
          break;
        case "cases":
          speak(lang === "en" ? "Showing your reports." : lang === "hi" ? "आपकी रिपोर्ट दिखा रहे हैं।" : "तुमचे अहवाल दाखवत आहे.", lang);
          router.push("/farmer/cases");
          break;
        case "alerts":
          speak(lang === "en" ? "Showing nearby alerts." : lang === "hi" ? "आस-पास की चेतावनियाँ दिखा रहे हैं।" : "जवळपासचे इशारे दाखवत आहे.", lang);
          router.push("/farmer/alerts");
          break;
        case "herd_risk": {
          const farms = await api.get("/api/v1/farms");
          if (!farms?.length) {
            speak(lang === "en" ? "You don't have any farms yet." : lang === "hi" ? "आपके पास अभी कोई खेत नहीं है।" : "तुमच्याकडे अजून शेत नाही.", lang);
            break;
          }
          const summary = await api.get(`/api/v1/farms/${farms[0].id}/herd-summary`);
          const level = summary.herd_risk.herd_risk_level;
          const msg = level === "INSUFFICIENT_DATA"
            ? (lang === "en" ? "Not enough data yet to assess your herd risk." : lang === "hi" ? "आपके झुंड के जोखिम का आकलन करने के लिए पर्याप्त जानकारी नहीं है।" : "तुमच्या कळपाच्या जोखमीचे मूल्यांकन करण्यासाठी पुरेसा डेटा नाही.")
            : (lang === "en" ? `Your herd risk is ${level}.` : lang === "hi" ? `आपके झुंड का जोखिम स्तर ${level} है।` : `तुमच्या कळपाची जोखीम पातळी ${level} आहे.`);
          speak(msg, lang);
          break;
        }
        case "vaccination": {
          const farms = await api.get("/api/v1/farms");
          if (!farms?.length) { speak(lang === "en" ? "You don't have any farms yet." : "", lang); break; }
          const summary = await api.get(`/api/v1/farms/${farms[0].id}/herd-summary`);
          const pct = summary.vaccination_coverage_pct;
          speak(lang === "en" ? `${pct} percent of your animals are vaccinated.` : lang === "hi" ? `आपके ${pct} प्रतिशत जानवर टीकाकृत हैं।` : `तुमच्या ${pct} टक्के जनावरांचे लसीकरण झाले आहे.`, lang);
          break;
        }
        case "advice": {
          const cases = await api.get("/api/v1/reports");
          speak(lang === "en" ? "Please open your latest report to see the recommended action." : lang === "hi" ? "अनुशंसित कार्रवाई देखने के लिए कृपया अपनी नवीनतम रिपोर्ट खोलें।" : "शिफारस केलेली कृती पाहण्यासाठी कृपया तुमचा नवीनतम अहवाल उघडा.", lang);
          router.push("/farmer/cases");
          break;
        }
        case "call_vet":
          speak(lang === "en" ? "Please use the contact number on your case page to reach your veterinarian." : lang === "hi" ? "अपने पशु चिकित्सक से संपर्क करने के लिए कृपया अपने केस पेज पर दिए गए नंबर का उपयोग करें।" : "तुमच्या पशुवैद्याशी संपर्क साधण्यासाठी कृपया तुमच्या केस पेजवरील क्रमांक वापरा.", lang);
          router.push("/farmer/cases");
          break;
        default:
          speak(LABELS[lang].noMatch, lang);
      }
    } catch {
      speak(lang === "en" ? "Something went wrong. Please try again." : lang === "hi" ? "कुछ गलत हो गया। कृपया पुनः प्रयास करें।" : "काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.", lang);
    }
  }

  if (!recognitionSupported && !synthesisSupported) return null; // no fake voice UI on unsupported devices

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-white rounded-xl border shadow-lg p-4 w-72 mb-1" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Voice assistant</span>
            <div className="flex gap-1">
              {(Object.keys(LABELS) as VoiceLang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={l === lang ? { background: "var(--brand)", color: "#fff" } : { background: "var(--surface-alt)", color: "var(--ink-soft)" }}>
                  {LABELS[l].name}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>{LABELS[lang].help}</p>
          {!recognitionSupported && (
            <p className="text-xs mb-2" style={{ color: "var(--risk-critical)" }}>
              Voice input isn't supported on this browser/device — try Chrome on Android, or use the app normally.
            </p>
          )}
          {status && <p className="text-xs italic mb-2" style={{ color: "var(--ink)" }}>"{status}"</p>}
          {recognitionSupported && (
            <button
              onClick={() => (listening ? stop() : start((t) => handleTranscript(t)))}
              className="w-full rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: listening ? "var(--risk-critical)" : "var(--brand)" }}
            >
              {listening ? "Listening… tap to stop" : "Tap to speak"}
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Voice assistant"
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl"
        style={{ background: "var(--brand)" }}
      >
        🎙
      </button>
    </div>
  );
}
