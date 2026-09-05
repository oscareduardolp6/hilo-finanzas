/* Leer el CSV, con el archivo entrando por el gateway. Lo que se prueba aquí
   son las tres salidas que la hoja distingue: revisión lista, "no es de
   Monefy" y "no tiene movimientos" — que son mensajes distintos a propósito. */

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import { createDeps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import { fakeFileGateway, fakeGatewayLog } from '../../../shared/infrastructure/in-memory';
import { readMonefyFile } from './read-monefy-file';

const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';

const CSV = [
  HEADER,
  '01/03/2024,Efectivo,Comida,-180.00,MXN,-180.00,MXN,Tacos',
  "02/03/2024,Efectivo,\"To 'NU'\",-500.00,MXN,-500.00,MXN,Pago de tarjeta",
  "02/03/2024,NU,\"From 'Efectivo'\",500.00,MXN,500.00,MXN,Pago de tarjeta",
].join('\n');

const archivo = () => new File(['da igual'], 'monefy.csv', { type: 'text/csv' });

const conContenido = (contents: string) =>
  createDeps({ fileGateway: fakeFileGateway(fakeGatewayLog(), contents) });

describe('readMonefyFile', () => {
  it('devuelve la revisión: cuentas detectadas, rango y transferencias apareadas', async () => {
    const result = await runRTE(readMonefyFile(archivo()), conContenido(CSV));

    if (E.isLeft(result)) throw new Error('debería haber leído bien');
    const preview = result.right;
    expect(preview.accounts.map(a => a.name)).toEqual(['Efectivo', 'NU']);
    expect(preview.dateRange).toEqual({ min: '2024-03-01', max: '2024-03-02' });
    // Las dos patas de la transferencia cuentan como un solo movimiento.
    expect(preview.transferCount).toBe(1);
    expect(preview.transactionCount).toBe(2);
  });

  it('un archivo que no es de Monefy dice dónde mirar', async () => {
    const result = await runRTE(readMonefyFile(archivo()), conContenido('a,b,c\n1,2,3'));

    expect(result).toEqual(E.left({
      _tag: 'CsvParseError',
      message: 'Este archivo no parece un export CSV de Monefy (revisa el encabezado de columnas).',
    }));
  });

  it('un CSV de Monefy vacío es otro caso, con otro mensaje', async () => {
    const result = await runRTE(readMonefyFile(archivo()), conContenido(HEADER));

    expect(result).toEqual(E.left({ _tag: 'CsvParseError', message: 'El archivo no tiene movimientos.' }));
  });
});
