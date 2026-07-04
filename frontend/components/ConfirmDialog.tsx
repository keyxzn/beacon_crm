"use client";

export default function ConfirmDialog({
  open, title, message, confirmLabel = "Hapus", danger = true, onConfirm, onCancel, loading = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="t-h3" style={{ marginBottom: 8 }}>{title}</div>
        <p className="t-body" style={{ marginBottom: 20 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={loading}>
            Batal
          </button>
          <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}