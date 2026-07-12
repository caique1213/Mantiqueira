import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { applyPersonalPreferences, loadPersonalPreferences } from './personal-preferences';

export function PersonalPreferencesController() {
  const auth = useAuth();
  const profileId = auth.user?.id ?? '';

  useEffect(() => {
    if (!profileId) return;

    const applyCurrent = () => applyPersonalPreferences(loadPersonalPreferences(profileId));
    applyCurrent();

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes(profileId)) applyCurrent();
    };
    const handleCustomChange = () => applyCurrent();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('personal-preferences-changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('personal-preferences-changed', handleCustomChange);
    };
  }, [profileId]);

  return null;
}
