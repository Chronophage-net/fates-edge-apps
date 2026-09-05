# Cliente web de Fate's Edge

El cliente web reúne personajes, dados, encuentros, magia, documentos y una mesa
virtual. Puedes trabajar con los datos guardados en tu navegador o conectarte al
servidor de campaña para compartir la partida con otras personas.

Esta es una guía de inicio en español. El [README en inglés](README.md) contiene
el inventario técnico completo de funciones y módulos.

## Iniciar el cliente

Necesitas una versión de Node.js compatible con las dependencias del proyecto y
npm. Desde la raíz del repositorio `fates-edge-apps`:

```bash
cd utilities/javascript/fates-edge-web-client
npm install
npm run dev
```

Abre la dirección que indique el servidor de desarrollo. Para preparar una
versión que puedas alojar en un servidor web:

```bash
npm run build
npm run preview
```

La compilación se guarda en `dist/`. El comando de vista previa sirve para revisar
esa compilación localmente; para alojarla, sirve los archivos de `dist/` mediante
un servidor de contenido estático.

## Elegir español

Abre **Settings → Language → Español**. A partir de entonces, la pantalla se
llamará **Configuración → Idioma**. Puedes volver a elegir inglés o pedir que el
cliente siga el idioma del navegador.

La selección modifica la interfaz. Tus nombres de personaje, notas, entradas de
la wiki y aventuras mantienen el idioma en que se escribieron. Los textos de
interfaz que aún no estén traducidos se muestran en inglés.

## Leer las reglas

En **Documentos**, busca la categoría **Español**. El orden recomendado es:

1. **Inicio rápido:** prepara una primera sesión.
2. **Guía esencial:** amplía las reglas básicas.
3. **Documento de referencia del sistema:** consulta procedimientos y tablas.
4. **Creación de personajes** y **Mecánicas básicas** de la Guía del jugador.
5. **Procedimientos básicos**, **Seguridad e inclusión** y **Sesión cero** del DJ.

Los documentos incluyen enlaces a sus originales ingleses. Las traducciones
largas son versiones iniciales asistidas por herramientas automáticas, con una
revisión editorial integral pendiente. Si una regla resulta extraña, compara el
pasaje y comunica la duda mediante la [guía de traducción](TRANSLATIONS.es.md).

## Preparar tu primera partida

Crea un personaje en **Personajes** o usa el asistente. Abre **Dados** para hacer
una tirada, y **Encuentros** o **Temporizadores** para registrar la presión de una
escena. Los documentos te permiten consultar las reglas mientras juegas.

Para compartir la mesa, configura la conexión con el
[servidor de campaña](../fates-edge-socket-server/). El cliente web y el servidor
son componentes distintos: iniciar el cliente no crea automáticamente un servidor
multijugador. Cada participante debe conectarse a la dirección y campaña correctas.

## Conservar tus datos

Los datos locales pertenecen al navegador y al perfil que estés usando. Exporta
una copia antes de borrar los datos del sitio, cambiar de dispositivo o probar
cambios importantes. La interfaz ofrece exportación e importación de datos.

La contraseña local de la pantalla de bloqueo y las credenciales del servidor
cumplen funciones distintas. Consulta [INSTALL.md](INSTALL.md) para conocer las
opciones de alojamiento y conexión.

## Seguridad en la mesa

Cualquier participante puede activar la **Tarjeta X** cuando una escena le
incomode. Pausa y habla con el grupo antes de continuar. Acordad de antemano las
Líneas y los Velos de la partida. La seguridad de las personas tiene prioridad
sobre terminar una escena.

## Ayudar a mejorar el español

Lee [TRANSLATIONS.es.md](TRANSLATIONS.es.md) y el
[glosario](locales/GLOSARIO.es.md). Puedes revisar un solo mensaje o una tabla;
no hace falta saber programar. Indica qué texto revisaste, qué propones y por qué.
Las contribuciones de distintas regiones hispanohablantes son bienvenidas.
