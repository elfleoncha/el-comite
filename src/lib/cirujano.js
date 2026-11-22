// Cirujano: cruza los órganos de varios cadáveres y decide qué injertos tienen
// sentido. Un injerto = un órgano de un proyecto muerto que encaja en la
// criatura porque otro ya vivo hace (o necesitaría) esa misma función.
import { readFile } from 'node:fs/promises';
import { autopsy, identify } from './patologo.js';

// Peso de cada señal. El orden importa: mismo nombre > misma función conocida >
// mismo tipo. Un injerto con una sola señal débil es una corazonada; con dos es
// una recomendación.
const PESO_NOMBRE = 3;
const PESO_FUNCION = 2;
const PESO_TIPO = 0.5;

// Familias de funciones que dan sentido a un injerto: qué órganos se necesitan
// entre sí. Clave = etiqueta de la familia, valor = nombres de función típicos.
const FAMILIAS = {
  transporte: ['send', 'recv', 'publish', 'subscribe', 'relay', 'broadcast', 'emit'],
  almacen: ['save', 'load', 'read', 'write', 'store', 'persist', 'cache'],
  seguridad: ['auth', 'login', 'verify', 'token', 'hash', 'encrypt', 'pin'],
  interfaz: ['render', 'mount', 'Component', 'view', 'draw'],
  proceso: ['run', 'exec', 'spawn', 'start', 'stop', 'retry'],
};

function familiaDe(organ) {
  const nombres = organ.exports ?? [];
  for (const [familia, claves] of Object.entries(FAMILIAS)) {
    if (nombres.some((n) => claves.some((k) => n.toLowerCase().includes(k.toLowerCase())))) {
      return familia;
    }
  }
  return null;
}

// Similitud de nombres tolerante a prefijos y separadores: `sendFile` y
// `send_file` son la misma función, `sendFiles` también.
function parecido(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[_-]/g, '');
  const [x, y] = [norm(a), norm(b)];
  if (!x || !y) return false;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  return largo.startsWith(corto) && corto.length >= 4;
}

// Parecido real entre dos ficheros: líneas distintas sobre el total. Se usa para
// no vender como "injerto" lo que en realidad es el mismo fichero copiado (un
// popup.html que solo cambia el <title>), y para medir la costura de un injerto.
async function diferencia(a, b) {
  let x = '';
  let y = '';
  try { [x, y] = await Promise.all([readFile(a, 'utf8'), readFile(b, 'utf8')]); } catch { return null; }
  const la = x.split('\n');
  const lb = y.split('\n');
  if (!la.length && !lb.length) return { ratio: 0, total: 0 };
  const larga = new Set(la);
  const distintas = lb.filter((l) => !larga.has(l)).length;
  return { ratio: distintas / Math.max(la.length, lb.length), total: Math.max(la.length, lb.length) };
}

/**
 * Puntúa un injerto entre dos órganos.
 * Devuelve 0 si no hay ninguna razón para emparejarlos.
 */
function puntuar(donante, receptor) {
  let puntos = 0;
  const razones = [];

  if (donante.name === receptor.name) {
    puntos += PESO_NOMBRE;
    razones.push(`mismo nombre (${donante.name})`);
  } else {
    const par = (donante.exports ?? []).find((e) => (receptor.exports ?? []).some((r) => parecido(e, r)));
    if (par) {
      puntos += PESO_FUNCION;
      razones.push(`misma función (${par})`);
    }
  }

  const fa = familiaDe(donante);
  const fb = familiaDe(receptor);
  if (fa && fa === fb) {
    puntos += PESO_FUNCION;
    razones.push(`misma familia (${fa})`);
  }

  if (donante.kind === receptor.kind) {
    puntos += PESO_TIPO;
    razones.push(`mismo tipo (${donante.kind})`);
  }

  return puntos >= PESO_FUNCION ? { puntos, razones } : null;
}

/**
 * Autopsia de varios cadáveres + propuesta de injertos.
 * `objetivo` es la carpeta de la criatura (puede no existir todavía: en ese caso
 * se propone un esqueleto a partir del cadáver más rico).
 */
