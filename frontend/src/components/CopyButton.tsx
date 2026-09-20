import { useState } from "react";

type Props = {
  textToCopy: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function CopyButton({ textToCopy, label = "Copy", style }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      style={{
        padding: "4px 10px",
        fontSize: "11px",
        background: copied ? "var(--status-good)" : "var(--bg-dark)",
        color: copied ? "#ffffff" : "var(--text-muted)",
        border: "1px solid var(--bg-card-border)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        ...style,
      }}
    >
      {copied ? "Copied! ✓" : label}
    </button>
  );
}
