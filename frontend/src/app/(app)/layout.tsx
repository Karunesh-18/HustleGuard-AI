"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { HomeIcon, BellIcon, HandIcon, UserIcon } from "@/components/Icon";
import { ShieldIcon } from "@/components/Icon";

const NAV = [
  { href: "/home",    icon: HomeIcon,  label: "Home" },
  { href: "/alerts",  icon: BellIcon,  label: "Alerts" },
  { href: "/claims",  icon: HandIcon,  label: "Claims" },
  { href: "/profile", icon: UserIcon,  label: "Profile" },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="mobile-shell">
      {/* Status Bar */}
      <div className="status-bar">
        <div className="row" style={{ gap: 8 }}>
          <ShieldIcon size={18} color="var(--brand-light)" />
          <span className="display-sm" style={{ fontSize: "0.9375rem", letterSpacing: "-0.01em" }}>HustleGuard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pill pill-normal" style={{ padding: "3px 8px", fontSize: "0.625rem" }}>
            LIVE
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="page-content">
        {children}
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => router.push(href)}
              type="button"
              aria-label={label}
            >
              <span className="nav-icon">
                <Icon size={22} color={active ? "var(--brand-light)" : "var(--text-tertiary)"} />
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
