# CNN MobileNetV2 en AWS Lambda

Este paquete ejecuta directamente `model.keras` en CPU mediante un contenedor de Lambda. No necesitas convertir a `.tflite` para esta opción. Los pesos están excluidos de Git y deben prepararse en cada copia del repositorio.

Revisión del 7 de noviembre de 2026: la ruta proporcionada era una carpeta Keras descomprimida. Se reconstruyó localmente `model.keras` con sus tres archivos (`config.json`, `metadata.json`, `model.weights.h5`). El ZIP reconstruido pesa 43,350,323 bytes y su SHA256 es `4fb1fe0ee4bc5be18b6f4bf715637cde8fe7b7e48289b9fbf771c1c977a892dd`, registrado en `model_contract.json` como `reconstructed_archive_sha256`. La estructura coincide con la entrada RGB 224×224 y salida de siete clases; no se ejecutó TensorFlow. El código de entrenamiento no está en este checkout. Las observaciones de entrenamiento y métricas que siguen son antecedentes de la documentación heredada y requieren comprobarse con el notebook original.

## Contrato comprobado

La documentación original registraba un archivo de 43,350,323 bytes con Keras 3.10.0, entrada `(None,224,224,3)`, capa Dense de 1024 neuronas y salida Dense de 7 con softmax. Su SHA256 histórico (distinto al ZIP reconstruido) era:

```text
967aacb405145fb86fdd14b4a67261749ac1d6d8ab85155f96c71c76d231689a
```

El script de entrenamiento que compartiste establece RGB, redimensionado 224×224 y `rescale=1./255`. La interpolación predeterminada de `flow_from_directory` es `nearest`. El handler reproduce esos parámetros, con clases `akiec, bcc, bkl, df, mel, nv, vasc`, en ese orden. Las probabilidades softmax se multiplican por 100 antes de responder a la web.

Tu ejemplo final de inferencia usa `mobilenet_v2.preprocess_input`, que aplica una transformación diferente. No lo mezcles con este modelo entrenado con `/255`. Si el archivo «estable» recibió otro entrenamiento que no aparece en el código compartido, comprueba su preprocesamiento antes de usarlo.

Además, tu `test_dir` apunta a la carpeta `train`: el 98.96% mostrado es una evaluación sobre entrenamiento, no sobre test independiente. Corrige la ruta a `/test`, usa `shuffle=False` y vuelve a calcular matriz de confusión, sensibilidad por clase y AUC. La validación compartida del checkpoint seleccionado por menor `val_loss` fue aproximadamente 84.09%, no 98.96%. El modelo tampoco incluye una clase «no es piel»: una foto arbitraria válida puede producir una de las siete categorías.

## 1. Preparar Docker

Instala/abre Docker Desktop y espera a que el motor Linux esté activo. Ejecuta desde la raíz del proyecto:

```powershell
docker version
docker buildx build --platform linux/amd64 --provenance=false --load -t skinscan-cnn:latest ./deploy/lambda
```

Si vuelves a clonar el proyecto, copia tu modelo a `deploy/lambda/model.keras` antes del build. Nunca uses la carpeta `public` del frontend para los pesos.

El Dockerfile usa Python 3.12, TensorFlow CPU 2.19 y Keras 3.10. El modelo se carga con `compile=False`, no requiere GPU ni volver a descargar pesos ImageNet. Se conserva en memoria entre solicitudes del mismo contenedor.

## 2. Probar antes de subir

Pruebas del preprocesamiento, autenticación y contrato (utilizan predicción simulada):

```powershell
$lambdaSource = (Resolve-Path ./deploy/lambda).Path
docker run --rm --entrypoint python --mount "type=bind,source=$lambdaSource,target=/tests,readonly" skinscan-cnn:latest -m unittest discover -s /tests -p test_lambda.py
```

Prueba del modelo real, en dos terminales:

```powershell
# Terminal 1: usa un secreto aleatorio largo y conserva el mismo valor para la terminal 2.
$env:SKINSCAN_INFERENCE_API_KEY = 'TU_SECRETO_ALEATORIO'
docker run --rm -p 9000:8080 -e "INFERENCE_API_KEY=$env:SKINSCAN_INFERENCE_API_KEY" skinscan-cnn:latest
```

```powershell
# Terminal 2
$env:SKINSCAN_INFERENCE_API_KEY = 'EL_MISMO_SECRETO'
./deploy/lambda/invoke.ps1 -LocalRuntime -ImagePath 'C:\ruta\imagen-test.jpg'
```

Comprueba las mismas imágenes con Keras en tu notebook y con el contenedor, usando `/255`, para verificar coincidencia. Las pruebas no sustituyen la evaluación sobre el conjunto test real. El frontend comprime las fotografías antes de enviarlas: evalúa también con imágenes que hayan pasado por ese flujo.

## 3. Subir el contenedor a ECR

Requiere AWS CLI configurada con tu cuenta y permisos de ECR. Los comandos siguientes crean recursos; ejecútalos cuando estés listo para desplegar:

