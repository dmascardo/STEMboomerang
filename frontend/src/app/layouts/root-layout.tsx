import { Outlet } from 'react-router';
import { CandidatesProvider } from '../contexts/candidates-context';

export function RootLayout() {
  return (
    <CandidatesProvider>
      <Outlet />
    </CandidatesProvider>
  );
}
