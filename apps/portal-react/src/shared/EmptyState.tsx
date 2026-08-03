export interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string | null;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Nothing here yet',
  message = '',
  actionLabel = null,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <h3 className="empty-state__title">{title}</h3>
      {message ? <p className="empty-state__message">{message}</p> : null}
      {actionLabel ? (
        <button
          type="button"
          className="button button--primary"
          onClick={() => onAction?.()}
          data-testid="empty-state-action"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
