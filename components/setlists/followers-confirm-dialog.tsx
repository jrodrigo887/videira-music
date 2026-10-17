"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

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
  const label =
    followerCount === 1
      ? "1 grupo segue este setlist"
      : `${followerCount} grupos seguem este setlist`;

  return (
    <Dialog open={open} title="Confirmar impacto" onClose={onCancel} closeOnOverlay={!busy}>
      <p className="text-content-muted">{label}. Deseja continuar?</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" disabled={busy} onClick={onConfirm}>
          Confirmar
        </Button>
      </div>
    </Dialog>
  );
}
