import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POSTURE_LAYOUT } from '../../lib/physical-rules';
import { PostureMap } from './PostureMap';

afterEach(cleanup);

describe('PostureMap', () => {
  it('preserva os 60 slots, incluindo os 12 vazios físicos', () => {
    const { container } = render(<PostureMap postures={[]} />);

    expect(screen.getAllByRole('gridcell')).toHaveLength(60);
    expect(container.querySelectorAll('.physical-map__slot--empty')).toHaveLength(12);
    expect(screen.getAllByRole('button', { name: /^Postura \d+/ })).toHaveLength(48);
  });

  it('mantém 48, 47 e 46 nas três últimas linhas da primeira coluna', () => {
    const { container } = render(<PostureMap postures={[]} />);
    const rows = container.querySelectorAll('.physical-map__row');

    expect(within(rows[12] as HTMLElement).getByRole('button')).toHaveTextContent('48');
    expect(within(rows[13] as HTMLElement).getByRole('button')).toHaveTextContent('47');
    expect(within(rows[14] as HTMLElement).getByRole('button')).toHaveTextContent('46');
    expect(POSTURE_LAYOUT[12]?.[0]).toBe(48);
  });

  it('entrega o número físico e null quando os dados não foram carregados', () => {
    const onPostureSelect = vi.fn();
    render(<PostureMap postures={[]} onPostureSelect={onPostureSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Postura 27.*Dados não carregados/ }));

    expect(onPostureSelect).toHaveBeenCalledWith(27, null);
  });
});
