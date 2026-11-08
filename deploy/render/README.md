# SkinScan en Render Free con LiteRT

La web continúa en Vercel y los usuarios, fotografías e historial en Supabase.
Este servicio ejecuta el TFLite suministrado sin instalar TensorFlow completo.
Está pensado para demostraciones y pruebas; falta evaluar el modelo con el
conjunto de test independiente descrito en [la revisión](../lambda/TRAINING_REVIEW.md).

## Comprobaciones realizadas

- Artefacto de 14.147.516 bytes; SHA-256 en `model_artifact.json`.
- Entrada float32 RGB 224×224, nearest, `/255`; salida de siete clases softmax.
- Ocho entradas sintéticas comparadas con el Keras recibido: diferencia máxima
  absoluta `0.000014663` (aproximadamente 0,0015 puntos porcentuales), misma
  clase ganadora. LiteRT 2.3.0 también pasa la comparación con las referencias.
- Seis pruebas Python pasan con **0,1 CPU, 512 MiB y sin swap**.
- Prueba HTTP local con esos límites: arranque, incluida descarga privada,
  **19,09 s**; mediana posterior **0,40 s**, máximo **2,49 s**; pico total del
  contenedor **91,05 MiB**. Cinco inferencias con PNG sintético, HTTP 401 sin
  token y HTTP 400 para imagen inválida. Esto no mide exactitud clínica ni
  garantiza idénticos tiempos en Render.

## 1. Archivos y modelo privado

El repositorio contiene `render.yaml`, Dockerfile y servidor, pero no los pesos
ni credenciales. El Dockerfile usa **la raíz del repositorio** como contexto.
Su archivo `.dockerignore` permite únicamente el código necesario.

El modelo revisado ya se subió al bucket **privado** `inference-models` del
proyecto `bd_skin_scan` (`lzmwczcqdmsgwjprvqwb`). No se añadieron políticas de
lectura pública ni se modificaron las tablas. El nombre del objeto contiene su
hash; el servidor comprueba tamaño y SHA-256 antes de cargarlo.

Las variables para Render están preparadas localmente en:

```text
deploy/render/.local/render.env
```

Ese archivo está excluido de Git y contiene secretos. Ábrelo localmente para
importar sus valores en Render; no lo publiques ni lo pegues en el chat.

Para repetir la preparación desde la raíz del repositorio:

```powershell
python deploy/render/prepare_model.py
# Solo si se necesita crear/verificar el bucket y subir el artefacto:
python deploy/render/prepare_model.py --upload
```

La subida exige que `SUPABASE_URL` coincida con el proyecto solicitado, nunca
sobrescribe el objeto existente y verifica su hash remoto. Los pesos locales
deben estar en `deploy/render/model.tflite` y coincidir con el manifiesto.

## 2. Crear el servicio

