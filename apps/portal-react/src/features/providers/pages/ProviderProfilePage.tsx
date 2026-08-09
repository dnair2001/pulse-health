import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { useProvider } from '../../../api/queries';
import { AlertBanner } from '../../../shared/AlertBanner';
import { LoadingSpinner } from '../../../shared/LoadingSpinner';
import { useDocumentTitle } from '../../../shared/useDocumentTitle';

export function ProviderProfilePage() {
  useDocumentTitle('Provider profile');

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: provider, error, isFetching } = useProvider(id);

  if (!id) {
    return <Navigate to="/providers" />;
  }

  if (isFetching) {
    return <LoadingSpinner message="Loading provider…" />;
  }

  return (
    <section className="page">
      <header className="page__header">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => void navigate('/providers')}
          data-testid="back"
        >
          &larr; Back to directory
        </button>
      </header>

      {error ? (
        <div className="stack">
          <AlertBanner variant="error" message={error.message} dismissible={false} />
        </div>
      ) : null}

      {provider ? (
        <article className="card" data-testid="provider-profile">
          <h1 className="page__title">{provider.name}</h1>
          <p className="page__subtitle">
            {provider.specialty}, {provider.credentials}
          </p>
          <p className="provider-profile__location">{provider.locationName}</p>
          {/*
            Bios are free text an internal onboarding tool writes, and at least one seeded bio
            already carries an `<img onerror=...>` payload. JSX escapes interpolated text, so
            this stays inert; do not reach for dangerouslySetInnerHTML to recover the
            `<strong>`/`<br>` formatting the Angular app renders (see DIV-8).
          */}
          <div className="provider-profile__bio" data-testid="provider-bio">
            {provider.bio}
          </div>
        </article>
      ) : null}
    </section>
  );
}