export async function injertos(rutas, { objetivo = null, minPuntos = 2 } = {}) {
  const cadaveres = [];
  const tumbas = []; // los que no tienen nada que injertar: se dicen, no se esconden
  for (const ruta of rutas) {
    const [r, pista] = await Promise.all([autopsy(ruta), identify(ruta)]);
    if (!r.salvageable) { tumbas.push({ ruta, scanned: r.scanned }); continue; }
    cadaveres.push({ ruta, pista, ...r });
  }
  // El más rico manda como receptor: es el que más cerca está de ser criatura.
  cadaveres.sort((a, b) => b.organs.length - a.organs.length);
  const base = cadaveres[0];
  if (!base) return { cadaveres, tumbas, base: null, propuestas: [] };

  // Órganos de la criatura: los del objetivo si existe, o los del receptor.
  let receptores = base.organs;
  if (objetivo) {
    const r = await autopsy(objetivo);
    if (r.salvageable) receptores = r.organs;
  }
  const receptorRuta = objetivo ?? base.ruta;

  const propuestas = [];
  let descartados = 0;
  for (const cad of cadaveres) {
    if (cad.ruta === receptorRuta) continue;
    for (const donante of cad.organs) {
      let mejor = null;
      for (const receptor of receptores) {
        const p = puntuar(donante, receptor);
        if (p && (!mejor || p.puntos > mejor.puntos)) mejor = { ...p, receptor };
      }
      if (mejor && mejor.puntos >= minPuntos) {
        // Mismo contenido = no hay nada que injertar, hay un duplicado.
        const dif = await diferencia(donante.path, mejor.receptor.path);
        if (dif && dif.ratio < 0.15) { descartados++; continue; }
        propuestas.push({
          // Lo que la criatura ya exporta: la costura de verdad es qué nombres
          // se rompen al sustituir el órgano viejo por el nuevo.
          rotos: (mejor.receptor.exports ?? [])
            .filter((n) => !(donante.exports ?? []).some((d) => d === n || parecido(d, n))),
          comparte: (mejor.receptor.exports ?? [])
            .filter((n) => (donante.exports ?? []).some((d) => d === n || parecido(d, n))),
          diferencia: dif,
          donante: donante.relative,
          de: cad.ruta,
          a: receptorRuta,
          reemplaza: mejor.receptor.relative,
          puntos: mejor.puntos,
          razones: mejor.razones,
          // Costura: lo que hay que tocar al coserlo.
          costura: {
            quita: `${mejor.receptor.relative} (${mejor.receptor.size} B)`,
            pone: `${donante.relative} (${donante.size} B)`,
            ahorro: mejor.receptor.size - donante.size,
          },
        });
      }
    }
  }

  propuestas.sort((a, b) => b.puntos - a.puntos || b.costura.ahorro - a.costura.ahorro);
  const conCostura = propuestas.filter((p) => (p.rotos ?? []).length === 0).length;
  return {
    cadaveres, tumbas, base, propuestas,
    resumen: { total: propuestas.length, conCostura, duplicados: descartados },
  };
}

/** Resumen en texto para la consola del quirófano. */
export function informe({ cadaveres, tumbas = [], base, propuestas }) {
  const lineas = [];
  lineas.push(`CADÁVERES (${cadaveres.length})`);
  for (const c of cadaveres) {
    const marca = c === base ? ' ← donante principal' : '';
    lineas.push(`  ${String(c.organs.length).padStart(3)} órganos  ${c.ruta.split('/').pop()}${marca}`);
  }
  for (const t of tumbas) {
    lineas.push(`  ${String(0).padStart(3)} órganos  ${t.ruta.split('/').pop()} (${t.scanned} ficheros, nada reutilizable)`);
  }
  lineas.push('', `INJERTOS PROPUESTOS (${propuestas.length})`);
  if (propuestas.length) {
    // Lo que de verdad se cosería: una línea por procedimiento, sin repetir el tipo.
    const cab = '  PESO  DONANTE (de)  ->  REEMPLAZA';
    lineas.push(cab, '  ' + '-'.repeat(cab.length - 2));
  }
  for (const p of propuestas.slice(0, 15)) {
    const de = p.de.split('/').pop();
    lineas.push(`  ${String(p.puntos).padStart(4)}  ${p.donante}
          de ${de} · ${p.razones.join(' + ')}`);
  }
  if (!propuestas.length) lineas.push('  ninguno: estos cadáveres no comparten función.');
  return lineas.join('\n');
}
