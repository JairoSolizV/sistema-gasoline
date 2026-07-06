import { Navigate } from 'react-router-dom';
import { tokenStore } from '../api/client';

// Fase 1: si no hay token, al login. El backend igual valida cada request.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!tokenStore.get()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
