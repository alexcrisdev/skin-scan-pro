# SkinScan

Para la revisión actual del repositorio y los pasos de Vercel + Supabase + CNN,
consulta [la guía de despliegue](deploy/DEPLOYMENT.md). Distingue la preparación
local de los servicios y predicciones que aún requieren validación real.

Para la opción gratuita de demostración, la [guía de Render + LiteRT](deploy/render/README.md)
incluye la API preparada, las mediciones bajo 512 MiB y los pasos para conectarla
con Vercel. Los pesos se mantienen en Storage privado de Supabase.

Aplicación React 19 y TanStack Start para clasificar imágenes de lesiones cutáneas mediante una CNN externa. Usa Supabase Auth, PostgreSQL y Storage privado. Cada cuenta es personal, con acceso a sus propios análisis, historial e informes PDF, sin planes ni cobros.

La clasificación sirve de apoyo a una evaluación profesional; el porcentaje del modelo no constituye un diagnóstico.

Al abrir `/` se muestra directamente `/app`. Sin sesión, el panel funciona como vista previa vacía; las APIs siguen exigiendo autenticación para operar sobre datos. El login permanece en `/login` y la presentación en `/presentacion`. No hay roles de usuario asociados a planes. Para una base existente, aplica también `202611070001_remove_profile_roles.sql`.

## Configuración local

1. Instala Node.js 22.12+ y ejecuta `npm install`.
2. Copia `.env.example` a `.env` y configura las claves de Supabase.
3. Revisa y ejecuta las migraciones pendientes de `supabase/migrations` en orden, sin repetir las ya aplicadas. Incluyen las tablas, el trigger de perfiles, políticas RLS y Storage privado. La última, `202611070002_personal_accounts.sql`, retira el acceso a pacientes y limita las lecturas al historial personal.
4. En Supabase Auth habilita email/contraseña, configura Site URL y autoriza `http://localhost:5173/restablecer` para la recuperación. Ajusta el puerto al que muestre Vite y agrega el dominio real al desplegar.
5. Configura `SKINSCAN_INFERENCE_URL` para habilitar los análisis y ejecuta `npm run dev`.

`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` son públicas y se configuran antes del build. `SUPABASE_SERVICE_ROLE_KEY` y la credencial de inferencia pertenecen exclusivamente al servidor y se leen en tiempo de ejecución. No las prefijes con `VITE_`.

El registro crea el perfil mediante un trigger e inicia sesión directamente. La confirmación de correo está deshabilitada en `bd_skin_scan` y en `supabase/config.toml`: el alta no envía un enlace de activación. La recuperación de contraseña sigue usando correo y redirige a `/restablecer`.

El registro solicita nombre, correo y contraseña, sin rol ni perfil médico. Los análisis nuevos quedan asociados a la identidad autenticada, sin seleccionar otra persona. Se retiraron Gestión de personas, sus APIs y los filtros de pacientes del historial. Los registros antiguos asociados a pacientes se conservan para revisión administrativa y no se reasignan a la cuenta ni aparecen como análisis propios.

## Migración de datos existentes

Respalda la base y revisa el SQL: reemplaza las políticas de las tablas de la aplicación y limita las escrituras del navegador al nombre del perfil. Si tu esquema tiene columnas adicionales obligatorias o políticas compartidas con otras aplicaciones, adapta la migración antes de ejecutarla.

Se conservan los IDs internos de perfiles, pacientes e historial. Se añade `usuarios.auth_user_id`, una referencia UUID a `auth.users`. No se convierten identificadores antiguos en UUID ni se migran contraseñas automáticamente.

Para conservar cuentas existentes, importa o crea las identidades en Supabase Auth **antes de instalar el nuevo trigger**, verifica la correspondencia y prepara una asignación explícita entre cada perfil y su UUID de Auth. Después aplica la migración y actualiza `auth_user_id` mediante una operación administrativa revisada. Las contraseñas requieren una importación compatible o recuperación. No enlaces automáticamente identidades solo por coincidencia de email. El campo histórico `firebase_uid` se conserva para conciliación y deja de ser obligatorio; la aplicación ya no lo consulta.

