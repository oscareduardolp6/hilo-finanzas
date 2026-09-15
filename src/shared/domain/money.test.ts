import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formatea en pesos mexicanos con dos decimales', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });

  it('antepone el signo antes del $ para negativos', () => {
    expect(formatMoney(-50)).toBe('-$50.00');
  });

  it('con hidden en true devuelve el placeholder fijo, sin importar el monto', () => {
    expect(formatMoney(1234.5, true)).toBe('$••••');
    expect(formatMoney(-50, true)).toBe('$••••');
    expect(formatMoney(0, true)).toBe('$••••');
  });

  it('con hidden en false (o ausente) formatea normal', () => {
    expect(formatMoney(10, false)).toBe('$10.00');
    expect(formatMoney(10)).toBe('$10.00');
  });
});
