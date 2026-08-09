import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { LoadingSpinner } from './shared/LoadingSpinner';

// Angular lazy-loads each feature with `loadChildren`; React.lazy is the equivalent, and is
// what gives this feature its own chunk in the production bundle.
const ProvidersRoutes = lazy(() => import('./features/providers/ProvidersRoutes'));

const PATIENT_NAME = 'Jordan Reyes';

/**
 * The nav lists only the features ported so far, so `/` lands on the directory instead of the
 * dashboard the Angular app opens with. Every other link comes back as its slice is ported.
 */
export function App() {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__logo" aria-hidden="true">
            ◆
          </span>
          <span className="shell__name">Pulse Health</span>
          <span className="shell__tag">Patient portal</span>
        </div>
        <nav className="shell__nav">
          <NavLink
            to="/providers"
            className={({ isActive }) =>
              isActive ? 'shell__link shell__link--active' : 'shell__link'
            }
          >
            Providers
          </NavLink>
        </nav>
        <div className="shell__patient" data-testid="patient-name">
          {PATIENT_NAME}
        </div>
      </header>

      <main className="shell__main">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Navigate to="/providers" replace />} />
            <Route path="/providers/*" element={<ProvidersRoutes />} />
            <Route path="*" element={<Navigate to="/providers" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="shell__footer">
        Pulse Health demo environment. Data resets when the mock API store is cleared.
      </footer>
    </div>
  );
}
