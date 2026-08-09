import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { jsonResponse, provider, renderWithProviders } from './test/helpers';

describe('App', () => {
  it('redirects the root path to the provider directory', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([provider()]));

    renderWithProviders(<App />, { route: '/' });

    expect(await screen.findByTestId('provider-card-prv_001')).toBeInTheDocument();
  });

  it('redirects an unknown path to the provider directory', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([provider()]));

    renderWithProviders(<App />, { route: '/nowhere' });

    expect(await screen.findByRole('heading', { name: 'Provider directory' })).toBeInTheDocument();
  });

  it('renders the shell chrome around the routed feature', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([provider()]));

    renderWithProviders(<App />, { route: '/providers' });

    expect(await screen.findByTestId('provider-card-prv_001')).toBeInTheDocument();
    expect(screen.getByTestId('patient-name')).toHaveTextContent('Jordan Reyes');
    expect(screen.getByRole('link', { name: 'Providers' })).toHaveClass('shell__link--active');
  });
});
