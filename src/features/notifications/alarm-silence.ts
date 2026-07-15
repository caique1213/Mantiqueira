const ALARM_SILENCE_PREFIX = 'mantiqueira:alarm-silenced-until:';

export function alarmSilenceKey(profileId: string) {
  return `${ALARM_SILENCE_PREFIX}${profileId}`;
}

export function getAlarmSilencedUntil(profileId: string) {
  if (typeof localStorage === 'undefined' || !profileId) return 0;
  const value = Number(localStorage.getItem(alarmSilenceKey(profileId)) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function isAlarmSilenced(profileId: string) {
  return getAlarmSilencedUntil(profileId) > Date.now();
}

export function silenceAlarm(profileId: string, durationMs: number) {
  if (typeof localStorage === 'undefined' || !profileId) return 0;
  const until = Date.now() + durationMs;
  localStorage.setItem(alarmSilenceKey(profileId), String(until));
  window.dispatchEvent(new CustomEvent('alarm-silence-changed', { detail: { profileId, until } }));
  return until;
}
