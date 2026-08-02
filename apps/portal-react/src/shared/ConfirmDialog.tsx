export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="confirm-dialog"
      >
        <h2 className="dialog__title">{title}</h2>
        {message ? <p className="dialog__message">{message}</p> : null}
        <div className="dialog__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={onCancel}
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={busy}
            onClick={onConfirm}
            data-testid="confirm-accept"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
