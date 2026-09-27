"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import ConnectivityBadge from "@/components/ConnectivityBadge";
import VoiceAssistant from "@/components/VoiceAssistant";
import { LanguageSwitcher } from "@/lib/i18n";

const NAV: Record<string, { href: string; label: string }[]> = {
  FARMER: [
    { href: "/farmer", label: "My Home" },
    { href: "/farmer/farms", label: "My Farms" },
    { href: "/farmer/report", label: "Report Symptoms" },
    { href: "/farmer/cases", label: "My Reports" },
    { href: "/farmer/alerts", label: "Alerts" },
  ],
  FIELD_WORKER: [
    { href: "/field-worker", label: "My Tasks" },
    { href: "/vet", label: "Case Queue" },
    { href: "/farmer/farms", label: "Farms" },
  ],
  VETERINARIAN: [
    { href: "/vet", label: "Case Queue" },
    { href: "/vet/alerts", label: "Alerts" },
  ],
  LAB_STAFF: [{ href: "/lab", label: "Sample Queue" }],
  DISTRICT_ADMIN: [
    { href: "/gov", label: "Overview" },
    { href: "/gov/cases", label: "Case List" },
    { href: "/gov/map", label: "GIS Risk Map" },
  ],
  STATE_ADMIN: [
    { href: "/gov", label: "Overview" },
    { href: "/gov/cases", label: "Case List" },
    { href: "/gov/map", label: "GIS Risk Map" },
    { href: "/admin/users", label: "Users" },
  ],
  SUPER_ADMIN: [
    { href: "/gov", label: "Overview" },
    { href: "/gov/cases", label: "Case List" },
    { href: "/gov/map", label: "GIS Risk Map" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/audit", label: "Audit Log" },
  ],
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const items = user ? NAV[user.role] || [] : [];

  return (
    <>
      <div>
        <Link href="/" className="block mb-8" onClick={onNavigate}>
          <div className="font-display text-lg leading-tight">PASHU-RAKSHAK</div>
          <div className="text-[10px] tracking-[0.2em] opacity-70">AI SURVEILLANCE</div>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-white/15 font-semibold" : "hover:bg-white/10 opacity-90"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="text-xs opacity-80 border-t border-white/10 pt-4">
        <LanguageSwitcher compact />
        <div className="font-semibold">{user?.name}</div>
        <div className="opacity-70">{user?.role.replace("_", " ")}</div>
        <button onClick={logout} className="mt-3 underline underline-offset-2 hover:opacity-100 opacity-80">
          Sign out
        </button>
      </div>
    </>
  );
}

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-60 shrink-0 flex-col justify-between p-5"
        style={{ background: "var(--brand-dark)", color: "#fff" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: "var(--brand-dark)", color: "#fff" }}
      >
        <button
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/10 -ml-2"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className="font-display text-base">PASHU-RAKSHAK</div>
        <ConnectivityBadge compact />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside
            className="relative w-72 max-w-[80%] flex flex-col justify-between p-5"
            style={{ background: "var(--brand-dark)", color: "#fff" }}
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 p-4 pt-16 md:pt-8 md:p-8 overflow-x-hidden min-w-0">
        <div className="hidden md:flex justify-end mb-2">
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ConnectivityBadge />
          </div>
        </div>
        {children}
      </main>
      {user?.role === "FARMER" && <VoiceAssistant />}
    </div>
  );
}
