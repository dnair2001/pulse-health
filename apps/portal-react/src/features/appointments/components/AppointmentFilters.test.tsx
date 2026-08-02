import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { VisitType } from '../../../api/types';
import { renderWithProviders } from '../../../test/helpers';
import { AppointmentFilters } from './AppointmentFilters';
import type { AppointmentFiltersValue } from './AppointmentFilters';

const VISIT_TYPES: VisitType[] = [
  { id: 'in_person', label: 'In person', durationMinutes: 30 },
  { id: 'video', label: 'Video visit', durationMinutes: 20 },
  { id: 'phone', label: 'Phone call', durationMinutes: 15 },
];

const EMPTY: AppointmentFiltersValue = { status: '', visitType: '' };

describe('AppointmentFilters', () => {
  it('renders the filter form with both labelled selects', () => {
    renderWithProviders(
      <AppointmentFilters
        value={EMPTY}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId('appointment-filters')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Visit type')).toBeInTheDocument();
    expect(screen.getByTestId('filter-status')).toBeInTheDocument();
    expect(screen.getByTestId('filter-visit-type')).toBeInTheDocument();
  });

  it('renders every status option including the "All statuses" placeholder', () => {
    renderWithProviders(
      <AppointmentFilters
        value={EMPTY}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const status = screen.getByTestId('filter-status');
    const options = Array.from(status.querySelectorAll('option'));

    expect(options.map((option) => option.textContent)).toEqual([
      'All statuses',
      'Scheduled',
      'Completed',
      'Cancelled',
    ]);
    expect(options.map((option) => option.getAttribute('value'))).toEqual([
      '',
      'scheduled',
      'completed',
      'cancelled',
    ]);
  });

  it('renders visit type options from the prop plus the "All visit types" placeholder', () => {
    renderWithProviders(
      <AppointmentFilters
        value={EMPTY}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const visitType = screen.getByTestId('filter-visit-type');
    const options = Array.from(visitType.querySelectorAll('option'));

    expect(options.map((option) => option.textContent)).toEqual([
      'All visit types',
      'In person',
      'Video visit',
      'Phone call',
    ]);
  });

  it('renders only the placeholder when no visit types are supplied', () => {
    renderWithProviders(
      <AppointmentFilters value={EMPTY} visitTypes={[]} onChange={vi.fn()} onClear={vi.fn()} />,
    );

    const options = Array.from(screen.getByTestId('filter-visit-type').querySelectorAll('option'));
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('All visit types');
  });

  it('reflects the supplied value in both selects', () => {
    renderWithProviders(
      <AppointmentFilters
        value={{ status: 'completed', visitType: 'phone' }}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId('filter-status')).toHaveValue('completed');
    expect(screen.getByTestId('filter-visit-type')).toHaveValue('phone');
  });

  it('calls onChange with the complete next value when the status changes', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <AppointmentFilters
        value={{ status: '', visitType: 'video' }}
        visitTypes={VISIT_TYPES}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByTestId('filter-status'), 'cancelled');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ status: 'cancelled', visitType: 'video' });
  });

  it('calls onChange with the complete next value when the visit type changes', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <AppointmentFilters
        value={{ status: 'scheduled', visitType: '' }}
        visitTypes={VISIT_TYPES}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByTestId('filter-visit-type'), 'in_person');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ status: 'scheduled', visitType: 'in_person' });
  });

  it('calls onChange with an empty status when the placeholder is selected again', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <AppointmentFilters
        value={{ status: 'scheduled', visitType: 'video' }}
        visitTypes={VISIT_TYPES}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByTestId('filter-status'), '');

    expect(onChange).toHaveBeenCalledWith({ status: '', visitType: 'video' });
  });

  it('calls onClear when the clear button is pressed', async () => {
    const onClear = vi.fn();
    const onChange = vi.fn();
    renderWithProviders(
      <AppointmentFilters
        value={{ status: 'scheduled', visitType: 'video' }}
        visitTypes={VISIT_TYPES}
        onChange={onChange}
        onClear={onClear}
      />,
    );

    await userEvent.click(screen.getByTestId('filter-reset'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the clear button visible and enabled when no filters are active', () => {
    renderWithProviders(
      <AppointmentFilters
        value={EMPTY}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const clear = screen.getByTestId('filter-reset');
    expect(clear).toBeVisible();
    expect(clear).toBeEnabled();
    expect(clear).toHaveTextContent('Clear filters');
  });

  it('renders the clear button as a plain button so it never submits the form', () => {
    renderWithProviders(
      <AppointmentFilters
        value={EMPTY}
        visitTypes={VISIT_TYPES}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByTestId('filter-reset')).toHaveAttribute('type', 'button');
  });
});