```powershell
$awsRegion = 'us-east-1' # Ejemplo: utiliza la misma región para ECR y Lambda.
$awsAccount = aws sts get-caller-identity --query Account --output text
$ecrRegistry = "$awsAccount.dkr.ecr.$awsRegion.amazonaws.com"
aws ecr create-repository --repository-name skinscan-cnn --region $awsRegion
aws ecr get-login-password --region $awsRegion | docker login --username AWS --password-stdin $ecrRegistry
docker tag skinscan-cnn:latest "$ecrRegistry/skinscan-cnn:v1"
docker push "$ecrRegistry/skinscan-cnn:v1"
```

Si el repositorio existe, omite `create-repository`. Para actualizaciones usa otra etiqueta y actualiza explícitamente la imagen de Lambda; cambiar una etiqueta en ECR no actualiza por sí solo la función.

## 4. Crear o actualizar Lambda

En AWS Lambda:

1. Crea una función de tipo **Container image**, selecciona la imagen de ECR y arquitectura **x86_64**, igual al build `linux/amd64`. Una función existente basada en ZIP requiere crear otra función para pasar a contenedor.
2. Asigna un rol de ejecución con permisos básicos de CloudWatch Logs. No requiere S3: el modelo viene en la imagen.
3. Configura inicialmente **2048 MB de memoria** y **60 segundos** de timeout; son puntos de partida para medir, no mínimos garantizados. Mide la primera llamada y las posteriores, y ajusta ambos. Para este timeout configura la web con 70000 ms de espera.
4. En variables de entorno añade `INFERENCE_API_KEY` con un secreto aleatorio largo. No lo incluyas en el código ni en el frontend.
5. En Configuration → Function URL crea una URL con **Auth type NONE** para este adaptador Bearer. La consola añade los permisos de invocación necesarios. El handler sigue exigiendo tu token. Sin el token devuelve 401 antes de cargar el modelo.
6. No necesitas CORS abierto: quien llama es el backend de SkinScan. `AWS_IAM` no acepta un Bearer token; si eliges IAM, debes implementar firma SigV4 en el backend antes de conectarlo.

Aunque el token se compruebe en el handler, una Function URL accesible públicamente puede recibir invocaciones no autorizadas y generar consumo. Si necesitas proteger ese acceso antes de ejecutar Lambda, usa API Gateway con un autorizador o adapta el cliente a `AWS_IAM`.

## 5. Conectar SkinScan

En `.env` local y en el entorno privado del servidor desplegado:

```env
SKINSCAN_INFERENCE_URL=https://TU_ID.lambda-url.TU_REGION.on.aws/
SKINSCAN_INFERENCE_API_KEY=EL_MISMO_VALOR_DE_INFERENCE_API_KEY
SKINSCAN_INFERENCE_TIMEOUT_MS=70000
```

Reinicia el servidor Node. No añadas `VITE_` a estas variables. Primero prueba la URL directamente:

```powershell
./deploy/lambda/invoke.ps1 -Endpoint 'https://TU_ID.lambda-url.TU_REGION.on.aws/' -ImagePath 'C:\ruta\imagen-test.jpg'
```

Después inicia sesión en SkinScan y crea un análisis para tu cuenta personal. Verifica resultados, historial e informe PDF. No se ha desplegado ninguna función ni realizado llamadas a tu AWS desde esta revisión.

## ¿Para qué sirven los archivos de tu captura?

- `convert_keras_to_tflite.py` convierte los pesos/estructura `.keras` a `.tflite`; no crea una función Lambda ni una URL.
- `mobilenetv2_model_estable.tflite` es el artefacto convertido y necesita un intérprete compatible para ejecutarse.
- No recibimos esos dos archivos, solo sus nombres en la captura. Se añadió un conversor opcional propio. No se puede certificar el contenido del conversor original sin leerlo.

El despliegue de arriba utiliza `.keras`. Si prefieres TFLite, primero genera y comprueba el archivo:

```powershell
$lambdaSource = (Resolve-Path ./deploy/lambda).Path
docker run --rm --entrypoint python --mount "type=bind,source=$lambdaSource,target=/export" skinscan-cnn:latest /export/convert_keras_to_tflite.py --model /var/task/model.keras --output /export/mobilenetv2_model_estable.tflite
```

El conversor comprueba paridad numérica con un lote sintético y exporta float32. Evalúa además un conjunto de imágenes reales. Para servir ese archivo hay que cambiar el runtime/handler a un intérprete TFLite: no basta con renombrarlo a `.keras`. No se habilitan `SELECT_TF_OPS` ni cuantización automáticamente, porque cambian compatibilidad, dependencias o precisión.

## Estado de validación local

Se inspeccionaron la estructura y metadatos del `.keras`, pero no se ejecutó TensorFlow ni se convirtió el modelo en esta máquina. Docker Desktop está instalado y su motor está detenido. Los archivos de Docker y las pruebas Python quedan preparados para ejecutarlos al iniciar el motor. Las pruebas Node del backend no ejecutan la CNN.

Referencias: [contenedores Python en Lambda](https://docs.aws.amazon.com/lambda/latest/dg/python-image.html), [Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html), [autenticación de URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html), [compatibilidad de operadores TFLite](https://developers.google.com/edge/litert/conversion/tensorflow/ops_compatibility).
