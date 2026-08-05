import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AlertBanner } from './AlertBanner';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { StatusBadge } from './StatusBadge';
import {
  formatDayGroupHeading,
  formatFullDateTime,
  formatShortDateTime,
  formatTimeOfDay,
  formatWeekdayDate,
} from './formatDateTime';
import { visitTypeLabel } from './visitTypeLabel';

describe('StatusBadge', () => {
  it('defaults to scheduled and labels each overridden status', () => {
    const { rerender } = render(<StatusBadge />);
    let badge = screen.getByText('Scheduled');
    expect(badge.className).toBe('badge badge--scheduled');
    expect(badge).toHaveAttribute('data-status', 'scheduled');

    for (const [status, label] of [
      ['completed', 'Completed'],
      ['cancelled', 'Cancelled'],
    ] as const) {
      rerender(<StatusBadge status={status} />);
      badge = screen.getByText(label);
      expect(badge.className).toBe(`badge badge--${status}`);
      expect(badge).toHaveAttribute('data-status', status);
    }
  });
});

describe('LoadingSpinner', () => {
  it('shows the default message and the overridden one', () => {
    const { rerender } = render(<LoadingSpinner />);
    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading…');

    rerender(<LoadingSpinner message="Loading available times…" />);
    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading available times…');
  });
});

describe('EmptyState', () => {
  it('renders only the default title when nothing else is supplied', () => {
    render(<EmptyState />);

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state').querySelector('.empty-state__message')).toBeNull();
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('renders the overridden title, message and action label', () => {
    render(
      <EmptyState
        title="No appointments"
        message="Book one to get started."
        actionLabel="Schedule"
      />,
    );

    expect(screen.getByText('No appointments')).toBeInTheDocument();
    expect(screen.getByText('Book one to get started.')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state-action')).toHaveTextContent('Schedule');
  });

  it('calls onAction when the action button is clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Schedule" onAction={onAction} />);

    fireEvent.click(screen.getByTestId('empty-state-action'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('AlertBanner', () => {
  it('defaults to an info banner that can be dismissed', () => {
    render(<AlertBanner message="Saved" />);

    const banner = screen.getByTestId('alert-banner');
    expect(banner.className).toBe('alert alert--info');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('data-variant', 'info');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('uses role="alert" only for the error variant', () => {
    const { rerender } = render(<AlertBanner variant="error" message="Boom" />);
    expect(screen.getByTestId('alert-banner')).toHaveAttribute('role', 'alert');

    rerender(<AlertBanner variant="success" message="Yay" />);
    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner.className).toBe('alert alert--success');
  });

  it('hides the dismiss button when dismissible is false', () => {
    render(<AlertBanner message="Saved" dismissible={false} />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('calls onDismissed when the dismiss button is clicked', () => {
    const onDismissed = vi.fn();
    render(<AlertBanner message="Saved" onDismissed={onDismissed} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismissed).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  it('renders nothing while closed and the default labels once open', () => {
    const { rerender } = render(<ConfirmDialog />);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    rerender(<ConfirmDialog open />);
    const dialog = screen.getByTestId('confirm-dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Are you sure?');
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(dialog.querySelector('.dialog__message')).toBeNull();
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Go back');
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Confirm');
  });

  it('swaps the confirm label and disables both actions while busy', () => {
    render(
      <ConfirmDialog
        open
        busy
        confirmLabel="Cancel appointment"
        message="This cannot be undone."
      />,
    );

    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Working…');
    expect(screen.getByTestId('confirm-accept')).toBeDisabled();
    expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
  });

  it('calls onConfirmed and onCancelled from their own buttons', () => {
    const onConfirmed = vi.fn();
    const onCancelled = vi.fn();
    render(<ConfirmDialog open onConfirmed={onConfirmed} onCancelled={onCancelled} />);

    fireEvent.click(screen.getByTestId('confirm-accept'));
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onCancelled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });
});

describe('date helpers', () => {
  it('reproduce the four Angular date formats in local time', () => {
    // Built in local time, then handed over as UTC, so the expectations hold under any TZ.
    const localMoment = new Date(2024, 4, 1, 9, 30, 0, 0);
    const iso = localMoment.toISOString();

    expect(formatFullDateTime(iso)).toBe('Wed 1 May 2024, 09:30');
    expect(formatShortDateTime(iso)).toBe('Wed 1 May, 09:30');
    expect(formatTimeOfDay(iso)).toBe('09:30');
    expect(formatWeekdayDate(iso)).toBe('Wednesday 1 May');
    expect(formatFullDateTime(localMoment)).toBe('Wed 1 May 2024, 09:30');

    // Day keys are parsed at local midnight, the way Angular's date pipe treats `YYYY-MM-DD`.
    expect(formatDayGroupHeading('2024-05-01')).toBe('Wednesday 1 May');
    expect(formatDayGroupHeading('2024-12-25')).toBe('Wednesday 25 December');
  });
});

describe('visitTypeLabel', () => {
  it('maps known visit types, passes through unknown ones and blanks empty input', () => {
    expect(visitTypeLabel('in_person')).toBe('In person');
    expect(visitTypeLabel('video')).toBe('Video visit');
    expect(visitTypeLabel('phone')).toBe('Phone call');
    expect(visitTypeLabel('house_call')).toBe('house_call');
    expect(visitTypeLabel('')).toBe('');
    expect(visitTypeLabel(null)).toBe('');
    expect(visitTypeLabel(undefined)).toBe('');
  });
});
