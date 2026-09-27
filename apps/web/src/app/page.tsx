"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { LanguageSwitcher } from "@/lib/i18n";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void;
        };
      };
    };
  }
}

const ROLE_HOME: Record<string, string> = {
  FARMER: "/farmer",
  FIELD_WORKER: "/field-worker",
  VETERINARIAN: "/vet",
  LAB_STAFF: "/lab",
  DISTRICT_ADMIN: "/gov",
  STATE_ADMIN: "/gov",
  SUPER_ADMIN: "/admin/users",
};

export default function LandingPage() {
  const { login, register, googleLogin } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (mode !== "signin" || !googleClientId || !googleReady || !googleButtonRef.current || !window.google?.accounts?.id) return;
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: { credential: string }) => {
        setError("");
        setBusy(true);
        try {
          const user = await googleLogin(response.credential);
          router.push(ROLE_HOME[user?.role || ""] || "/farmer");
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Google sign-in could not be completed.");
        } finally {
          setBusy(false);
        }
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 380, text: "signin_with" });
  }, [mode, googleClientId, googleReady, googleLogin, router]);

  if (!mounted) return null;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      router.push(ROLE_HOME[user?.role || ""] || "/farmer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter the same password.");
      return;
    }
    setBusy(true);
    try {
      const user = await register(name, email, password, phone, district);
      router.push(ROLE_HOME[user?.role || ""] || "/farmer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2" style={{ background: "var(--bg)" }}>
      {/* Left: brand / story panel */}
      <div
        className="hidden md:flex flex-col justify-between p-12 text-white relative overflow-hidden"
        style={{ background: "var(--brand-dark)" }}
      >
        <div>
          <div className="text-[10px] tracking-[0.3em] opacity-70 mb-2">
            SMART INDIA HACKATHON 2026 · PS 26128
          </div>
          <h1 className="font-display text-4xl leading-tight mb-4">
            PASHU-RAKSHAK<br />AI
          </h1>
          <p className="text-lg opacity-90 max-w-sm">
            Detect Early <span className="opacity-50">·</span> Respond Faster <span className="opacity-50">·</span> Protect Livestock
          </p>
        </div>

        <div className="space-y-4 text-sm opacity-90">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-display">1</span>
            Farmer reports symptoms with location & photo
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-display">2</span>
            AI risk engine triages and flags outbreaks nearby
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-display">3</span>
            Veterinarians, labs & government respond in one system
          </div>
        </div>

        <div className="text-xs opacity-50 border-t border-white/10 pt-4">
          Government of Maharashtra · Agriculture, FoodTech & Rural Development
        </div>
      </div>

      {/* Right: sign in / register */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>
          <div className="md:hidden mb-8">
            <h1 className="font-display text-3xl" style={{ color: "var(--brand-dark)" }}>PASHU-RAKSHAK AI</h1>
          </div>

          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--surface-alt)" }}>
            <button
              onClick={() => { setMode("signin"); setError(""); }}
              className="flex-1 text-sm font-semibold py-2 rounded-md transition-colors"
              style={mode === "signin" ? { background: "white", color: "var(--brand-dark)" } : { color: "var(--ink-soft)" }}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className="flex-1 text-sm font-semibold py-2 rounded-md transition-colors"
              style={mode === "register" ? { background: "white", color: "var(--brand-dark)" } : { color: "var(--ink-soft)" }}
            >
              Create account
            </button>
          </div>

          {mode === "signin" ? (
            <div key="signin">
              <h2 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>Sign in</h2>
              <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>Access your role-specific portal.</p>

              <form onSubmit={handleSignIn} className="space-y-4">
                <Field label="Email">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                <Field label="Password">
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                {error && <p className="text-sm" style={{ color: "var(--risk-critical)" }}>{error}</p>}
                <button type="submit" disabled={busy}
                  className="w-full rounded-lg py-2.5 font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "var(--brand)" }}>
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <p className="text-xs leading-relaxed text-center mt-3" style={{ color: "var(--ink-soft)" }}>
                  Farmers can create an account. Staff, Veterinarians, Lab Personnel and Government Administrators use their provisioned credentials to sign in.
                </p>
                {googleClientId && <><div className="flex items-center gap-3 my-4"><div className="h-px flex-1" style={{ background: "var(--border)" }} /><span className="text-xs" style={{ color: "var(--ink-soft)" }}>or</span><div className="h-px flex-1" style={{ background: "var(--border)" }} /></div><div ref={googleButtonRef} className="flex justify-center" /></>}
              </form>
            </div>
          ) : (
            <div key="register">
              <h2 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>Create your account</h2>
              <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>Public registration creates Farmer accounts only. Field Workers, Veterinarians, Lab Staff, and Administrators use provisioned credentials to sign in.</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="Full name">
                  <input required pattern="[\u0020\p{L}0-9_]+" title="Use letters, numbers, spaces, or underscores." value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                <Field label="Email">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                <Field label="Password">
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                <Field label="Confirm password">
                  <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                  </Field>
                  <Field label="District">
                    <input value={district} onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 bg-white outline-none focus:ring-2" style={{ borderColor: "var(--border)" }} />
                  </Field>
                </div>
                {error && <p className="text-sm" style={{ color: "var(--risk-critical)" }}>{error}</p>}
                <button type="submit" disabled={busy}
                  className="w-full rounded-lg py-2.5 font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "var(--brand)" }}>
                  {busy ? "Creating account…" : "Create account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleReady(true)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
