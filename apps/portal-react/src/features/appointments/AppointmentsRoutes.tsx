import { Route, Routes } from 'react-router-dom';

import { AppointmentListPage } from './pages/AppointmentListPage';
import { AppointmentReschedulePage } from './pages/AppointmentReschedulePage';
import { AppointmentSchedulePage } from './pages/AppointmentSchedulePage';

/** Loaded lazily by the shell, mirroring the Angular feature module's `loadChildren`. */
export default function AppointmentsRoutes() {
  return (
    <Routes>
      <Route index element={<AppointmentListPage />} />
      <Route path="schedule" element={<AppointmentSchedulePage />} />
      <Route path=":id/reschedule" element={<AppointmentReschedulePage />} />
    </Routes>
  );
}
