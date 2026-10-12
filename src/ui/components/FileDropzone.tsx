import { useRef, useState, type DragEvent } from "react";

interface Props {
  label: string;
  maxBytes: number;
  oversizeMessage: string;
  /** Called with the file text once read. */
  onText: (text: string, fileName: string) => void;
  /** Called instead of reading when the file is too large. */
  onReject: (message: string, fileName: string) => void;
  /** Outcome of the latest import from this dropzone, for the status line. */
  status?: "success" | "error";
}

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`);

export default function FileDropzone({
  label,
  maxBytes,
  oversizeMessage,
  onText,
  onReject,
  status,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);

  const handle = async (f: File | undefined) => {
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    if (f.size > maxBytes) return onReject(oversizeMessage, f.name);
    setParsing(true);
    try {
      onText(await f.text(), f.name);
    } finally {
      setParsing(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`dropzone${dragging ? " dropzone-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div>{label}</div>
      <button
        type="button"
        className="btn"
        onClick={() => input.current?.click()}
        disabled={parsing}
      >
        Choose file
        <span className="sr-only"> for {label}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        data-testid={`file-${label}`}
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = ""; // allow choosing the same file again
        }}
      />
      <div className="dropzone-status" role="status">
        {parsing
          ? "Reading file…"
          : file
            ? `${file.name} (${kb(file.size)})${status === "success" ? " — imported" : status === "error" ? " — not imported" : ""}`
            : "or drop a .csv file here"}
      </div>
    </div>
  );
}
