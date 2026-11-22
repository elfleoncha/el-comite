// Autochequeo: señales de emparejamiento y que un cadáver vacío no rompa nada.
import assert from 'node:assert';
import { injertos } from '/home/leon/el-comite/src/lib/cirujano.js';

const r = await injertos(['/home/leon/tabtools', '/home/leon/filerelay', '/home/leon/homeark-os']);
assert.ok(r.propuestas.length > 0, 'tabtools/filerelay deberían cruzarse');
const top = r.propuestas[0];
assert.ok(top.puntos >= 3, `el injerto más fuerte debe pesar por nombre+tipo, vino ${top.puntos}`);
assert.ok(top.razones.some((x) => x.startsWith('mismo nombre')), 'la razón principal debe ser el nombre');
assert.strictEqual(r.tumbas.length, 1, 'homeark-os no tiene órganos: debe aparecer en tumbas');
assert.ok(r.cadaveres.every((c) => c.organs.every((o) => Array.isArray(o.exports))), 'cada órgano lleva su firma');

const solo = await injertos(['/home/leon/overture-redesign']);
assert.strictEqual(solo.propuestas.length, 0, 'un solo cadáver no se injerta consigo mismo');

console.log('cirujano OK ·', r.propuestas.length, 'injertos ·', r.tumbas.length, 'tumba');
