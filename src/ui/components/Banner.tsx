import type { ReactNode } from "react";

export type BannerKind = "info" | "warning" | "error";
const LABEL: Record<BannerKind, string> = { info: "Info", warning: "Warning", error: "Error" };

/** The kind is also stated in text, so meaning never rests on colour alone. */
export default function Banner({
  kind,
  children,
  action,
}: {
  kind: BannerKind;
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`banner banner-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div>
        <strong>{LABEL[kind]}.</strong> {children}
      </div>
      {action && (
        <button type="button" className="btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
