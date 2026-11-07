# Revisión y despliegue de SkinScan

Revisión del 7 de noviembre de 2026 sobre `f963a15`, rama de origen
`leandro/perfil-personal`. Cambios en `alex/despliegue-vercel-supabase`.

## Arquitectura recomendada para este repositorio

| Servicio | Responsabilidad | Implementación encontrada |
| --- | --- | --- |
| Vercel | React, SSR y APIs de TanStack Start/Nitro | Configuración añadida para generar `.vercel/output` |
| Supabase Auth | Registro, acceso y recuperación | Cliente web y validación de tokens en servidor |
| Supabase PostgreSQL | Perfiles, categorías e historial personal | Cuatro migraciones con políticas RLS |
| Supabase Storage | Fotografías privadas por UUID del usuario | Bucket `analysis-images`, carga directa y enlaces firmados |
| AWS Lambda + ECR | Inferencia TensorFlow CPU | Handler Python y Dockerfile existentes |

Flujo: navegador → Storage privado; navegador → `/api/analyses` con token e
imagen Base64 → backend autentica → Lambda clasifica → backend guarda el
resultado → historial e informe PDF.

Vercel y Supabase cubren web y datos. La CNN necesita además un servicio que
cargue los pesos y ejecute TensorFlow. Lambda aprovecha el trabajo existente.
Un servicio Python en un contenedor persistente también puede implementar el
mismo contrato HTTP si después se necesita reducir la latencia de arranque.

## Hallazgos y límites de la revisión

- Se enlazó `bd_skin_scan` (`lzmwczcqdmsgwjprvqwb`) con Supabase CLI 3 y se
  aplicaron las cuatro migraciones el 7 de noviembre de 2026. Se verificaron
  las cinco tablas con RLS, siete categorías, trigger de perfiles, políticas
  personales y bucket privado. Las claves locales están en `.env`, excluido de
  Git. El registro, los correos y el aislamiento entre cuentas todavía requieren
  pruebas completas desde la aplicación desplegada.
- El build original forzaba `node-server`. Ahora Vercel selecciona su preset y
  conserva el servidor Node para ejecución local. El wrapper de Lovable impone
  rutas de salida propias; se especifican las de Vercel explícitamente.
- El frontend y la API permitían 4 MiB de imagen comprimida: en Base64 superaban
  los 4,5 MB de petición de Vercel. Se limitan a 3 MiB y la URL a 8192 caracteres.
  La imagen original sigue admitiendo 5 MiB y se comprime antes del envío.
- La documentación heredada afirmaba que existía un `.keras` local. No estaba
  incluido en el checkout. La ruta facilitada posteriormente es una carpeta
  Keras descomprimida; se reconstruyó localmente el ZIP `deploy/lambda/model.keras`
  con `metadata.json`, `config.json` y `model.weights.h5`. Está excluido de Git.
  Sus metadatos indican Keras 3.10.0, entrada `(None,224,224,3)`, Dense de 1024
  y salida Dense de siete unidades softmax. Esto no confirma el orden de clases
  ni la normalización del entrenamiento.
- Los notebooks suministrados respaldan RGB 224×224, interpolación nearest,
  `/255` y orden `akiec,bcc,bkl,df,mel,nv,vasc`. Se documentaron sus hashes y
  evidencias en [la revisión del entrenamiento](lambda/TRAINING_REVIEW.md).
  El supuesto test apunta a `/train` y la inferencia de ejemplo usa otra
  normalización. No usar el 98,96 % mostrado como precisión independiente;
  falta obtener el dataset original y evaluar el `.keras` recibido sobre `/test`.
- El modelo de siete clases no incorpora rechazo de imágenes ajenas a piel.
  Una imagen válida de otro objeto puede recibir una categoría dermatológica.
- La API recibe la imagen y su URL por separado; comprueba el propietario de la
  ruta, pero no que los bytes analizados coincidan con el objeto almacenado.
  Para mayor trazabilidad conviene recibir solo la ruta y leer la imagen desde
  Storage en el backend. Ese cambio queda pendiente.
