import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DateInput } from './date-input';

describe('DateInput', () => {
  it('abre el selector nativo al tocarlo', () => {
    const { container } = render(<DateInput value="2026-01-05" onChange={() => {}} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.showPicker = vi.fn();

    fireEvent.click(input);

    expect(input.showPicker).toHaveBeenCalledOnce();
  });

  it('si showPicker falla o no existe, no revienta', () => {
    const { container } = render(<DateInput value="2026-01-05" onChange={() => {}} />);
    const input = container.querySelector('input') as HTMLInputElement;

    expect(() => fireEvent.click(input)).not.toThrow();
    input.showPicker = () => { throw new DOMException('no', 'NotAllowedError'); };
    expect(() => fireEvent.click(input)).not.toThrow();
  });

  it('entrega el valor nuevo como string', () => {
    const onChange = vi.fn();
    const { container } = render(<DateInput value="2026-01-05" onChange={onChange} />);

    fireEvent.change(container.querySelector('input') as HTMLInputElement, { target: { value: '2026-02-10' } });

    expect(onChange).toHaveBeenCalledWith('2026-02-10');
  });
});
