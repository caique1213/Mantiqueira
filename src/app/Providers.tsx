import { useMemo, type PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '../lib/query-client';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import {
  ThemeProvider,
  createLocalStorageThemeAdapter,
  createSupabaseThemeAdapter,
} from '../features/themes';

const localThemeAdapter = createLocalStorageThemeAdapter({
  key: 'mantiqueira-maintenance-hub:theme:v1',
});

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RuntimeThemeProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const siteId = auth.access?.site_ids[0];
  const adapter = useMemo(
    () => (siteId ? createSupabaseThemeAdapter(siteId) : localThemeAdapter),
    [siteId],
  );
  return (
    <ThemeProvider adapter={adapter}>
      {children}
      <Toaster richColors position="top-right" closeButton />
    </ThemeProvider>
  );
}
