import { Navigate, Route, Routes } from 'react-router-dom';

import { AppointmentListPage } from './pages/AppointmentListPage';
import { AppointmentReschedulePage } from './pages/AppointmentReschedulePage';
import { AppointmentSchedulePage } from './pages/AppointmentSchedulePage';

/** Port of `appointments-routing.module.ts`, mounted by the shell under `/appointments/*`. */
export function AppointmentsRoutes() {
  return (
    <Routes>
      <Route index element={<AppointmentListPage />} />
      <Route path="schedule" element={<AppointmentSchedulePage />} />
      <Route path=":id/reschedule" element={<AppointmentReschedulePage />} />
      {/* The shell's catch-all sits above this subtree, so unknown sub-paths need one here. */}
      <Route path="*" element={<Navigate to="/appointments" replace />} />
    </Routes>
  );
}