- La subida precede al análisis y no hay limpieza de objetos tras errores.
  No se observó limitación de frecuencia por cuenta. Ambas tareas deben
  resolverse antes de abrir el servicio a tráfico público sin control.
- El servidor usa `service_role`, que evita RLS; los controles de identidad y
  pertenencia del backend son esenciales. Las pruebas actuales cubren parte
  de estos controles, pero no sustituyen pruebas RLS con dos cuentas reales.
- El chatbot está retirado (HTTP 410). El historial guarda análisis; no hay una
  entidad que vincule fotografías sucesivas de la misma lesión para compararlas.
- Se construyó y ejecutó la CNN real en Docker Desktop Linux/amd64 con 2 CPU
  y límite de 2 GiB: seis pruebas del adaptador y contrato con Keras pasan,
  al igual que el smoke test de pesos y la prueba HTTP en el emulador de Lambda. Primera llamada
  del handler: 5,39 s; mediana posterior: 0,22 s; pico RSS: unos 611 MiB.
  Se usó una imagen sintética: la precisión con lesiones reales sigue sin
  evaluarse. Los notebooks respaldan etiquetas y normalización. No se desplegó AWS.

## 1. Configurar Supabase

1. Crea un proyecto para desarrollo o pruebas y guarda sus claves en `.env`
   local, tomando `.env.example` como referencia. Nunca subas ese archivo.
2. En SQL Editor ejecuta, en orden y solo si aún no están aplicadas:
   - `202611060001_supabase_auth.sql`
   - `202611060002_remove_billing.sql`
   - `202611070001_remove_profile_roles.sql`
   - `202611070002_personal_accounts.sql`
   En una base existente revisa y respalda antes: estas migraciones reemplazan
   políticas y conservan datos históricos; no son una importación automática.
3. Comprueba las siete filas de `lesion_types`, las tablas `usuarios`, `analyses`
   y `analysis_attempts`, RLS habilitado y bucket privado `analysis-images`.
4. Habilita acceso por correo/contraseña. En Auth → URL Configuration configura
   Site URL con tu dominio y autoriza la URL exacta `/restablecer` del entorno.
   Para desarrollo autoriza también `http://localhost:5173/restablecer` o el
   puerto que indique Vite. Usa un dominio estable de pruebas para los correos.
5. Registra dos cuentas nuevas: cada una debe ver únicamente su historial e
   imágenes. Comprueba confirmación de correo y recuperación de contraseña.

La configuración reproducible está en `supabase/config.toml`. Incluye URLs
locales y el dominio de producción en `[remotes.production]`. La CLI conserva
las credenciales y el enlace en almacenamiento local excluido de Git. No uses
el mismo proyecto como base de staging si necesitas aislar datos de producción.

