import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProviderProfilePage } from './ProviderProfilePage';
import { errorResponse, jsonResponse, provider, renderWithProviders } from '../../../test/helpers';

const marcus = provider({
  id: 'prv_002',
  name: 'Dr. Marcus Bell',
  specialty: 'Dermatology',
  credentials: 'DO',
  locationName: 'Pulse Health Riverside',
  bio: 'Board-certified dermatologist.',
});

function renderProfile(route = '/providers/prv_002') {
  return renderWithProviders(
    <Routes>
      <Route path="/providers" element={<div data-testid="directory-route" />} />
      <Route path="/providers/:id" element={<ProviderProfilePage />} />
    </Routes>,
    { route },
  );
}

describe('ProviderProfilePage', () => {
  it('shows the loading state while the provider is in flight', () => {
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => {}));

    renderProfile();

    expect(screen.getByTestId('loading-spinner')).toHaveTextContent('Loading provider…');
    expect(screen.queryByTestId('provider-profile')).not.toBeInTheDocument();
  });

  it('requests the provider named in the route and renders it', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(marcus));

    renderProfile();

    const profile = await screen.findByTestId('provider-profile');
    expect(profile).toHaveTextContent('Dr. Marcus Bell');
    expect(profile).toHaveTextContent('Dermatology, DO');
    expect(profile).toHaveTextContent('Pulse Health Riverside');
    expect(screen.getByTestId('provider-bio')).toHaveTextContent('Board-certified dermatologist.');
    expect(fetch).toHaveBeenCalledWith('/api/providers/prv_002', undefined);
    expect(document.title).toBe('Provider profile');
  });

  it('surfaces the NOT_FOUND state for an unknown id instead of a blank page', async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(404, 'NOT_FOUND', 'We could not find that provider.', 'id'),
    );

    renderProfile('/providers/prv_does_not_exist');

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'We could not find that provider.',
    );
    expect(screen.queryByTestId('provider-profile')).not.toBeInTheDocument();
    expect(screen.getByTestId('back')).toBeInTheDocument();
  });

  it('surfaces a server error', async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500, 'UNKNOWN', ''));

    renderProfile();

    expect(await screen.findByTestId('alert-banner')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('goes back to the directory', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(marcus));

    renderProfile();
    await userEvent.click(await screen.findByTestId('back'));

    await waitFor(() => expect(screen.getByTestId('directory-route')).toBeInTheDocument());
  });

  /**
   * The Angular page renders bio through `bypassSecurityTrustHtml` + `[innerHTML]`, which makes
   * any markup a care coordinator saved execute in the reader's browser (DIV-8). The port must
   * not reproduce that, so this pins the escaped behaviour rather than the rendered-markup one.
   */
  it('renders a script- and handler-bearing bio as inert text', async () => {
    const hostile =
      'Board-certified dermatologist. <img src="x" onerror="globalThis.xssRan = true"> ' +
      '<script>globalThis.xssRan = true;</script> Please replace.';
    vi.mocked(fetch).mockResolvedValue(jsonResponse(provider({ id: 'prv_002', bio: hostile })));

    renderProfile();

    const bio = await screen.findByTestId('provider-bio');
    expect(bio).toHaveTextContent(hostile);
    expect(bio.querySelector('img')).toBeNull();
    expect(bio.querySelector('script')).toBeNull();
    expect(bio.innerHTML).not.toContain('<img');
    expect((globalThis as { xssRan?: boolean }).xssRan).toBeUndefined();
  });
});