1. Abre [Render](https://dashboard.render.com/) e inicia sesión con GitHub.
2. Elige **New → Web Service**, conecta GitHub y concede acceso al repositorio
   **alexcrisdev/skin-scan-pro**. Selecciona ese repositorio.
3. Configura estos campos:

   | Campo | Valor |
   | --- | --- |
   | Name | `skinscan-inference` (o un nombre disponible) |
   | Language / Runtime | `Docker` |
   | Branch | `main` |
   | Region | `Virginia` |
   | Root Directory | Vacío |
   | Dockerfile Path | `./deploy/render/Dockerfile` |
   | Docker Build Context Directory | `.` |
   | Instance Type | **Free** |
   | Health Check Path | `/healthz` |

4. En **Environment Variables → Add from .env**, importa el contenido del
   archivo local `deploy/render/.local/render.env`. Si la pantalla muestra solo
   campos individuales, copia los tres valores en sus respectivos campos.
5. Pulsa **Deploy Web Service** y espera al estado **Live**. En Advanced o en
   Settings comprueba que Health Check Path sea `/healthz`.
6. Abre `https://TU-SERVICIO.onrender.com/healthz`. Debe devolver
   `{"status":"ready"}`. La raíz `/` devuelve 404 intencionalmente.

Como alternativa puedes elegir **New → Blueprint**, conectar el mismo
repositorio y rama `main`, y usar `render.yaml`. Define exactamente un servicio
Free y solicita los tres valores secretos. Utiliza una sola de estas opciones
para evitar crear servicios duplicados.

| Variable en Render | Uso |
| --- | --- |
| `INFERENCE_API_KEY` | Token aleatorio que debe coincidir con Vercel |
| `SUPABASE_URL` | Origen HTTPS de `bd_skin_scan` |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privada para descargar los pesos |

La clave de Supabase es una credencial administrativa del proyecto: permanece
en el servidor de Render y nunca se envía al navegador. El código la usa solo
para descargar el modelo al iniciar. Las imágenes de inferencia se procesan
en memoria; este servicio no las guarda ni registra su contenido.

## 3. Probar y conectar con Vercel

Desde la raíz del proyecto se puede probar el endpoint real sin mostrar tokens:

```powershell
python deploy/render/verify_http.py --endpoint https://TU-SERVICIO.onrender.com
```

Comprueba `/healthz`, rechazo sin credencial, imagen inválida y cinco inferencias
sintéticas. Lee el token del archivo local excluido de Git. No crea análisis
en la base de datos.

Después añade estas variables **Production**, solo en el proyecto SkinScan de
Vercel, y realiza un nuevo despliegue:

| Variable en Vercel | Valor |
| --- | --- |
| `SKINSCAN_INFERENCE_URL` | `https://TU-SERVICIO.onrender.com/predict` |
| `SKINSCAN_INFERENCE_API_KEY` | Mismo valor de `INFERENCE_API_KEY` de Render |
| `SKINSCAN_INFERENCE_TIMEOUT_MS` | `100000` |

No uses el prefijo `VITE_` para estas variables. Las claves de Supabase ya
configuradas en Vercel se conservan. La función de Vercel tiene un presupuesto
de 120 s; este timeout deja margen para autenticación y persistencia.

Finalmente inicia sesión en SkinScan, sube una imagen de prueba y revisa el
resultado, historial y PDF. Que el flujo funcione no valida el diagnóstico.

## Límites del plan gratuito

Render suspende el servicio tras 15 minutos sin tráfico y reactivarlo puede
tardar aproximadamente un minuto, además del arranque de la aplicación. Antes
de una demostración abre `/healthz` y espera a `ready`. Si una petición vence,
espera a que el servicio esté listo y vuelve a intentarlo.

El disco es efímero: cada reinicio descarga de nuevo aproximadamente 14 MB
desde Supabase. Esa transferencia consume su cuota; revisa el uso de ambos
proveedores. Render comparte 750 horas gratuitas por workspace al mes y aplica
límites adicionales a tráfico y builds. No se garantiza coste cero fuera de
las cuotas; no hace falta añadir una base de datos de Render.

Un worker síncrono atiende una inferencia a la vez para limitar la memoria.
La API exige Bearer token, limita el cuerpo a 6 MiB y acepta imágenes de hasta
4 MiB y 8 megapíxeles. El frontend ya limita el envío a 3 MiB comprimidos.
Antes de abrir el servicio a muchos usuarios, quedan pendientes la evaluación
independiente y los controles de frecuencia y trazabilidad señalados en la guía
general.

## Repetir pruebas locales

```powershell
docker buildx build --builder desktop-linux --platform linux/amd64 --provenance=false --load -f deploy/render/Dockerfile -t skinscan-inference:render .
$renderChecksPath = (Resolve-Path './deploy/render').Path
docker run --rm --network none --cpus 0.1 --memory 512m --memory-swap 512m --read-only --tmpfs /tmp:rw,size=64m -e MODEL_PATH=/checks/model.tflite -e INFERENCE_API_KEY=local-test-token-for-skinscan-only-123456789 --mount "type=bind,source=$renderChecksPath,target=/checks,readonly" --entrypoint python skinscan-inference:render -m unittest discover -s /checks -p test_runtime.py -v
python deploy/render/verify_http.py
```

La última orden necesita red para descargar el modelo privado; crea únicamente
un contenedor temporal de SkinScan y lo elimina al terminar.

Referencias: [Render Free](https://render.com/docs/free),
[Docker](https://render.com/docs/docker),
[Blueprint](https://render.com/docs/blueprint-spec),
[LiteRT en Python](https://ai.google.dev/edge/litert/migration).
