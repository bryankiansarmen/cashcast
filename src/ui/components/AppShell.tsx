import type { ReactNode } from "react";
import type { Route } from "../use-hash-route";
import { useTheme } from "../use-theme";
import PrivacyNotice from "./PrivacyNotice";

const TABS: { route: Route; label: string }[] = [
  { route: "forecast", label: "Forecast" },
  { route: "budget", label: "Budget" },
];

export default function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <>
      <header className="shell-header">
        <span className="brand">CashCast</span>
        <nav className="tabs" aria-label="Modules">
          {TABS.map((t) => (
            <a
              key={t.route}
              className="tab"
              href={`#/${t.route}`}
              aria-current={route === t.route ? "page" : undefined}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <button type="button" className="btn" onClick={toggle}>
          Switch to {next} theme
        </button>
      </header>
      <main className="content">
        <div className="page">
          <PrivacyNotice />
          {children}
        </div>
      </main>
    </>
  );
}
