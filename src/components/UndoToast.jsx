import { useEffect, useState } from "react";

export default function UndoToast({ toast, onDismiss }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration || 6000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <aside
      className="undo-toast"
      role="status"
      aria-live="polite"
      style={{ overflow: "hidden", position: "fixed", bottom: 24, right: 24, zIndex: 120 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
          {toast.message}
        </span>

        {toast.undoAction && (
          <button
            type="button"
            className="undo-btn"
            onClick={() => {
              toast.undoAction();
              onDismiss();
            }}
          >
            Undo
          </button>
        )}

        {toast.viewAction && (
          <button
            type="button"
            className="undo-btn"
            style={{ background: "var(--up)", color: "#0b0f19", fontWeight: 700 }}
            onClick={() => {
              toast.viewAction();
              onDismiss();
            }}
          >
            View
          </button>
        )}

        <button
          type="button"
          className="link"
          style={{ fontSize: "0.95rem", color: "var(--mute)", cursor: "pointer", padding: "2px 4px" }}
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>

      <div
        className="toast-progress-bar"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "3px",
          width: `${progress}%`,
          background: toast.viewAction ? "var(--up)" : "var(--accent)",
          transition: "width 50ms linear",
        }}
      />
    </aside>
  );
}
