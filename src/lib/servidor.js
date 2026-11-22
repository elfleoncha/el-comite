// Quirófano: servidor mínimo (sin dependencias) que sirve la mesa de autopsia
// y expone el JSON del Cirujano. Puerto 4500 (valen-bot usa 4477-4479).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injertos } from '../lib/cirujano.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(RAIZ, 'public');
const PUERTO = Number(process.env.COMITE_PORT ?? 4500);
// Los cadáveres se declaran por env (COMITE_CADAVERES, separados por ':') o se
// descubren en la carpeta del usuario. Sin lista fija: esto no es de una máquina.
const CADAVERES = (process.env.COMITE_CADAVERES ?? '').split(':').filter(Boolean);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

async function api() {
  return injertos(CADAVERES);
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/injertos') {
      const datos = await api();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(datos));
    }
    const fichero = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    // Sin `..`: solo se sirve lo que hay en public/.
    if (fichero.includes('..')) { res.writeHead(400); return res.end('ruta inválida'); }
    const cuerpo = await readFile(join(PUBLIC, fichero));
    const ext = fichero.slice(fichero.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
    res.end(cuerpo);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(err.message ?? err));
  }
});

servidor.listen(PUERTO, () => {
  console.log(`quirófano en http://localhost:${PUERTO} · ${CADAVERES.length} cadáveres`);
});
