import { useState } from "react";
import Banner from "./Banner";

/** Session-only dismissal: storing it would add to what the notice says is stored. */
export default function PrivacyNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Banner kind="info" action={{ label: "Dismiss", onClick: () => setOpen(false) }}>
      Your data stays in this browser: files are read on your device and never uploaded. Only your
      assumptions and theme choice are saved, in this browser&apos;s storage.
    </Banner>
  );
}
