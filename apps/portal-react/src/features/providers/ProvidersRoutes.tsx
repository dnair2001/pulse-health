import { Route, Routes } from 'react-router-dom';

import { ProviderDirectoryPage } from './pages/ProviderDirectoryPage';
import { ProviderProfilePage } from './pages/ProviderProfilePage';

/** Port of ProvidersRoutingModule: the directory at `/providers`, a profile at `/providers/:id`. */
export default function ProvidersRoutes() {
  return (
    <Routes>
      <Route index element={<ProviderDirectoryPage />} />
      <Route path=":id" element={<ProviderProfilePage />} />
    </Routes>
  );
}
