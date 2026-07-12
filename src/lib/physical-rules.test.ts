import { batteryCountForPosture, POSTURE_LAYOUT, validateOfficialLayout } from './physical-rules';

describe('regras físicas não negociáveis', () => {
  it('preserva a matriz oficial de 15 por 4 com 48 posturas e 12 vazios', () => {
    expect(validateOfficialLayout()).toMatchObject({
      rows: 15,
      columns: 4,
      populatedSlots: 48,
      emptySlots: 12,
      uniquePostures: 48,
    });
  });

  it('mantém 48, 47 e 46 nas três linhas inferiores da primeira coluna', () => {
    expect(POSTURE_LAYOUT.slice(-3)).toEqual([
      [48, null, null, null],
      [47, null, null, null],
      [46, null, null, null],
    ]);
  });

  it('calcula exatamente as quantidades de baterias', () => {
    expect(batteryCountForPosture(1)).toBe(4);
    expect(batteryCountForPosture(44)).toBe(4);
    expect(batteryCountForPosture(45)).toBe(5);
    expect(batteryCountForPosture(46)).toBe(6);
    expect(batteryCountForPosture(48)).toBe(6);
    expect(
      Array.from({ length: 48 }, (_, index) => batteryCountForPosture(index + 1)).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(199);
  });

  it('rejeita posturas inexistentes', () => {
    expect(() => batteryCountForPosture(0)).toThrow(RangeError);
    expect(() => batteryCountForPosture(49)).toThrow(RangeError);
  });
});
