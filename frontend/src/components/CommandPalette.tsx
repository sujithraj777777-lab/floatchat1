import { useEffect, useState } from "react";

type ActionItem = {
  id: string;
  title: string;
  category: "Tab View" | "Float Action" | "Dataset";
  shortcut?: string;
  onSelect: () => void;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionItem[];
};

export default function CommandPalette({ isOpen, onClose, actions }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = actions.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "100px",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card-base)",
          border: "1px solid var(--bg-card-border)",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--bg-card-border)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "var(--accent-blue)", fontWeight: "700" }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, float ID (e.g. 6902746), or view tab..."
            autoFocus
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              color: "var(--text-main)",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <kbd style={{ background: "var(--bg-dark)", border: "1px solid var(--bg-card-border)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", color: "var(--text-muted)" }}>
            ESC
          </kbd>
        </div>

        <div style={{ maxHeight: "350px", overflowY: "auto", padding: "8px" }}>
          {filtered.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "14px", textAlign: "center", margin: 0 }}>
              No matching commands or floats found.
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <span style={{ color: "var(--text-main)", fontWeight: "600" }}>{item.title}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px", marginLeft: "10px", textTransform: "uppercase" }}>
                    [{item.category}]
                  </span>
                </div>
                {item.shortcut && (
                  <span style={{ fontSize: "11px", color: "var(--accent-blue)", fontFamily: "JetBrains Mono, monospace" }}>
                    {item.shortcut}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
