import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { VisitType } from '../../../api/types';
import { AppointmentFilters } from './AppointmentFilters';

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
  { id: 'phone', label: 'Phone call', durationMinutes: 15 },
];

function renderFilters(disabled = false) {
  const onFiltersChanged = vi.fn();
  render(
    <AppointmentFilters
      visitTypes={VISIT_TYPES}
      disabled={disabled}
      onFiltersChanged={onFiltersChanged}
    />,
  );

  return {
    onFiltersChanged,
    status: screen.getByTestId('filter-status') as HTMLSelectElement,
    visitType: screen.getByTestId('filter-visit-type') as HTMLSelectElement,
    reset: screen.getByTestId('filter-reset'),
  };
}

describe('AppointmentFilters', () => {
  it('emits the complete filter value on every change', async () => {
    const user = userEvent.setup();
    const { onFiltersChanged, status, visitType } = renderFilters();

    await user.selectOptions(status, 'completed');
    expect(onFiltersChanged).toHaveBeenLastCalledWith({ status: 'completed', visitType: '' });

    await user.selectOptions(visitType, 'video');
    expect(onFiltersChanged).toHaveBeenLastCalledWith({ status: 'completed', visitType: 'video' });

    await user.selectOptions(status, '');
    expect(onFiltersChanged).toHaveBeenLastCalledWith({ status: '', visitType: 'video' });

    expect(onFiltersChanged).toHaveBeenCalledTimes(3);
  });

  it('clears both selects and emits the empty value, even when nothing is selected', async () => {
    const user = userEvent.setup();
    const { onFiltersChanged, status, visitType, reset } = renderFilters();

    await user.selectOptions(status, 'scheduled');
    await user.selectOptions(visitType, 'phone');
    await user.click(reset);

    expect(status.value).toBe('');
    expect(visitType.value).toBe('');
    expect(onFiltersChanged).toHaveBeenLastCalledWith({ status: '', visitType: '' });

    await user.click(reset);
    expect(onFiltersChanged).toHaveBeenCalledTimes(4);
    expect(onFiltersChanged).toHaveBeenLastCalledWith({ status: '', visitType: '' });
  });

  it('disables both selects while leaving the clear button usable', async () => {
    const user = userEvent.setup();
    const { onFiltersChanged, status, visitType, reset } = renderFilters(true);

    expect(status).toBeDisabled();
    expect(visitType).toBeDisabled();
    expect(reset).toBeEnabled();

    await user.click(status);
    await user.click(visitType);
    expect(status.value).toBe('');
    expect(visitType.value).toBe('');
    expect(onFiltersChanged).not.toHaveBeenCalled();

    await user.click(reset);
    expect(onFiltersChanged).toHaveBeenCalledWith({ status: '', visitType: '' });
  });

  it('lists the three statuses title-cased and one option per supplied visit type', () => {
    const { status, visitType } = renderFilters();

    expect([...status.options].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'All statuses'],
      ['scheduled', 'Scheduled'],
      ['completed', 'Completed'],
      ['cancelled', 'Cancelled'],
    ]);
    expect([...visitType.options].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'All visit types'],
      ['in_person', 'In person'],
      ['video', 'Video visit'],
      ['phone', 'Phone call'],
    ]);
  });
});
