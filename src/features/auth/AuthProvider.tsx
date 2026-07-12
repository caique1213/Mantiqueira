import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../lib/supabase';
import { runtimeConfig } from '../../lib/env';
import { normalizeError, type AppError } from '../../lib/errors';
import { myAccessSchema, type MyAccess } from './auth.types';

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  access: MyAccess | null;
  error: AppError | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshAccess: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAccess(): Promise<MyAccess> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase não configurado.');

  const { data, error } = await client.rpc('get_my_access');
  if (error) throw error;
  return myAccessSchema.parse(data);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(runtimeConfig.configured);
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!session) {
      setAccess(null);
      return;
    }
    try {
      const nextAccess = await fetchAccess();
      setAccess(nextAccess);
      setError(null);
    } catch (caught) {
      setAccess(null);
      setError(normalizeError(caught));
    }
  }, [session]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    let active = true;

    void client.auth.getSession().then(async ({ data, error: authError }) => {
      if (!active) return;
      if (authError) setError(normalizeError(authError));
      setSession(data.session);
      if (data.session) {
        try {
          setAccess(await fetchAccess());
        } catch (caught) {
          setError(normalizeError(caught));
        }
      }
      setLoading(false);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setAccess(null);
        setError(null);
      } else {
        queueMicrotask(() => {
          void fetchAccess()
            .then((nextAccess) => {
              if (active) setAccess(nextAccess);
            })
            .catch((caught: unknown) => {
              if (active) setError(normalizeError(caught));
            });
        });
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não configurado.');
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw normalizeError(signInError);
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) throw normalizeError(signOutError);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não configurado.');
    const redirectTo = `${window.location.origin}/auth/update-password`;
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) throw normalizeError(resetError);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não configurado.');
    const { error: passwordError } = await client.auth.updateUser({ password });
    if (passwordError) throw normalizeError(passwordError);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: runtimeConfig.configured,
      loading,
      session,
      user: session?.user ?? null,
      access,
      error,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshAccess,
      hasPermission: (permission) =>
        Boolean(access?.permissions.includes('*') || access?.permissions.includes(permission)),
      hasAnyRole: (...roles) => Boolean(access?.roles.some((role) => roles.includes(role))),
    }),
    [
      access,
      error,
      loading,
      refreshAccess,
      requestPasswordReset,
      session,
      signIn,
      signOut,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
