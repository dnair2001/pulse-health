import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AppointmentStatus } from '../api/types';
import { AlertBanner } from './AlertBanner';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { StatusBadge } from './StatusBadge';
import {
  dayKey,
  formatDayHeading,
  formatLongWhen,
  formatShortWhen,
  formatTime,
} from './formatDateTime';
import { visitTypeLabel } from './visitTypeLabel';

describe('StatusBadge', () => {
  const cases: Array<[AppointmentStatus, string]> = [
    ['scheduled', 'Scheduled'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
  ];

  for (const [status, label] of cases) {
    it(`renders the ${status} label and modifier class`, () => {
      render(<StatusBadge status={status} />);

      const badge = screen.getByText(label);
      expect(badge).toHaveClass('badge', `badge--${status}`);
      expect(badge).toHaveAttribute('data-status', status);
    });
  }
});

describe('LoadingSpinner', () => {
  it('renders the default label under role=status', () => {
    render(<LoadingSpinner />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<LoadingSpinner label="Loading providers…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading providers…');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the default title and no message or action', () => {
    render(<EmptyState />);

    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('renders the supplied title and message', () => {
    render(<EmptyState title="No past appointments" message="Nothing to look back on." />);

    expect(screen.getByRole('heading', { name: 'No past appointments' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to look back on.')).toBeInTheDocument();
  });

  it('omits the message paragraph when the message is empty', () => {
    render(<EmptyState title="Empty" message="" />);

    expect(screen.getByTestId('empty-state').querySelector('.empty-state__message')).toBeNull();
  });

  it('renders the action button only when actionLabel is set and fires onAction', async () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Schedule appointment" onAction={onAction} />);

    const action = screen.getByTestId('empty-state-action');
    expect(action).toHaveTextContent('Schedule appointment');

    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('AlertBanner', () => {
  it('defaults to the info variant with role=status', () => {
    render(<AlertBanner message="Heads up" />);

    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveClass('alert', 'alert--info');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('data-variant', 'info');
  });

  it('uses role=alert for the error variant', () => {
    render(<AlertBanner variant="error" message="It broke" />);

    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveClass('alert--error');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('alert')).toHaveTextContent('It broke');
  });

  it('uses role=status for the success variant', () => {
    render(<AlertBanner variant="success" message="Appointment cancelled." />);

    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveClass('alert--success');
    expect(banner).toHaveAttribute('role', 'status');
  });

  it('renders a dismiss button by default and fires onDismiss', async () => {
    const onDismiss = vi.fn();
    render(<AlertBanner message="Heads up" onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('hides the dismiss button when dismissible is false', () => {
    render(<AlertBanner variant="error" message="It broke" dismissible={false} />);

    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('renders the default title and labels when open', () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId('confirm-dialog')).toHaveAttribute('aria-label', 'Are you sure?');
    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Go back');
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Confirm');
  });

  it('renders the supplied title, message and labels', () => {
    render(
      <ConfirmDialog
        open
        title="Cancel this appointment?"
        message="This frees up your slot."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep appointment"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Cancel this appointment?' })).toBeInTheDocument();
    expect(screen.getByText('This frees up your slot.')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Yes, cancel it');
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Keep appointment');
  });

  it('omits the message paragraph when there is no message', () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId('confirm-dialog').querySelector('.dialog__message')).toBeNull();
  });

  it('disables both buttons and relabels confirm while busy', () => {
    render(<ConfirmDialog open busy confirmLabel="Yes, cancel it" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
    expect(screen.getByTestId('confirm-accept')).toBeDisabled();
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Working…');
  });

  it('fires onConfirm and onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByTestId('confirm-accept'));
    await userEvent.click(screen.getByTestId('confirm-cancel'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('exposes the dialog as a modal', () => {
    render(<ConfirmDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});

describe('visitTypeLabel', () => {
  it('labels the three known visit types', () => {
    expect(visitTypeLabel('in_person')).toBe('In person');
    expect(visitTypeLabel('video')).toBe('Video visit');
    expect(visitTypeLabel('phone')).toBe('Phone call');
  });

  it('returns an empty string for null, undefined and empty input', () => {
    expect(visitTypeLabel(null)).toBe('');
    expect(visitTypeLabel(undefined)).toBe('');
    expect(visitTypeLabel('')).toBe('');
  });

  it('passes an unknown value through unchanged', () => {
    expect(visitTypeLabel('house_call')).toBe('house_call');
  });
});

describe('formatDateTime', () => {
  it('formats the time as HH:mm with zero padding', () => {
    expect(formatTime('2099-01-05T09:00:00Z')).toBe('09:00');
    expect(formatTime('2099-01-05T14:05:00Z')).toBe('14:05');
  });

  it('formats the long form with the year', () => {
    expect(formatLongWhen('2099-01-05T09:00:00Z')).toBe('Mon 5 Jan 2099, 09:00');
  });

  it('formats the short form without the year', () => {
    expect(formatShortWhen('2099-01-05T09:00:00Z')).toBe('Mon 5 Jan, 09:00');
  });

  it('uses the two-digit month name for a later month', () => {
    expect(formatLongWhen('2099-11-30T23:45:00Z')).toBe('Mon 30 Nov 2099, 23:45');
  });

  it('takes the day key from the ISO date prefix', () => {
    expect(dayKey('2099-01-05T09:00:00Z')).toBe('2099-01-05');
    expect(dayKey('2099-12-31T23:59:00Z')).toBe('2099-12-31');
  });

  it('formats a day heading from a YYYY-MM-DD key', () => {
    expect(formatDayHeading('2099-01-05')).toBe('Monday 5 January');
    expect(formatDayHeading('2099-09-01')).toBe('Tuesday 1 September');
  });
});
