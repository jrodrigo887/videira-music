"use client";

type FollowersConfirmDialogProps = {
  open: boolean;
  followerCount: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function FollowersConfirmDialog({
  open,
  followerCount,
  busy = false,
  onConfirm,
  onCancel,
}: FollowersConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const label =
    followerCount === 1
      ? "1 grupo segue este setlist"
      : `${followerCount} grupos seguem este setlist`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="followers-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="ds-card max-w-md space-y-4">
        <h2 id="followers-confirm-title" className="text-lg font-bold text-content">
          Confirmar impacto
        </h2>
        <p className="text-content-muted">{label}. Deseja continuar?</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="ds-button-secondary" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="ds-button" disabled={busy} onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
