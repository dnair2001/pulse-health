import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlertBanner } from './AlertBanner';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('defaults to the generic label', () => {
    render(<LoadingSpinner />);

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading…');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the message it is given', () => {
    render(<LoadingSpinner message="Loading providers…" />);

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading providers…');
  });
});

describe('AlertBanner', () => {
  it('uses the alert role and the error class for the error variant', () => {
    render(<AlertBanner variant="error" message="We could not find that provider." />);

    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveClass('alert', 'alert--error');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('data-variant', 'error');
    expect(banner).toHaveTextContent('We could not find that provider.');
  });

  it('uses the status role for non-error variants', () => {
    render(<AlertBanner variant="info" message="Heads up." />);

    expect(screen.getByTestId('alert-banner')).toHaveAttribute('role', 'status');
  });

  it('calls onDismiss when the dismiss button is used', async () => {
    const onDismiss = vi.fn();
    render(<AlertBanner message="Dismiss me." onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('omits the dismiss button when not dismissible', () => {
    render(<AlertBanner message="Sticky." dismissible={false} />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the title and message', () => {
    render(<EmptyState title="No providers match your search" message="Try a different name." />);

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No providers match your search');
    expect(screen.getByTestId('empty-state')).toHaveTextContent('Try a different name.');
  });

  it('omits the message and action when neither is supplied', () => {
    render(<EmptyState />);

    expect(screen.getByTestId('empty-state')).toHaveTextContent('Nothing here yet');
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('reports the action when an action label is supplied', async () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Reset" onAction={onAction} />);

    await userEvent.click(screen.getByTestId('empty-state-action'));

    expect(onAction).toHaveBeenCalledOnce();
  });
});
