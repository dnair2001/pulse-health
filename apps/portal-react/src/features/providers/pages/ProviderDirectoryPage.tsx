import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProviders } from '../../../api/queries';
import { AlertBanner } from '../../../shared/AlertBanner';
import { EmptyState } from '../../../shared/EmptyState';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { useDocumentTitle } from '../../../shared/useDocumentTitle';
import { filterProviders } from '../filterProviders';

export function ProviderDirectoryPage() {
  useDocumentTitle('Provider directory');

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, error, isFetching, refetch } = useProviders();

  const filteredProviders = useMemo(() => filterProviders(data ?? [], search), [data, search]);

  // Angular's load() flips `loading` on and clears `error` before every attempt, including a
  // retry, so an in-flight request always shows the spinner and never the previous failure.
  const failure = isFetching ? null : error;

  // "No providers at all" and "no providers matching the search" are the same empty state in
  // Angular, so both land on the copy below.
  const isEmpty = !isFetching && !failure && filteredProviders.length === 0;

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Provider directory</h1>
          <p className="page__subtitle">Meet the clinicians at Pulse Health.</p>
        </div>
      </header>

      <label className="field">
        <span className="field__label">Search by name or specialty</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="e.g. Dermatology"
          data-testid="provider-search"
        />
      </label>

      {isFetching ? <LoadingSpinner message="Loading providers…" /> : null}

      {failure ? (
        <div className="stack">
          <AlertBanner variant="error" message={failure.message} dismissible={false} />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void refetch()}
            data-testid="retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="No providers match your search"
          message="Try a different name or specialty."
        />
      ) : null}

      {!isFetching && !failure && filteredProviders.length > 0 ? (
        <div className="provider-grid">
          {/* The id is encoded because Angular's `navigate(['/providers', id])` encodes each
              path segment; interpolating it raw would let an id containing `/` or `?` route
              somewhere else. */}
          {filteredProviders.map((provider) => (
            <button
              type="button"
              className="card provider-card"
              key={provider.id}
              onClick={() => void navigate(`/providers/${encodeURIComponent(provider.id)}`)}
              data-testid={`provider-card-${provider.id}`}
            >
              <h2 className="card__title">{provider.name}</h2>
              <p className="provider-card__specialty">
                {provider.specialty}, {provider.credentials}
              </p>
              <p className="provider-card__location">{provider.locationName}</p>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
