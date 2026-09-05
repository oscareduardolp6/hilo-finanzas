/* Los casos de uso de plan MSI, con reloj e ids fijos. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { InstallmentPlan } from '../../../shared/domain/types';
import { createPlan } from './create-plan';
import { deletePlan, savePlan } from './save-plan';

const AHORA = 1_700_000_000_000;
const deps = createDeps({ clock: () => AHORA, idGenerator: () => 'msi_fijo' });

const laptop: InstallmentPlan = {
  id: 'msi_1', description: 'Laptop', store: 'Amazon', totalAmount: 12000,
  installmentsCount: 12, categoryId: 'compras', startDate: '2026-01-01',
  createdAt: 1, updatedAt: 1,
};

const input = {
  description: 'Audífonos', store: 'Walmart', totalAmount: 900,
  installmentsCount: 6, categoryId: 'compras', startDate: '2026-02-01',
};

describe('savePlan', () => {
  it('sin id crea el plan al final, con marcas de tiempo', () => {
    const { installmentPlans, toast } = runRIO(savePlan([laptop], input), deps);

    expect(toast).toBe('Plan creado');
    expect(installmentPlans).toEqual([
      laptop,
      { id: 'msi_fijo', ...input, createdAt: AHORA, updatedAt: AHORA },
    ]);
  });

  it('con id edita ese plan y conserva su createdAt', () => {
    const { installmentPlans, toast } = runRIO(
      savePlan([laptop], { ...input, id: 'msi_1', totalAmount: 15000 }),
      deps,
    );

    expect(toast).toBe('Plan actualizado');
    expect(installmentPlans).toHaveLength(1);
    expect(installmentPlans[0]).toMatchObject({ id: 'msi_1', totalAmount: 15000, createdAt: 1, updatedAt: AHORA });
  });

  it('admite un número fraccionario de mensualidades', () => {
    // 1.5 = pagar un cargo de TDC en 3 quincenas. Es `parseFloat`, no `parseInt`.
    const { installmentPlans } = runRIO(savePlan([], { ...input, installmentsCount: 1.5 }), deps);
    expect(installmentPlans[0]?.installmentsCount).toBe(1.5);
  });
});

describe('createPlan (alta inline desde el picker)', () => {
  it('usa un toast distinto al del formulario completo', () => {
    // No es un descuido: son dos textos distintos en el producto desde antes
    // del refactor. Unificarlos sería cambiar comportamiento.
    const inline = runRIO(createPlan([], input), deps);
    const completo = runRIO(savePlan([], input), deps);

    expect(inline.toast).toBe('Plan de MSI creado');
    expect(completo.toast).toBe('Plan creado');
  });

  it('devuelve el plan creado, que es lo que el picker necesita', () => {
    const { plan } = runRIO(createPlan([], input), deps);
    expect(plan).toEqual({ id: 'msi_fijo', ...input, createdAt: AHORA, updatedAt: AHORA });
  });
});

describe('deletePlan', () => {
  it('quita el plan y deja lápida', () => {
    const { installmentPlans, tombstones, toast } = runRIO(
      deletePlan({ installmentPlans: [laptop], tombstones: [] }, 'msi_1'),
      deps,
    );

    expect(toast).toBe('Plan eliminado');
    expect(installmentPlans).toEqual([]);
    expect(tombstones).toEqual([{ id: 'msi_1', deletedAt: AHORA }]);
  });
});
