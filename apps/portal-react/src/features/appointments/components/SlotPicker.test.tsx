import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Slot } from '../../../api/types';
import { formatDayGroupHeading, formatTimeOfDay } from '../../../shared/formatDateTime';
import { SlotPicker } from './SlotPicker';

/** Deliberately unsorted, and the second day comes first, exactly like the Angular spec. */
const SLOTS: Slot[] = [
  {
    id: 'slt_b',
    providerId: 'prv_001',
    startsAt: '2099-01-06T09:00:00Z',
    endsAt: '2099-01-06T09:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_a',
    providerId: 'prv_001',
    startsAt: '2099-01-05T14:00:00Z',
    endsAt: '2099-01-05T14:30:00Z',
    isBooked: false,
  },
  {
    id: 'slt_c',
    providerId: 'prv_001',
    startsAt: '2099-01-05T09:00:00Z',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
  },
];

describe('SlotPicker', () => {
  it('groups unsorted slots by day and orders both the days and the times', () => {
    render(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    const picker = screen.getByTestId('slot-picker');
    expect(
      [...picker.querySelectorAll('.slot-picker__date')].map((node) => node.textContent),
    ).toEqual([formatDayGroupHeading('2099-01-05'), formatDayGroupHeading('2099-01-06')]);
    expect(
      [...picker.querySelectorAll('.slot')].map((node) => node.getAttribute('data-testid')),
    ).toEqual(['slot-slt_c', 'slot-slt_a', 'slot-slt_b']);
    expect(screen.getByTestId('slot-slt_c')).toHaveTextContent(formatTimeOfDay(SLOTS[2].startsAt));
    expect(screen.queryByTestId('slot-picker-empty')).not.toBeInTheDocument();
  });

  it('marks the slot matching value as pressed and reports the clicked slot', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SlotPicker slots={SLOTS} value="slt_a" onChange={onChange} />);

    const selected = screen.getByTestId('slot-slt_a');
    const other = screen.getByTestId('slot-slt_c');
    expect(selected.className).toBe('slot slot--selected');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(other.className).toBe('slot');
    expect(other).toHaveAttribute('aria-pressed', 'false');
    expect(other).toHaveAttribute('type', 'button');

    await user.click(other);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('slt_c');
  });

  it('prefers the spinner over the empty message while loading, and keeps rendering known slots', () => {
    const { rerender } = render(<SlotPicker slots={[]} loading value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading available times…');
    expect(screen.queryByTestId('slot-picker-empty')).not.toBeInTheDocument();

    rerender(<SlotPicker slots={SLOTS} loading value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('slot-slt_c')).toBeInTheDocument();

    rerender(<SlotPicker slots={[]} value={null} onChange={vi.fn()} />);
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('slot-picker-empty')).toHaveTextContent(
      'No open time slots for this provider. Try another provider.',
    );
  });

  it('disables every slot button and ignores selection while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SlotPicker slots={SLOTS} value="slt_a" onChange={onChange} disabled />);

    for (const id of ['slt_a', 'slt_b', 'slt_c']) {
      expect(screen.getByTestId(`slot-${id}`)).toBeDisabled();
    }

    await user.click(screen.getByTestId('slot-slt_c'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('slot-slt_a')).toHaveAttribute('aria-pressed', 'true');
  });
});
