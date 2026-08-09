export interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div className="spinner" role="status" aria-live="polite" data-testid="loading-spinner">
      <span className="spinner__dot" />
      <span className="spinner__text">{message}</span>
    </div>
  );
}
