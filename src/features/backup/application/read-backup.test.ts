/* Leer un respaldo: el archivo entra por el gateway, así que aquí no hace falta
   ni un `FileReader`. Lo que importa es que leer NO aplique nada — devolver el
   contenido es todo lo que hace. */

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import { createDeps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import type { Account, DataState } from '../../../shared/domain/types';
import { fakeFileGateway, fakeGatewayLog } from '../../../shared/infrastructure/in-memory';
import { buildExportPayload } from '../../sync/domain/payload';
import { readBackup } from './read-backup';

const cuenta: Account = { id: 'aX', name: 'Importada', type: 'debito', color: '#8D5FB0', initialBalance: 0 };

const estado: DataState = {
  accounts: [cuenta], categories: [], transactions: [], installmentPlans: [], tombstones: [],
};

const archivo = () => new File(['da igual'], 'hilo-respaldo.json', { type: 'application/json' });

const conContenido = (contents: string) =>
  createDeps({ fileGateway: fakeFileGateway(fakeGatewayLog(), contents) });

describe('readBackup', () => {
  it('devuelve las colecciones del archivo', async () => {
    const deps = conContenido(JSON.stringify(buildExportPayload(estado)));

    const result = await runRTE(readBackup(archivo()), deps);

    if (E.isLeft(result)) throw new Error('debería haber leído bien');
    expect(result.right.accounts).toEqual([cuenta]);
    expect(result.right.tombstones).toEqual([]);
  });

  it('un archivo que no es de Hilo sale por el canal de error con su mensaje', async () => {
    const deps = conContenido('{"app":"otra-cosa"}');

    const result = await runRTE(readBackup(archivo()), deps);

    expect(result).toEqual(E.left({ _tag: 'InvalidPayload', message: 'Esto no parece un export de Hilo.' }));
  });

  it('un archivo ilegible también, sin lanzar', async () => {
    const deps = createDeps({
      fileGateway: { readText: () => Promise.reject(new Error('No se pudo leer el archivo.')) },
    });

    const result = await runRTE(readBackup(archivo()), deps);

    expect(E.isLeft(result)).toBe(true);
  });
});
