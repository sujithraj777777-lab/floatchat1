type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

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
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card-base)",
          border: "1px solid var(--bg-card-border)",
          borderRadius: "12px",
          maxWidth: "450px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <h3 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "17px" }}>
          {title}
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.5", margin: "0 0 20px 0" }}>
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "var(--bg-dark)",
              color: "var(--text-muted)",
              border: "1px solid var(--bg-card-border)",
              padding: "8px 16px",
              fontSize: "12px",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "8px 16px",
              fontSize: "12px",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
