import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProviderDirectoryPage } from './ProviderDirectoryPage';
import { filterProviders } from '../filterProviders';
import { errorResponse, jsonResponse, provider, renderWithProviders } from '../../../test/helpers';

const alice = provider();
const marcus = provider({
  id: 'prv_002',
  name: 'Dr. Marcus Bell',
  specialty: 'Dermatology',
  credentials: 'DO',
  locationName: 'Pulse Health Riverside',
});

/** Stands in for the profile route so navigation off the directory is observable. */
function ProfileRouteProbe() {
  const { id } = useParams<{ id: string }>();
  return <div data-testid="profile-route">{id}</div>;
}

function renderDirectory() {
  return renderWithProviders(
    <Routes>
      <Route path="/providers" element={<ProviderDirectoryPage />} />
      <Route path="/providers/:id" element={<ProfileRouteProbe />} />
    </Routes>,
    { route: '/providers' },
  );
}

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.provider-card'));
}

describe('filterProviders', () => {
  it('returns everything for a blank or whitespace-only term', () => {
    expect(filterProviders([alice, marcus], '')).toEqual([alice, marcus]);
    expect(filterProviders([alice, marcus], '   ')).toEqual([alice, marcus]);
  });

  it('matches on name and on specialty, case-insensitively', () => {
    expect(filterProviders([alice, marcus], 'MARCUS')).toEqual([marcus]);
    expect(filterProviders([alice, marcus], 'primary care')).toEqual([alice]);
  });

  it('returns nothing when neither field matches', () => {
    expect(filterProviders([alice, marcus], 'cardiology')).toEqual([]);
  });
});

describe('ProviderDirectoryPage', () => {
  it('shows the loading state while providers are in flight', () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));

    renderDirectory();

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading providers…');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('renders a card per provider once loaded', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice, marcus]));

    renderDirectory();

    expect(await screen.findByTestId('provider-card-prv_001')).toHaveTextContent(
      'Dr. Alice Nguyen',
    );
    expect(cards()).toHaveLength(2);
    expect(screen.getByTestId('provider-card-prv_002')).toHaveTextContent('Dermatology, DO');
    expect(screen.getByTestId('provider-card-prv_002')).toHaveTextContent('Pulse Health Riverside');
    expect(document.title).toBe('Provider directory');
  });

  it('filters by specialty as the search term is typed', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice, marcus]));

    renderDirectory();
    await screen.findByTestId('provider-card-prv_001');
    await userEvent.type(screen.getByTestId('provider-search'), 'dermatology');

    expect(cards()).toHaveLength(1);
    expect(screen.getByTestId('provider-card-prv_002')).toBeInTheDocument();
  });

  it('filters by a partial name', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice, marcus]));

    renderDirectory();
    await screen.findByTestId('provider-card-prv_001');
    await userEvent.type(screen.getByTestId('provider-search'), 'nguy');

    expect(cards()).toHaveLength(1);
    expect(screen.getByTestId('provider-card-prv_001')).toBeInTheDocument();
  });

  it('shows the empty state when the search matches nothing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice]));

    renderDirectory();
    await screen.findByTestId('provider-card-prv_001');
    await userEvent.type(screen.getByTestId('provider-search'), 'no such specialty');

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No providers match your search');
    expect(cards()).toHaveLength(0);
  });

  it('shows the empty state when the directory itself is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));

    renderDirectory();

    expect(await screen.findByTestId('empty-state')).toHaveTextContent(
      'No providers match your search',
    );
  });

  it('surfaces a network failure and retries on demand', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderDirectory();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Cannot reach the Pulse Health API.',
    );
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice]));
    await userEvent.click(screen.getByTestId('retry'));

    expect(await screen.findByTestId('provider-card-prv_001')).toBeInTheDocument();
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('surfaces a server error with the generic message', async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500, 'UNKNOWN', ''));

    renderDirectory();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('navigates to the profile route when a provider card is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([alice]));

    renderDirectory();
    await userEvent.click(await screen.findByTestId('provider-card-prv_001'));

    await waitFor(() => expect(screen.getByTestId('profile-route')).toHaveTextContent('prv_001'));
  });
});
