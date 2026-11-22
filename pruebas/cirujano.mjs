// Autochequeo de punta a punta: recorre el CLI igual que un usuario.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';

const CLI = new URL('../bin/comite.js', import.meta.url).pathname;
const correr = (...args) => JSON.parse(execFileSync('node', [CLI, ...args, '--json'], { encoding: 'utf8' }));

// Sin --objetivo se analizaban todos menos el primero (iObjetivo = -1 comía el args[0]).
const todos = correr('/home/leon/tabtools', '/home/leon/filerelay', '/home/leon/homeark-os');
assert.strictEqual(todos.cadaveres.length, 2, 'deben abrirse tabtools y filerelay');
assert.strictEqual(todos.tumbas.length, 1, 'homeark-os no tiene órganos: va a tumbas');

const top = todos.propuestas[0];
assert.ok(top.puntos >= 3, `el injerto más fuerte pesa por nombre+tipo, vino ${top.puntos}`);
assert.ok(top.razones.some((r) => r.startsWith('mismo nombre')), 'la razón principal debe ser el nombre');

// Con --objetivo el donante principal es la criatura, no el cadáver más rico.
const conObjetivo = correr('/home/leon/filerelay', '--objetivo', '/home/leon/tabtools');
assert.strictEqual(conObjetivo.base.ruta, '/home/leon/filerelay');
assert.ok(conObjetivo.propuestas.length > 0, 'con objetivo tiene que haber injertos');
assert.ok(conObjetivo.propuestas.every((p) => p.a === '/home/leon/tabtools'), 'todos van contra la criatura');

const solo = correr('/home/leon/overture-redesign');
assert.strictEqual(solo.propuestas.length, 0, 'un solo cadáver no se injerta consigo mismo');

console.log('cirujano OK ·', todos.propuestas.length, 'injertos ·', todos.tumbas.length, 'tumba ·', conObjetivo.propuestas.length, 'con objetivo');
