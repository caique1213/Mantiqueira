import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { applyPersonalPreferences, loadPersonalPreferences } from './personal-preferences';

export function PersonalPreferencesController() {
  const auth = useAuth();
  const profileId = auth.user?.id ?? '';

  useEffect(() => {
    if (!profileId) return;

    let applying = false;
    const applyCurrent = () => applyPersonalPreferences(loadPersonalPreferences(profileId));
    applyCurrent();
    window.setTimeout(applyCurrent, 0);
    window.setTimeout(applyCurrent, 350);

    const handleStorage = (event: StorageEvent) => {
      if (event.key?.includes(profileId)) applyCurrent();
    };
    const handleCustomChange = () => applyCurrent();
    const observer = new MutationObserver(() => {
      if (applying) return;
      applying = true;
      window.setTimeout(() => {
        applyCurrent();
        applying = false;
      }, 0);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme-id', 'data-theme-mode'],
    });

    window.addEventListener('storage', handleStorage);
    window.addEventListener('personal-preferences-changed', handleCustomChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('personal-preferences-changed', handleCustomChange);
    };
  }, [profileId]);

  return null;
}
