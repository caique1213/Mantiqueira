export const POSTURE_LAYOUT = [
  [null, 36, 24, 12],
  [null, 35, 23, 11],
  [null, 34, 22, 10],
  [45, 33, 21, 9],
  [44, 32, 20, 8],
  [43, 31, 19, 7],
  [42, 30, 18, 6],
  [41, 29, 17, 5],
  [40, 28, 16, 4],
  [39, 27, 15, 3],
  [38, 26, 14, 2],
  [37, 25, 13, 1],
  [48, null, null, null],
  [47, null, null, null],
  [46, null, null, null],
] as const;

export const STANDARD_BATTERY_POSITION_CODES = [
  'motor_elevador',
  'redutor_elevador',
  'motor_racao',
  'redutor_racao',
  'motor_esteira_branca_superior',
  'motor_esteira_branca_inferior',
  'motor_esteira_nylon_superior',
  'motor_esteira_nylon_inferior',
] as const;

export function batteryCountForPosture(postureNumber: number): number {
  if (!Number.isInteger(postureNumber) || postureNumber < 1 || postureNumber > 48) {
    throw new RangeError('A postura deve ser um número inteiro entre 1 e 48.');
  }
  if (postureNumber === 45) return 5;
  if (postureNumber >= 46) return 6;
  return 4;
}

export function validateOfficialLayout() {
  const flattened = POSTURE_LAYOUT.flat();
  const numbers = flattened.filter((value) => value !== null) as number[];
  return {
    rows: POSTURE_LAYOUT.length,
    columns: POSTURE_LAYOUT[0].length,
    populatedSlots: numbers.length,
    emptySlots: flattened.length - numbers.length,
    uniquePostures: new Set(numbers).size,
    orderedPostures: [...numbers].sort((a, b) => a - b),
  };
}
