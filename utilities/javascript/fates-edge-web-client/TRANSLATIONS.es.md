# Ayuda a traducir Fate's Edge

Puedes contribuir sin saber programar. Corregir un mensaje, revisar una tabla o
mejorar una página ya ayuda a que otra persona pueda jugar con más facilidad.

La [guía general de traducción](https://dev.fates-edge.com/translations) reúne las
prioridades de idiomas y las formas de participar. Esta página explica cómo
trabajar con los archivos en español.

## Empieza con algo pequeño

1. Elige una pantalla, una tabla o un apartado del inicio rápido.
2. Indica qué vas a revisar en las
   [discusiones del proyecto](https://github.com/Chronophage-net/fates-edge-dev/discussions).
   Así evitamos duplicar el trabajo.
3. Compara el texto con su original inglés y consulta el
   [glosario](locales/GLOSARIO.es.md).
4. Lee el resultado dentro de la pantalla o del documento. Comprueba los ejemplos
   de reglas, los enlaces y el espacio disponible para los botones.
5. Envía una solicitud de cambios o pega la corrección en la discusión. Incluye
   el nombre del archivo, la pantalla o el apartado para que podamos encontrarlo.

No hace falta encargarse de un libro entero. Tampoco necesitas una traducción
perfecta para avisarnos de que un texto resulta confuso.

## Estado de la traducción

El catálogo de la interfaz tiene una entrada para cada texto del original inglés.
El SRD, la Guía esencial y los documentos básicos disponen de versiones HTML en
español. Son traducciones iniciales asistidas por herramientas automáticas, con
correcciones específicas de terminología. **Aún necesitan una revisión editorial
completa por lectores que conozcan el idioma y las reglas.**

Tener todas las entradas no garantiza que todas las frases sean naturales o
exactas. Al contribuir, indica qué apartados has revisado y cuáles siguen pendientes.

Usamos español general. Son bienvenidas las observaciones de lectores de España,
América Latina y otras comunidades. Si una expresión solo funciona en una región,
explícalo y propón una alternativa comprensible para más lectores.

## Archivos que necesitas

Estas rutas parten de la carpeta del cliente web:

| Archivo | Uso |
| --- | --- |
| `locales/en.json` | Texto inglés de referencia |
| `locales/es.json` | Traducción de la interfaz |
| `locales/GLOSARIO.es.md` | Terminología compartida de las reglas |
| `data/docs/es/` | Copias de los documentos HTML en español |
| `TRANSLATION.md` | Guía técnica para añadir idiomas y textos nuevos |

Los documentos originales se mantienen en otro repositorio, `fates-edge-docs`.
Su carpeta `translations/es/` contiene el glosario y la correspondencia entre cada
traducción y su fuente. Si no tienes acceso, trabaja con la copia del cliente web
y envía la corrección en una discusión; el responsable actualizará el original.

## Cómo editar la interfaz

Cambia los valores, sin modificar las claves:

```json
{
  "save": "Guardar",
  "changed": "Idioma de la interfaz cambiado a {{language}}."
}
```

- Conserva exactamente los marcadores como `{{language}}` y `{{count}}`. Puedes
  moverlos dentro de la frase para que esta suene natural.
- Conserva las etiquetas HTML, los atajos de teclado, las direcciones web y los
  nombres de archivo. Una etiqueta de apertura debe conservar su cierre.
- No cambies cifras, costes ni límites.
- Mantén las entradas de singular y plural. Revisa también los mensajes de error
  y de seguridad, no solo los títulos.
- Usa la misma palabra para un botón y para las instrucciones que lo mencionan.

En la aplicación, elige **Configuración → Idioma → Español**. Visita la pantalla
que modificaste y comprueba que el texto cabe y se entiende. El contenido escrito
por los jugadores mantiene su idioma; elegir español no reescribe la campaña.

## Cómo revisar las reglas

Comprueba qué permite u obliga a hacer la frase. «Antes», «después», «puede» y
«debe» pueden cambiar una regla. Repite los cálculos de los ejemplos: el resultado,
los dados y los recursos gastados deben coincidir con el original.

Usamos **Bono** para *Boon* y **Punto narrativo** para *Story Beat*. Conservamos
`DV`, `SB` y `XP` en las fórmulas para facilitar la consulta de fichas y tablas.
Propón los cambios de glosario antes de aplicarlos a todo un libro.

Mantén los identificadores `id` de los encabezados y los destinos de los enlaces
internos. No elimines créditos ni avisos de licencia. Si dos fuentes inglesas
se contradicen, señala ambas: la traducción no debe resolver la discrepancia
cambiando las reglas por su cuenta.

## Comprobaciones para quienes usan un entorno local

Desde la carpeta del cliente web:

```bash
npm run i18n:report -- --strict
npm test
npm run build
```

Estas comprobaciones encuentran entradas ausentes y problemas estructurales.
La lectura humana sigue siendo necesaria para valorar el sentido de una frase.

## Plantilla para enviar una corrección

- Idioma y variante regional, si corresponde:
- Archivo, pantalla o apartado:
- Texto original:
- Traducción propuesta:
- Motivo del cambio:
- Comprobaciones realizadas:
- Herramientas automáticas utilizadas, si las hubo:
- Apartados que siguen pendientes de revisión:
- Nombre para los créditos (opcional):

[Abre una discusión](https://github.com/Chronophage-net/fates-edge-dev/discussions)
o participa en el [Discord](https://discord.gg/etmb7DYbj). Una explicación clara de
lo que no funciona ya es una contribución útil.
