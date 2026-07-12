import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { STANDARD_BATTERY_POSITION_CODES } from '../../lib/physical-rules';
import { BatteryDiagram } from './BatteryDiagram';
import type { BatteryPositionDatum } from './types';

const emptyPositions: BatteryPositionDatum[] = STANDARD_BATTERY_POSITION_CODES.map((code) => ({
  code,
  asset: null,
}));

afterEach(cleanup);

describe('BatteryDiagram', () => {
  it('desenha seis esteiras de nylon e seis esteiras brancas sem reduzir a estrutura a uma lista', () => {
    const { container } = render(
      <BatteryDiagram postureNumber={27} batteryCode="B2" positions={emptyPositions} />,
    );

    expect(container.querySelectorAll('.physical-battery__nylon')).toHaveLength(6);
    expect(container.querySelectorAll('.physical-battery__white-belt')).toHaveLength(6);
    expect(screen.getByRole('img', { name: /Postura 27 · B2/ })).toBeInTheDocument();
  });

  it('mantém as oito posições técnicas padrão acessíveis e clicáveis quando vazias', () => {
    const onPositionSelect = vi.fn();
    render(<BatteryDiagram positions={emptyPositions} onPositionSelect={onPositionSelect} />);

    const motor = screen.getByRole('button', {
      name: /Motor da esteira de nylon superior.*Sem ativo instalado cadastrado/,
    });
    fireEvent.click(motor);

    expect(screen.getAllByRole('button', { name: /Sem ativo instalado cadastrado/ })).toHaveLength(
      8,
    );
    expect(onPositionSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'motor_esteira_nylon_superior',
        asset: null,
        loaded: true,
      }),
    );
  });

  it('diferencia posição não carregada de posição confirmadamente vazia', () => {
    render(<BatteryDiagram positions={[]} />);

    expect(screen.getAllByRole('button', { name: /Dados ainda não carregados/ })).toHaveLength(8);
  });
});
