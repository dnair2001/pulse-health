import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Slot } from '../../../api/types';
import { renderWithProviders } from '../../../test/helpers';
import { SlotPicker } from './SlotPicker';

function buildSlot(overrides: Partial<Slot> & Pick<Slot, 'id' | 'startsAt'>): Slot {
  return {
    providerId: 'prv_001',
    endsAt: '2099-01-05T09:30:00Z',
    isBooked: false,
    ...overrides,
  };
}

/** Deliberately out of order so the component's own sorting is under test. */
const SLOTS: Slot[] = [
  buildSlot({ id: 'slt_b', startsAt: '2099-01-06T09:00:00Z', endsAt: '2099-01-06T09:30:00Z' }),
  buildSlot({ id: 'slt_a', startsAt: '2099-01-05T14:00:00Z', endsAt: '2099-01-05T14:30:00Z' }),
  buildSlot({ id: 'slt_c', startsAt: '2099-01-05T09:00:00Z', endsAt: '2099-01-05T09:30:00Z' }),
];

describe('SlotPicker', () => {
  it('renders the picker container', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('slot-picker')).toBeInTheDocument();
  });

  it('groups slots by calendar day in chronological order', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual(['Monday 5 January', 'Tuesday 6 January']);
  });

  it('orders the times within a day chronologically', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('data-testid'))).toEqual([
      'slot-slt_c',
      'slot-slt_a',
      'slot-slt_b',
    ]);
  });

  it('formats each slot time as a 24 hour clock', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('slot-slt_c')).toHaveTextContent('09:00');
    expect(screen.getByTestId('slot-slt_a')).toHaveTextContent('14:00');
  });

  it('marks the selected slot with the slot--selected class', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value="slt_a" onChange={vi.fn()} />);

    expect(screen.getByTestId('slot-slt_a')).toHaveClass('slot', 'slot--selected');
    expect(screen.getByTestId('slot-slt_c')).toHaveClass('slot');
    expect(screen.getByTestId('slot-slt_c')).not.toHaveClass('slot--selected');
  });

  it('exposes the selection through aria-pressed', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value="slt_a" onChange={vi.fn()} />);

    expect(screen.getByTestId('slot-slt_a')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('slot-slt_b')).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects nothing when the value is null', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveClass('slot--selected');
    }
  });

  it('calls onChange with the slot id when a slot is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={onChange} />);

    await userEvent.click(screen.getByTestId('slot-slt_c'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('slt_c');
  });

  it('renders every slot as a plain button so it never submits the enclosing form', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('renders booked slots as disabled buttons', async () => {
    const onChange = vi.fn();
    const slots = [
      buildSlot({ id: 'slt_open', startsAt: '2099-01-05T09:00:00Z' }),
      buildSlot({ id: 'slt_taken', startsAt: '2099-01-05T10:00:00Z', isBooked: true }),
    ];
    renderWithProviders(<SlotPicker slots={slots} value={null} onChange={onChange} />);

    expect(screen.getByTestId('slot-slt_open')).toBeEnabled();
    expect(screen.getByTestId('slot-slt_taken')).toBeDisabled();

    await userEvent.click(screen.getByTestId('slot-slt_taken'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables every slot when the picker is disabled', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={onChange} disabled />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }

    await userEvent.click(screen.getByTestId('slot-slt_c'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the spinner while loading', () => {
    renderWithProviders(<SlotPicker slots={[]} value={null} onChange={vi.fn()} loading />);

    expect(screen.getByText('Loading available times…')).toBeInTheDocument();
  });

  it('hides the empty message while loading', () => {
    renderWithProviders(<SlotPicker slots={[]} value={null} onChange={vi.fn()} loading />);

    expect(screen.queryByTestId('slot-picker-empty')).not.toBeInTheDocument();
  });

  it('shows the default empty message when there are no slots', () => {
    renderWithProviders(<SlotPicker slots={[]} value={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('slot-picker-empty')).toHaveTextContent(
      'No open time slots for this provider. Try another provider.',
    );
  });

  it('shows a custom empty message when one is supplied', () => {
    renderWithProviders(
      <SlotPicker
        slots={[]}
        value={null}
        onChange={vi.fn()}
        emptyMessage="Nothing free this week."
      />,
    );

    expect(screen.getByTestId('slot-picker-empty')).toHaveTextContent('Nothing free this week.');
  });

  it('does not show the empty message when slots are present', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} />);

    expect(screen.queryByTestId('slot-picker-empty')).not.toBeInTheDocument();
  });

  it('renders the field level error text', () => {
    renderWithProviders(
      <SlotPicker
        slots={SLOTS}
        value={null}
        onChange={vi.fn()}
        error="Please choose a time slot."
      />,
    );

    const error = screen.getByTestId('slot-error');
    expect(error).toHaveTextContent('Please choose a time slot.');
    expect(error).toHaveClass('field__error');
  });

  it('renders no error element when there is no error', () => {
    renderWithProviders(<SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} error={null} />);

    expect(screen.queryByTestId('slot-error')).not.toBeInTheDocument();
  });

  it('keeps the slot list visible alongside an error', () => {
    renderWithProviders(
      <SlotPicker slots={SLOTS} value={null} onChange={vi.fn()} error="Pick a time." />,
    );

    expect(screen.getByTestId('slot-slt_c')).toBeInTheDocument();
    expect(screen.getByTestId('slot-error')).toBeInTheDocument();
  });

  it('groups slots that share a day under a single heading', () => {
    const slots = [
      buildSlot({ id: 'slt_1', startsAt: '2099-01-07T08:00:00Z' }),
      buildSlot({ id: 'slt_2', startsAt: '2099-01-07T08:30:00Z' }),
      buildSlot({ id: 'slt_3', startsAt: '2099-01-07T16:15:00Z' }),
    ];
    renderWithProviders(<SlotPicker slots={slots} value={null} onChange={vi.fn()} />);

    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Wednesday 7 January' })).toBeInTheDocument();
    expect(screen.getByTestId('slot-slt_3')).toHaveTextContent('16:15');
  });
});
