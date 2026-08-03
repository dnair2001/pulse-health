import { Suspense, lazy } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { LoadingSpinner } from './shared/LoadingSpinner';

const AppointmentsRoutes = lazy(() =>
  import('./features/appointments/AppointmentsRoutes').then((module) => ({
    default: module.AppointmentsRoutes,
  })),
);

const PATIENT_NAME = 'Jordan Reyes';

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
            to="/appointments"
            className={({ isActive }) =>
              isActive ? 'shell__link shell__link--active' : 'shell__link'
            }
          >
            Appointments
          </NavLink>
        </nav>
        <div className="shell__patient" data-testid="patient-name">
          {PATIENT_NAME}
        </div>
      </header>

      <main className="shell__main">
        <Routes>
          <Route path="/" element={<Navigate to="/appointments" replace />} />
          <Route
            path="/appointments/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AppointmentsRoutes />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/appointments" replace />} />
        </Routes>
      </main>

      <footer className="shell__footer">
        Pulse Health demo environment. Data resets when the mock API store is cleared.
      </footer>
    </div>
  );
}