Las imágenes antiguas tampoco se trasladan automáticamente: cópialas al bucket privado y actualiza `analyses.image_url` con una URL firmada de Supabase. La interfaz renueva los enlaces al abrir las imágenes. El endpoint de descarga solo sirve archivos del bucket configurado.

## Contrato HTTP de la CNN

El navegador llama a `/api/analyses` con el token de Supabase. El backend comprueba identidad y pertenencia del paciente; después llama al endpoint del modelo. No utiliza un SDK del proveedor de inferencia.

| Variable del servidor           | Uso                                        |
| ------------------------------- | ------------------------------------------ |
| `SKINSCAN_INFERENCE_URL`        | URL completa del endpoint POST             |
| `SKINSCAN_INFERENCE_API_KEY`    | Bearer token opcional para el servicio CNN |
| `SKINSCAN_INFERENCE_TIMEOUT_MS` | Predeterminado 70000; máximo 300000        |

Solicitud del backend al modelo:

```json
{ "mime": "image/jpeg", "image": "BASE64_SIN_PREFIJO_DATA_URI" }
```

Respuesta (porcentajes entre 0 y 100):

```json
{
  "status": "success",
  "confianza_porcentajes": { "nv": 85, "mel": 15 }
}
```

Clases admitidas: `nv`, `mel`, `bkl`, `bcc`, `akiec`, `vasc`, `df`. Deben corresponder a las clases y al orden de salida del entrenamiento real. `interpretacion_ia` es opcional: si falta, se usa un texto fijo, sin servicio generativo. Para una imagen rechazada devuelve `{"status":"error","message":"Motivo"}`.

Se preparó un contenedor para el modelo MobileNetV2 proporcionado: RGB 224×224, normalización `/255` y siete clases softmax. Los pesos se copiaron localmente a `deploy/lambda/model.keras` y están excluidos de Git. Sin endpoint la aplicación indica que el modelo no está configurado; no genera predicciones simuladas.

## Lambda y eliminación de pagos

Se retiraron el SDK, servicios de cobro, webhook, recibos, planes e historial de pagos. No hay restricciones por suscripción ni cuotas de análisis. La segunda migración conserva los registros históricos de facturación en la base existente. Si tenías suscripciones activas en el proveedor externo, debes cancelarlas allí para detener los cobros.

La [guía de Lambda](deploy/lambda/README.md) incluye Dockerfile, contrato, pruebas Python, prueba HTTP y pasos de ECR/Function URL. Ejecuta `.keras` directamente; convertir a `.tflite` es opcional.

## Verificación y despliegue

```bash
npm run typecheck
npm test
npm run build
npm start
```

Se genera un servidor Nitro para Node en `.output/server/index.mjs`. Despliega el servidor completo: las APIs y conexión CNN requieren backend. `npm run lint` ejecuta ESLint. npm y `package-lock.json` son el gestor y lockfile de referencia.

Validación local: TypeScript, las cinco pruebas de contrato/acceso/vista previa y el build de producción pasan. El lint global aún tiene incidencias de formato y usos de `any` en la interfaz existente. La migración SQL, los correos y predicciones requieren validación contra los servicios reales. La instalación también reportó avisos de seguridad en dependencias; revisa `npm audit` antes de producción.

Para ejecutar el modelo en Lambda, sigue [estos pasos](deploy/lambda/README.md). El contenedor con TensorFlow CPU y los pesos `.keras` ya ejecutó inferencias reales localmente: pasan seis pruebas Python, el smoke test del modelo y la prueba HTTP del emulador. Los notebooks suministrados respaldan etiquetas y preprocesamiento; la [revisión del entrenamiento](deploy/lambda/TRAINING_REVIEW.md) documenta un test que apunta al entrenamiento y una inferencia de ejemplo con normalización distinta. Faltan el dataset de test independiente y el despliegue en AWS. Las pruebas sintéticas no validan precisión clínica.

# skin-scan-pro
