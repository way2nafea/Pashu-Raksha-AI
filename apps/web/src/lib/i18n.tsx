"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type Language = "en" | "hi" | "mr";

export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
];

const translations: Record<Language, Record<string, string>> = {
  en: {},
  hi: {
    "Sign in": "साइन इन करें", "Create account": "खाता बनाएं", "Access your role-specific portal.": "अपने भूमिका-विशिष्ट पोर्टल तक पहुंचें।",
    "Full name": "पूरा नाम", "Email": "ईमेल", "Password": "पासवर्ड", "Phone": "फोन", "District": "जिला",
    "Signing in…": "साइन इन हो रहा है…", "Creating account…": "खाता बनाया जा रहा है…", "Create your account": "अपना खाता बनाएं",
    "My Home": "मेरा होम", "My Farms": "मेरे खेत", "Report Symptoms": "लक्षण रिपोर्ट करें", "My Reports": "मेरी रिपोर्ट", "Alerts": "अलर्ट",
    "My Tasks": "मेरे कार्य", "Case Queue": "केस कतार", "Farms": "खेत", "Sample Queue": "नमूना कतार", "Overview": "अवलोकन", "Case List": "केस सूची", "GIS Risk Map": "GIS जोखिम मानचित्र", "Users": "उपयोगकर्ता", "Audit Log": "ऑडिट लॉग", "Sign out": "साइन आउट", "Open menu": "मेनू खोलें",
    "Online": "ऑनलाइन", "Offline": "ऑफलाइन", "Syncing…": "सिंक हो रहा है…", "Pending sync": "सिंक लंबित", "Saved offline": "ऑफलाइन सहेजा गया",
    "Welcome back": "वापसी पर स्वागत है", "Reports Submitted": "जमा की गई रिपोर्ट", "Active Alerts": "सक्रिय अलर्ट", "Recent Reports": "हाल की रिपोर्ट",
    "Notice unusual symptoms in your animal?": "क्या आपके पशु में असामान्य लक्षण हैं?", "Report it now": "अभी रिपोर्ट करें",
    "Add Farm": "खेत जोड़ें", "Save Farm": "खेत सहेजें", "Register Animal": "पशु पंजीकृत करें", "Save Animal": "पशु सहेजें", "Farm Name": "खेत का नाम", "Village": "गांव", "Block/Taluka": "ब्लॉक/तालुका", "Livestock Count": "पशुधन संख्या", "Animals": "पशु", "Affected": "प्रभावित", "Active cases": "सक्रिय केस", "Vaccinated": "टीकाकरण हुआ", "Herd risk": "झुंड जोखिम", "Insufficient data": "अपर्याप्त डेटा", "Species": "प्रजाति", "Breed": "नस्ल", "Age (months)": "आयु (महीने)", "Sex": "लिंग", "Female": "मादा", "Male": "नर", "No animals registered yet": "अभी कोई पशु पंजीकृत नहीं है", "No farms yet": "अभी कोई खेत नहीं है",
    "Report Health Issue": "स्वास्थ्य समस्या रिपोर्ट करें", "Animal": "पशु", "Symptoms": "लक्षण", "Severity": "गंभीरता", "Location": "स्थान", "Review": "समीक्षा", "Select a farm…": "खेत चुनें…", "Select an animal…": "पशु चुनें…", "Select all symptoms observed": "देखे गए सभी लक्षण चुनें", "Unknown": "अज्ञात", "Unvaccinated": "टीकाकरण नहीं हुआ", "Use my current location": "मेरा वर्तमान स्थान उपयोग करें", "Latitude": "अक्षांश", "Longitude": "देशांतर", "Additional notes": "अतिरिक्त टिप्पणियां", "Photo (optional evidence)": "फोटो (वैकल्पिक प्रमाण)", "Back": "वापस", "Next": "अगला", "Submit Report": "रिपोर्ट जमा करें",
    "Fever": "बुखार", "Reduced appetite": "भूख कम होना", "Lethargy / weakness": "सुस्ती / कमजोरी", "Nasal discharge": "नाक से स्राव", "Coughing": "खांसी", "Diarrhea": "दस्त", "Swelling": "सूजन", "Difficulty breathing": "सांस लेने में कठिनाई", "Sudden death in herd": "झुंड में अचानक मृत्यु",
    "Report Submitted": "रिपोर्ट जमा हो गई", "AI-Assisted Risk Assessment": "AI-सहायता प्राप्त जोखिम आकलन", "Potential Outbreak Cluster Detected": "संभावित प्रकोप समूह का पता चला", "Submit Another Report": "एक और रिपोर्ट जमा करें", "Nearby similar case(s) detected": "पास में समान केस मिले",
    "Loading…": "लोड हो रहा है…", "Cancel": "रद्द करें", "Save": "सहेजें", "Open": "खोलें", "Acknowledge": "स्वीकार करें", "Failed": "विफल",
    "Laboratory Sample Queue": "प्रयोगशाला नमूना कतार", "Enter result…": "परिणाम दर्ज करें…", "Save Result": "परिणाम सहेजें", "Mark as…": "इस रूप में चिह्नित करें",
    "Government of Maharashtra": "महाराष्ट्र सरकार", "Livestock Disease Surveillance": "पशु रोग निगरानी", "Total Farms": "कुल खेत", "Total Animals": "कुल पशु", "Active Cases": "सक्रिय केस", "Active Outbreaks": "सक्रिय प्रकोप", "High Risk": "उच्च जोखिम", "Critical": "गंभीर", "Resolved": "समाधान किया गया", "Total Mortality": "कुल मृत्यु दर", "Vaccination Coverage": "टीकाकरण कवरेज", "Case Trend": "केस प्रवृत्ति", "Risk Distribution": "जोखिम वितरण", "Species Distribution": "प्रजाति वितरण",
    "All": "सभी", "All Risk Levels": "सभी जोखिम स्तर", "Outbreak Cluster": "प्रकोप समूह", "Risk": "जोखिम", "Status": "स्थिति", "Weather": "मौसम", "Voice assistant": "वॉयस सहायक",
    "Email or password is incorrect. Please check and try again.": "ईमेल या पासवर्ड गलत है। कृपया जांच कर फिर प्रयास करें।",
    "Please enter a valid email address, such as name@example.com.": "कृपया सही ईमेल पता दर्ज करें, जैसे name@example.com।",
    "Please enter a password with at least 6 characters.": "कृपया कम से कम 6 अक्षरों का पासवर्ड दर्ज करें।",
    "Please enter your full name.": "कृपया अपना पूरा नाम दर्ज करें।",
    "Please check the highlighted information and try again.": "कृपया चिह्नित जानकारी जांच कर फिर प्रयास करें।",
    "This email is already registered. Please use another email or sign in.": "यह ईमेल पहले से पंजीकृत है। दूसरा ईमेल उपयोग करें या साइन इन करें।",
    "The server could not be reached. Please check your connection and try again.": "सर्वर से संपर्क नहीं हो सका। कृपया अपना इंटरनेट कनेक्शन जांच कर फिर प्रयास करें।",
    "You do not have permission to perform this action.": "आपको यह कार्य करने की अनुमति नहीं है।",
    "Passwords do not match. Please re-enter the same password.": "पासवर्ड मेल नहीं खाते। कृपया वही पासवर्ड फिर दर्ज करें।",
    "Please check the entered information and try again.": "कृपया दर्ज की गई जानकारी जांच कर फिर प्रयास करें।",
    "Something went wrong. Please check your information and try again.": "कुछ गलत हुआ। कृपया अपनी जानकारी जांच कर फिर प्रयास करें।",
  },
  mr: {
    "Sign in": "साइन इन करा", "Create account": "खाते तयार करा", "Access your role-specific portal.": "तुमच्या भूमिकेनुसार पोर्टलवर प्रवेश करा.",
    "Full name": "पूर्ण नाव", "Email": "ईमेल", "Password": "पासवर्ड", "Phone": "फोन", "District": "जिल्हा", "Signing in…": "साइन इन होत आहे…", "Creating account…": "खाते तयार होत आहे…", "Create your account": "तुमचे खाते तयार करा",
    "My Home": "माझे होम", "My Farms": "माझी शेतजमीन", "Report Symptoms": "लक्षणे नोंदवा", "My Reports": "माझे अहवाल", "Alerts": "सूचना", "My Tasks": "माझी कामे", "Case Queue": "केस रांग", "Farms": "शेतजमीन", "Sample Queue": "नमुना रांग", "Overview": "आढावा", "Case List": "केस यादी", "GIS Risk Map": "GIS जोखीम नकाशा", "Users": "वापरकर्ते", "Audit Log": "ऑडिट लॉग", "Sign out": "साइन आउट", "Open menu": "मेनू उघडा",
    "Online": "ऑनलाइन", "Offline": "ऑफलाइन", "Syncing…": "सिंक होत आहे…", "Pending sync": "सिंक प्रलंबित", "Saved offline": "ऑफलाइन जतन केले",
    "Welcome back": "पुन्हा स्वागत आहे", "Reports Submitted": "सादर केलेले अहवाल", "Active Alerts": "सक्रिय सूचना", "Recent Reports": "अलीकडील अहवाल", "Notice unusual symptoms in your animal?": "तुमच्या जनावरात असामान्य लक्षणे आहेत का?", "Report it now": "आता नोंदवा",
    "Add Farm": "शेतजमीन जोडा", "Save Farm": "शेतजमीन जतन करा", "Register Animal": "जनावराची नोंदणी करा", "Save Animal": "जनावर जतन करा", "Farm Name": "शेताचे नाव", "Village": "गाव", "Block/Taluka": "ब्लॉक/तालुका", "Livestock Count": "पशुधन संख्या", "Animals": "जनावरे", "Affected": "बाधित", "Active cases": "सक्रिय केस", "Vaccinated": "लसीकरण झालेले", "Herd risk": "कळप जोखीम", "Insufficient data": "अपुरा डेटा", "Species": "प्रजाती", "Breed": "जात", "Age (months)": "वय (महिने)", "Sex": "लिंग", "Female": "मादी", "Male": "नर", "No animals registered yet": "अद्याप कोणत्याही जनावराची नोंद नाही", "No farms yet": "अद्याप कोणतीही शेतजमीन नाही",
    "Report Health Issue": "आरोग्य समस्या नोंदवा", "Animal": "जनावर", "Symptoms": "लक्षणे", "Severity": "तीव्रता", "Location": "स्थान", "Review": "पुनरावलोकन", "Select a farm…": "शेतजमीन निवडा…", "Select an animal…": "जनावर निवडा…", "Select all symptoms observed": "दिसलेली सर्व लक्षणे निवडा", "Unknown": "अज्ञात", "Unvaccinated": "लसीकरण न झालेले", "Use my current location": "माझे सध्याचे स्थान वापरा", "Latitude": "अक्षांश", "Longitude": "रेखांश", "Additional notes": "अतिरिक्त नोंदी", "Photo (optional evidence)": "फोटो (पर्यायी पुरावा)", "Back": "मागे", "Next": "पुढे", "Submit Report": "अहवाल सादर करा",
    "Fever": "ताप", "Reduced appetite": "भूक कमी होणे", "Lethargy / weakness": "सुस्ती / अशक्तपणा", "Nasal discharge": "नाकातून स्राव", "Coughing": "खोकला", "Diarrhea": "अतिसार", "Swelling": "सूज", "Difficulty breathing": "श्वास घेण्यास त्रास", "Sudden death in herd": "कळपात अचानक मृत्यू",
    "Report Submitted": "अहवाल सादर झाला", "AI-Assisted Risk Assessment": "AI-सहाय्यित जोखीम मूल्यांकन", "Potential Outbreak Cluster Detected": "संभाव्य उद्रेक समूह आढळला", "Submit Another Report": "दुसरा अहवाल सादर करा", "Nearby similar case(s) detected": "जवळचे समान केस आढळले", "Loading…": "लोड होत आहे…", "Cancel": "रद्द करा", "Save": "जतन करा", "Open": "उघडा", "Acknowledge": "मान्य करा", "Failed": "अयशस्वी",
    "Email or password is incorrect. Please check and try again.": "ईमेल किंवा पासवर्ड चुकीचा आहे. कृपया तपासून पुन्हा प्रयत्न करा.",
    "Please enter a valid email address, such as name@example.com.": "कृपया योग्य ईमेल पत्ता नोंदवा, उदा. name@example.com.",
    "Please enter a password with at least 6 characters.": "कृपया किमान ६ अक्षरांचा पासवर्ड नोंदवा.",
    "Please enter your full name.": "कृपया तुमचे पूर्ण नाव नोंदवा.",
    "Please check the highlighted information and try again.": "कृपया चिन्हांकित माहिती तपासून पुन्हा प्रयत्न करा.",
    "This email is already registered. Please use another email or sign in.": "हा ईमेल आधीच नोंदणीकृत आहे. दुसरा ईमेल वापरा किंवा साइन इन करा.",
    "The server could not be reached. Please check your connection and try again.": "सर्व्हरशी संपर्क होऊ शकला नाही. कृपया इंटरनेट कनेक्शन तपासून पुन्हा प्रयत्न करा.",
    "You do not have permission to perform this action.": "तुम्हाला हे कार्य करण्याची परवानगी नाही.",
    "Passwords do not match. Please re-enter the same password.": "पासवर्ड जुळत नाहीत. कृपया तोच पासवर्ड पुन्हा नोंदवा.",
    "Please check the entered information and try again.": "कृपया नोंदवलेली माहिती तपासून पुन्हा प्रयत्न करा.",
    "Something went wrong. Please check your information and try again.": "काहीतरी चूक झाली. कृपया तुमची माहिती तपासून पुन्हा प्रयत्न करा.",
    "Laboratory Sample Queue": "प्रयोगशाळा नमुना रांग", "Enter result…": "निकाल नोंदवा…", "Save Result": "निकाल जतन करा", "Mark as…": "असे चिन्हांकित करा", "Government of Maharashtra": "महाराष्ट्र शासन", "Livestock Disease Surveillance": "पशुरोग निरीक्षण", "Total Farms": "एकूण शेतजमिनी", "Total Animals": "एकूण जनावरे", "Active Cases": "सक्रिय केस", "Active Outbreaks": "सक्रिय उद्रेक", "High Risk": "उच्च जोखीम", "Critical": "गंभीर", "Resolved": "निराकरण झाले", "Total Mortality": "एकूण मृत्यू", "Vaccination Coverage": "लसीकरण कव्हरेज", "Case Trend": "केस कल", "Risk Distribution": "जोखीम वितरण", "Species Distribution": "प्रजाती वितरण", "All": "सर्व", "All Risk Levels": "सर्व जोखीम पातळ्या", "Outbreak Cluster": "उद्रेक समूह", "Risk": "जोखीम", "Status": "स्थिती", "Weather": "हवामान", "Voice assistant": "आवाज सहाय्यक",
  },
};

