#!/usr/bin/env node
// Quirófano: la puerta de entrada de El Comité.
//   node bin/comite.js <cadáver> [cadáver...] [--objetivo RUTA] [--json]
import { injertos, informe } from '../src/lib/cirujano.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const iObjetivo = args.indexOf('--objetivo');
const objetivo = iObjetivo >= 0 ? args[iObjetivo + 1] : null;
const rutas = args.filter((a, i) => !a.startsWith('--') && i !== iObjetivo + 1);

if (!rutas.length) {
  console.error('uso: comite <cadáver> [cadáver...] [--objetivo RUTA] [--json]');
  process.exit(2);
}

const res = await injertos(rutas, { objetivo });
console.log(json ? JSON.stringify(res, null, 2) : informe(res));
