// Patólogo: abre un proyecto y decide qué órganos sirven para injertar.
// Un "órgano" es un fichero o directorio reutilizable con una función clara.
import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

// Órganos que valen: código real, no basura de build.
const ORGAN_TYPES = {
  '.js': 'lógica', '.mjs': 'lógica', '.ts': 'lógica', '.tsx': 'interfaz',
  '.jsx': 'interfaz', '.py': 'lógica', '.css': 'estilo', '.html': 'interfaz',
  '.sh': 'operación', '.yml': 'config', '.yaml': 'config', '.sql': 'datos',
};
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', 'venv', '.venv', 'coverage', '.cache']);
const SKIP_EXT = new Set(['.zip', '.log', '.lock', '.map', '.min.js']);

const MAX_DEPTH = 4;

async function walk(dir, depth = 0, acc = []) {
  if (depth > MAX_DEPTH) return acc;
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      await walk(join(dir, e.name), depth + 1, acc);
    } else if (e.isFile()) {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

// Qué ofrece un órgano: `export function x`, `module.exports.x =`, `def x(`,
// `class X`, o la primera función/clase declarada. Sirve para emparejar, no
// para compilar, así que una regex basta y no arrastra un parser.
const RE_EXPORT = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
const RE_CJS = /(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g;
const RE_PY = /(?:^|\n)(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/g;

async function firmaDe(path) {
  let src;
  try { src = await readFile(path, 'utf8'); } catch { return []; }
  const nombres = new Set();
  for (const re of [RE_EXPORT, RE_CJS, RE_PY]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) && nombres.size < 12) {
      if (!m[1].startsWith('_')) nombres.add(m[1]);
    }
  }
  return [...nombres];
}

// Un órgano sano: pesa lo suficiente para tener sustancia y no es un fichero
// generado o minificado. Devuelve null si no sirve.
function assessOrgan(path, size) {
  const ext = extname(path);
  if (SKIP_EXT.has(ext) || path.endsWith('.min.js')) return null;
  const kind = ORGAN_TYPES[ext];
  if (!kind) return null;
  if (size < 400) return null;          // un stub vacío no es un órgano
  if (size > 400_000) return null;      // un volcado no es reutilizable
  // El Cirujano cruza órganos por función, no por ruta: necesita saber qué
  // exporta cada uno antes de poder emparejarlos entre proyectos distintos.
  return { path, kind, size, name: basename(path) };
}

// Corazón de la autopsia: qué queda vivo de un cadáver.
export async function autopsy(rootDir) {
  const files = await walk(rootDir);
  const organs = [];
  let scanned = 0;

  for (const f of files) {
    let s;
    try { s = await stat(f); } catch { continue; }
    scanned++;
    const organ = assessOrgan(f, s.size);
    if (organ) {
      organ.relative = f.slice(rootDir.length + 1);
      organs.push(organ);
    }
  }

  // Firma: los nombres que exporta cada órgano. Se leen aquí (y no en el
  // Cirujano) porque el patólogo es el único que abre los ficheros.
  for (const o of organs) {
    o.exports = await firmaDe(o.path);
    o.name = o.name.replace(/\.[^.]+$/, '');
  }

  const byKind = {};
  for (const o of organs) byKind[o.kind] = (byKind[o.kind] || 0) + 1;

  return {
    root: rootDir,
    scanned,
    organs: organs.sort((a, b) => b.size - a.size),
    byKind,
    // Veredicto: un proyecto sin lógica ni interfaz no tiene nada que injertar.
    salvageable: organs.some(o => o.kind === 'lógica' || o.kind === 'interfaz'),
  };
}

// Pista de qué era el proyecto, para la etiqueta del cadáver.
export async function identify(rootDir) {
  const hints = [];
  for (const f of ['package.json', 'README.md', 'requirements.txt', 'pyproject.toml']) {
    try {
      const raw = await readFile(join(rootDir, f), 'utf8');
      if (f === 'package.json') {
        const pkg = JSON.parse(raw);
        if (pkg.name) hints.push(pkg.name);
        if (pkg.description) hints.push(pkg.description.slice(0, 120));
        const deps = Object.keys(pkg.dependencies || {});
        if (deps.length) hints.push('deps: ' + deps.slice(0, 8).join(', '));
      } else {
        const first = raw.split('\n').find(l => l.trim() && !l.startsWith('#!'));
        if (first) hints.push(first.replace(/^#+\s*/, '').trim().slice(0, 120));
      }
    } catch { /* fichero ausente: no pasa nada */ }
  }
  return hints;
}
