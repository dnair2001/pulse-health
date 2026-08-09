export type AlertVariant = 'success' | 'error' | 'info';

export interface AlertBannerProps {
  variant?: AlertVariant;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function AlertBanner({
  variant = 'info',
  message = '',
  dismissible = true,
  onDismiss,
}: AlertBannerProps) {
  return (
    <div
      className={`alert alert--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
      data-variant={variant}
      data-testid="alert-banner"
    >
      <span className="alert__message">{message}</span>
      {dismissible ? (
        <button type="button" className="alert__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  );
}
