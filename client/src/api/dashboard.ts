import { useQuery } from '@tanstack/react-query';
import type { DashboardDTO } from '@taller/shared';
import { api } from './client';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardDTO>('/dashboard') });
}
