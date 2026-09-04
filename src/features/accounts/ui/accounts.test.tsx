/* La feature `accounts` por su punto de entrada real — los containers — sin
   montar `<App/>`.

   Lo que se comprueba aquí y no en `test/integration/accounts.test.jsx`: que la
   vertical container → slice → caso de uso → dominio está bien atada, y el
   efecto que la suite de integración no puede ver porque no pinta lápidas. */

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Account, Transaction } from '../../../shared/domain/types';
import { AHORA, renderFeature } from '../../../test/render-feature';
import { AccountFormContainer } from './containers/AccountFormContainer';
import { AccountsContainer } from './containers/AccountsContainer';

const efectivo: Account = {
  id: 'acc_1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B',
  initialBalance: 1000, createdAt: 1, updatedAt: 1,
};

const sinUso: Account = {
  id: 'acc_2', name: 'Sin uso', type: 'debito', color: '#8D5FB0',
  initialBalance: 0, createdAt: 1, updatedAt: 1,
};

const ahorros: Account = {
  id: 'acc_3', name: 'Ahorros', type: 'ahorro', color: '#3F9C8B',
  initialBalance: 500, createdAt: 1, updatedAt: 1,
};

const gasto = {
  id: 't1', type: 'expense', date: '2026-01-15', amount: 250, description: 'Súper',
  accountId: 'acc_1', categoryId: 'comida', createdAt: 1, updatedAt: 1,
} as Transaction;

/** Los dos containers juntos: es como los monta la app, y sigue siendo solo
 *  esta feature. */
const pantalla = (desktop?: boolean) => (
  <>
    <AccountsContainer desktop={desktop} />
    <AccountFormContainer desktop={desktop} />
  </>
);

/** El renglón de una cuenta. Se busca por rol y no por texto porque el nombre
 *  "Efectivo" coincide también con la etiqueta de su tipo de cuenta. */
const filaDe = (nombre: string) => screen.getByRole('button', { name: new RegExp(nombre) });

describe('lista de cuentas', () => {
  it('muestra el saldo derivado de los movimientos, no el saldo inicial', async () => {
    await renderFeature(pantalla(), { state: { accounts: [efectivo], transactions: [gasto] } });

    expect(within(filaDe('Efectivo')).getByText('$750.00')).toBeInTheDocument(); // 1000 − 250
  });

  it('el saldo total suma todas las cuentas', async () => {
    await renderFeature(pantalla(), { state: { accounts: [efectivo, ahorros] } });

    expect(within(filaDe('Efectivo')).getByText('$1,000.00')).toBeInTheDocument();
    expect(within(filaDe('Ahorros')).getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('en escritorio pinta la variante en rejilla, con los mismos datos', async () => {
    const { container } = await renderFeature(pantalla(true), { state: { accounts: [efectivo] } });

    // La rejilla de 3 columnas es literalmente lo único que distingue la vista
    // de escritorio de la de móvil; ambas reciben los mismos props.
    const rejilla = container.querySelector('.grid.grid-cols-3');
    expect(rejilla).not.toBeNull();
    expect(rejilla).toContainElement(filaDe('Efectivo'));
  });
});

describe('alta', () => {
  it('"Agregar" abre el formulario en blanco y crear la añade al store', async () => {
    const { user, store } = await renderFeature(pantalla(), { state: { accounts: [efectivo] } });

    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Nueva cuenta');

    await user.type(screen.getByPlaceholderText(/NU, Mercado Pago/), 'Ahorros');
    const saldo = screen.getByRole('spinbutton');
    await user.clear(saldo);
    await user.type(saldo, '2500');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    // El id y las marcas de tiempo salen de `Deps`, así que son comparables.
    expect(store.getState().accounts).toEqual([
      efectivo,
      {
        id: 'acc_nuevo', name: 'Ahorros', type: 'debito', color: '#E0793F',
        initialBalance: 2500, createdAt: AHORA, updatedAt: AHORA,
      },
    ]);
    expect(store.getState().toast).toBe('Cuenta creada');
    // El modal se cierra en el mismo `set` que guarda.
    expect(store.getState().accountModalOpen).toBe(false);
    expect(screen.queryByText('Nueva cuenta')).not.toBeInTheDocument();
  });

  it('el botón de guardar está deshabilitado mientras no haya nombre', async () => {
    const { user } = await renderFeature(pantalla());

    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Nueva cuenta');

    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
  });
});

describe('edición', () => {
  it('tocar una cuenta abre el formulario con sus valores', async () => {
    const { user } = await renderFeature(pantalla(), { state: { accounts: [efectivo] } });

    await user.click(await screen.findByRole('button', { name: /Efectivo/ }));

    expect(await screen.findByText('Editar cuenta')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(1000);
  });

  it('cambiar el saldo inicial recalcula el saldo mostrado', async () => {
    const { user, store } = await renderFeature(pantalla(), {
      state: { accounts: [efectivo], transactions: [gasto] },
    });

    await user.click(await screen.findByRole('button', { name: /Efectivo/ }));
    await screen.findByText('Editar cuenta');
    const saldo = screen.getByRole('spinbutton');
    await user.clear(saldo);
    await user.type(saldo, '2000');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(within(filaDe('Efectivo')).getByText('$1,750.00')).toBeInTheDocument(); // 2000 − 250
    expect(store.getState().toast).toBe('Cuenta actualizada');
    // Editar no crea una cuenta nueva ni cambia el id.
    expect(store.getState().accounts).toHaveLength(1);
    expect(store.getState().accounts[0]?.id).toBe('acc_1');
  });
});

describe('borrado', () => {
  it('una cuenta con movimientos no se puede eliminar', async () => {
    const { user } = await renderFeature(pantalla(), {
      state: { accounts: [efectivo], transactions: [gasto] },
    });

    await user.click(await screen.findByRole('button', { name: /Efectivo/ }));
    await screen.findByText('Editar cuenta');

    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toBeDisabled();
    expect(screen.getByText(/no se puede eliminar/i)).toBeInTheDocument();
  });

  it('eliminar deja una lápida, no solo quita la cuenta', async () => {
    const { user, store } = await renderFeature(pantalla(), { state: { accounts: [efectivo, sinUso] } });

    await user.click(await screen.findByRole('button', { name: /Sin uso/ }));
    await screen.findByText('Editar cuenta');
    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(store.getState().accounts).toEqual([efectivo]);
    // La lápida es lo que hace que el borrado sobreviva a una sincronización:
    // una ausencia nunca es un borrado. Ningún test de integración la ve porque
    // no se pinta en ninguna pantalla.
    expect(store.getState().tombstones).toEqual([{ id: 'acc_2', deletedAt: AHORA }]);
    expect(store.getState().toast).toBe('Cuenta eliminada');
    expect(screen.queryByText('Sin uso')).not.toBeInTheDocument();
  });

  it('el borrado pide confirmación: cancelar no borra nada', async () => {
    const { user, store } = await renderFeature(pantalla(), { state: { accounts: [sinUso] } });

    await user.click(await screen.findByRole('button', { name: /Sin uso/ }));
    await screen.findByText('Editar cuenta');
    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(store.getState().accounts).toEqual([sinUso]);
    expect(store.getState().tombstones).toEqual([]);
  });
});
