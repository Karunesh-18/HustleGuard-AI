"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import {
  BarChartIcon, MapPinIcon, LayersIcon, ActivityIcon,
  ShieldIcon, LogOutIcon, SmartphoneIcon, LockIcon,
} from "@/components/Icon";

// PIN is read from env var at check time — see push() below
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "2026";

const NAV = [
  { href: "/admin",        icon: BarChartIcon, label: "Overview" },
  { href: "/admin/zones",  icon: MapPinIcon,   label: "Zones" },
  { href: "/admin/claims", icon: LayersIcon,   label: "Claims & Fraud" },
  { href: "/admin/ml",     icon: ActivityIcon, label: "ML Models" },
] as const;

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);

  const push = (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        setTimeout(onSuccess, 200);
      } else {
        setTimeout(() => { setDigits(""); setError(true); }, 300);
        setTimeout(() => setError(false), 900);
      }
    }
  };

  return (
    <div className="pin-screen">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <LockIcon size={28} color="white" />
        </div>
      </div>
      <div className="display-sm" style={{ marginBottom: 4 }}>Admin Access</div>
      <div className="body-md" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>Enter PIN to continue</div>

      <div className="pin-dots">
        {[0,1,2,3].map((i) => (
          <div key={i} className={`pin-dot ${i < digits.length ? "filled" : ""}`}
            style={{ borderColor: error ? "var(--danger)" : undefined }} />
        ))}
      </div>

      {error && <div className="body-sm" style={{ color: "var(--danger)", marginBottom: 8 }}>Incorrect PIN</div>}

      <div className="pin-grid">
        {["1","2","3","4","5","6","7","8","9","","0","←"].map((k, i) => (
          k === "" ? <div key={i} /> : (
            <button key={i} className="pin-key btn" type="button"
              onClick={() => k === "←" ? setDigits((p) => p.slice(0,-1)) : push(k)}
            >
              {k}
            </button>
          )
        ))}
      </div>

      <div className="body-sm" style={{ color: "var(--text-tertiary)", marginTop: 24, fontStyle: "italic" }}>
        Contact your administrator for access
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(sessionStorage.getItem("hg_admin_auth") === "1");
  }, []);

  const handleAuth = () => {
    sessionStorage.setItem("hg_admin_auth", "1");
    setAuthed(true);
  };

  if (authed === null) return null;
  if (!authed) return <PinScreen onSuccess={handleAuth} />;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <ShieldIcon size={18} color="var(--brand-light)" />
            <span className="display-sm" style={{ fontSize: "0.9375rem" }}>HustleGuard</span>
          </div>
          <div className="badge badge-brand">Admin Panel</div>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
            return (
              <button
                key={href}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
                onClick={() => router.push(href)}
                type="button"
              >
                <Icon size={17} color={active ? "var(--brand-light)" : "var(--text-tertiary)"} />
                {label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "var(--space-md)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            className="sidebar-nav-item"
            onClick={() => { sessionStorage.removeItem("hg_admin_auth"); setAuthed(false); }}
            type="button"
            style={{ width: "100%", color: "var(--danger)", fontSize: "0.875rem" }}
          >
            <LogOutIcon size={15} color="var(--danger)" /> Sign Out
          </button>
          <button
            className="sidebar-nav-item"
            onClick={() => router.push("/home")}
            type="button"
            style={{ width: "100%", fontSize: "0.875rem" }}
          >
            <SmartphoneIcon size={15} color="var(--text-tertiary)" /> Rider View
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