Para instalaciones con Supabase CLI 3, utiliza un destino remoto explícito:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref lzmwczcqdmsgwjprvqwb
npx.cmd supabase migration list --remote=lzmwczcqdmsgwjprvqwb
npx.cmd supabase db push --remote=lzmwczcqdmsgwjprvqwb --skip-vault --dry-run
# Solo después de revisar las migraciones pendientes:
npx.cmd supabase db push --remote=lzmwczcqdmsgwjprvqwb --skip-vault
```

`supabase config diff --remote=lzmwczcqdmsgwjprvqwb` permite revisar las URLs
antes de `config push`. No ejecutes `db reset` contra producción. En CLI 3, los
comandos de base de datos sin `--remote` apuntan a la base local.

## 2. Ejecutar y desplegar la CNN

Sigue [la guía de Lambda](lambda/README.md). El modelo local no se sube mediante
Git: el build Docker lo incorpora a la imagen que se envía al ECR privado.
No hay que volver a entrenarlo para servirlo.

Antes de crear recursos:

1. Revisa las evidencias de clases y preprocesamiento en `lambda/TRAINING_REVIEW.md`
   y obtén el dataset original para la evaluación independiente pendiente.
2. Inicia Docker Desktop con contenedores Linux.
3. Construye el contenedor, ejecuta las pruebas Python y compara predicciones
   de imágenes de test con el notebook, usando el mismo preprocesamiento.
4. Despliega ECR/Lambda y establece un `INFERENCE_API_KEY` aleatorio. La web
   debe usar el mismo valor en `SKINSCAN_INFERENCE_API_KEY`.
5. Prueba la URL con `deploy/lambda/invoke.ps1`. No envíes imágenes sensibles
   a servicios de terceros hasta haber configurado su acceso y almacenamiento.

No se han creado recursos AWS en esta revisión. Memoria, tiempo de arranque,
timeout y consumo requieren medición real; no se promete coste cero.

## 3. Conectar Vercel

1. Importa `alexcrisdev/skin-scan-pro` en Vercel. Selecciona el framework
   **TanStack Start**, Node.js **24.x**, instalación `npm ci` y build
   `npm run build`. Deja el directorio de salida con la configuración del
   framework: Nitro genera `.vercel/output`; no es una web estática.
2. Configura **Production Branch** como `main`. Usa `develop` para los
   despliegues Preview de pruebas. Ambas ramas ya están creadas en GitHub.
3. Añade las variables de la tabla. Usa un Supabase de pruebas para Preview
   cuando necesites aislar los datos de producción.

| Variable | Visibilidad | Valor |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Pública, incluida en build | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pública, incluida en build | Publishable key del proyecto |
| `SUPABASE_URL` | Solo servidor | Misma URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreta, solo servidor | Clave service_role |
| `SKINSCAN_INFERENCE_URL` | Solo servidor | URL HTTPS completa de Lambda |
| `SKINSCAN_INFERENCE_API_KEY` | Secreta, solo servidor | Token del handler de Lambda |
| `SKINSCAN_INFERENCE_TIMEOUT_MS` | Solo servidor | `70000` inicialmente |

4. Vercel aporta `VERCEL=1`; el build elige automáticamente su preset. La
   función tiene un presupuesto de 120 segundos para inferencia y persistencia.
   Si aumentas el timeout de la CNN, revisa también este presupuesto y el límite
   permitido por tu plan.
5. Despliega y añade el dominio definitivo a Supabase Auth. Cambiar variables
   requiere un nuevo despliegue; las `VITE_` se incorporan durante el build.

Para probar solo el empaquetado Vercel en PowerShell, sin publicar:

```powershell
$env:NITRO_PRESET = 'vercel'
npm.cmd run build
Remove-Item Env:NITRO_PRESET
```

Para el servidor Node normal: `npm.cmd run build` y `npm.cmd start`.

## 4. Comprobar de extremo a extremo

- Registro, confirmación, login, logout y recuperación en el dominio desplegado.
- Crear un análisis con imagen de prueba: inferencia real, registro en base,
  imagen accesible solo para el dueño, historial y PDF.
- Cuenta B no puede acceder al análisis ni a la imagen de A, ni alterando IDs.
- Sin sesión: las APIs deniegan acceso. Sin configuración CNN o ante timeout:
  aparece un error y no se inventan predicciones.
- Probar imágenes grandes y rechazadas, primera llamada en frío y llamadas
  posteriores; revisar logs sin registrar imágenes o tokens.

Las pruebas Node usan respuestas simuladas para verificar contratos y acceso.
La aceptación del servicio requiere además Supabase, Lambda y el modelo reales.
Las probabilidades del clasificador son orientativas y no certifican diagnóstico
ni rendimiento clínico.

## Referencias oficiales

- [TanStack Start: hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Nitro: Vercel](https://nitro.build/deploy/providers/vercel)
- [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations)
- [Supabase: producción](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase: buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals)