const localeFor: Record<Language, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

type I18nContextValue = { language: Language; setLanguage: (language: Language) => void; t: (value: string) => string; locale: string };
const I18nContext = createContext<I18nContextValue | null>(null);

function translateDom(language: Language, originals: Map<Text, string>) {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const dictionary = translations[language];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (!originals.has(textNode)) originals.set(textNode, textNode.nodeValue || "");
    const original = originals.get(textNode) || "";
    const trimmed = original.trim();
    if (!trimmed || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(textNode.parentElement?.tagName || "")) continue;
    textNode.nodeValue = original;
    const translated = dictionary[trimmed];
    if (translated) textNode.nodeValue = original.replace(trimmed, translated);
  }
  document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]").forEach((element) => {
    (["placeholder", "aria-label", "title"] as const).forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value && dictionary[value]) element.setAttribute(attribute, dictionary[value]);
    });
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const originals = useRef(new Map<Text, string>());

  useEffect(() => {
    const stored = localStorage.getItem("pr_language") as Language | null;
    if (stored && stored in translations) setLanguageState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    translateDom("en", originals.current);
    translateDom(language, originals.current);
    const observer = new MutationObserver(() => translateDom(language, originals.current));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  function setLanguage(next: Language) {
    localStorage.setItem("pr_language", next);
    setLanguageState(next);
  }

  return <I18nContext.Provider value={{ language, setLanguage, locale: localeFor[language], t: (value) => translations[language][value] || value }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useI18n();
  return (
    <div className={`flex items-center gap-1 ${compact ? "text-[11px]" : "text-xs"}`} aria-label="Language">
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLanguage(option.code)}
          aria-pressed={language === option.code}
          className={`px-2 py-1 rounded-md transition-colors ${language === option.code ? "font-semibold" : "opacity-70 hover:opacity-100"}`}
          style={language === option.code ? { background: "var(--gold-light)", color: "var(--brand-dark)" } : undefined}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
