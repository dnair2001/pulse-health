export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite" data-testid="loading-spinner">
      <span className="spinner__dot" />
      <span className="spinner__text">{label}</span>
    </div>
  );
}
