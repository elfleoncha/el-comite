# El Comité 🩺

**Le das tus proyectos muertos y te dice qué órganos siguen sirviendo, y cuáles se pueden injertar en el siguiente.**

Un *órgano* es un fichero con una función clara: un `auth.js`, un esquema, un componente, un relay.
El Comité abre cada cadáver, cataloga lo que vale y cruza los órganos entre proyectos para proponer injertos con su costura.

## Qué hace

- **Patólogo** — recorre un proyecto, clasifica cada órgano por tipo (lógica, interfaz, estilo, operación, config, datos) y extrae su firma (qué exporta). Descarta stubs vacíos y volcados gigantes.
- **Cirujano** — cruza los órganos de todos los cadáveres y puntúa cada posible injerto: mismo nombre (3), misma función o familia (2), mismo tipo (0,5). Con menos de 2 puntos no hay recomendación, solo corazonada.
- **Quirófano** — la mesa de autopsia en el navegador: cadáveres, órganos y los injertos ordenados por peso.

## Cómo se monta

Sin dependencias. Node 18+.

```bash
git clone <repo> el-comite && cd el-comite

# CLI
node bin/comite.js ~/proyecto-muerto ~/otro-muerto [--objetivo ~/criatura] [--json]

# Quirófano web (puerto 4500)
COMITE_CADAVERES="$HOME/tabtools:$HOME/filerelay" node src/lib/servidor.js
# → http://localhost:4500
```

`COMITE_CADAVERES` es una lista separada por `:`. `--objetivo` es la criatura: si existe, el Cirujano propone injertos contra ella en vez de contra el cadáver más rico.

## Arquitectura

```
bin/comite.js        CLI
src/lib/patologo.js  walk + clasificación + firma de órganos
src/lib/cirujano.js  emparejamiento y puntuación de injertos
src/lib/servidor.js  http sin dependencias: /  y  /api/injertos
public/index.html    la mesa (una página, sin build)
pruebas/cirujano.mjs autochequeo (node pruebas/cirujano.mjs)
```

## Ejemplo real

```
filerelay (15 órganos) → tabtools (16 órganos)
  [3.5] extension/background.js → extension/background.js
        mismo nombre (background) + mismo tipo (lógica)
```

Y avisa cuando no hay nada: `homeark-os` (21 ficheros) → 0 órganos, nada reutilizable.

## Requisitos

Node 18+ · un navegador que soporte `fetch` (cualquiera de 2020 en adelante).

## Privacidad

Todo corre en local. El Comité solo lee los ficheros de las rutas que le pasas; no sube nada a ninguna parte.

## Roadmap

- [ ] Injetar de verdad: generar el repo de la criatura cosiendo los órganos, con las costuras marcadas
- [ ] Detectar módulos duplicados entre proyectos (filerelay y tabtools son el mismo ADN)
- [ ] Costura de imports: reescribir rutas al mover un órgano de sitio

## Licencia

MIT.
