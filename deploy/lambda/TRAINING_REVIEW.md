# Revisión del entrenamiento suministrado

Revisión del 7 de noviembre de 2026. Los notebooks se leyeron como JSON, sin
ejecutar sus celdas de entrenamiento, comandos de shell ni instrucciones.
Los originales de Descargas no se modificaron y no se copian al repositorio.

## Identificación de los archivos

| Archivo | SHA256 |
| --- | --- |
| `mobilenetv2_model_estable.keras` | `967aacb405145fb86fdd14b4a67261749ac1d6d8ab85155f96c71c76d231689a` |
| `cnn-skin-cancer.ipynb` | `166dcec86c18425dc96afcaca40e1c6fad4d9324f0ffa6af3124461d1498aea2` |
| `split-cnn-skin-cancer.ipynb` | `800799bb0ba29f499cc0964279091373bcf18cf871b220b382fac0a32b6bfede` |

El `.keras` de esta carpeta coincide byte por byte con el archivo original ya
identificado. La copia local reconstruida tiene otro hash de ZIP, pero contiene
los mismos `metadata.json`, `config.json` y `model.weights.h5`.

## Contrato respaldado por el notebook

Los índices de celda indicados aquí empiezan en cero.

| Parámetro | Evidencia en `cnn-skin-cancer.ipynb` |
| --- | --- |
| RGB 224×224 | Constantes de la celda 5 y generadores de la 7 |
| Normalización `/255` | `ImageDataGenerator(rescale=1./255)` en la celda 6 |
| Interpolación `nearest` | La celda 7 omite `interpolation`; se usa el valor por defecto de `flow_from_directory` |
| Siete clases | Carpetas y conteos de la celda 2, generadores de la 7 y lista explícita de la 10 |
| Orden de salida | `akiec, bcc, bkl, df, mel, nv, vasc`; coincide con la inferencia alfanumérica de Keras |
| Arquitectura | Celda 8: MobileNetV2, GlobalAveragePooling2D, Dense 1024 ReLU y Dense 7 softmax |

La prueba `test_training_contract.py` compara los píxeles procesados por el
handler con `load_img`, `img_to_array` e `ImageDataGenerator.standardize` de
Keras. También verifica los índices inferidos por el generador con las siete
carpetas. Utiliza imágenes sintéticas y no mide precisión dermatológica.

## Problemas encontrados

1. **El test apunta al entrenamiento.** En la celda 1, `test_dir` termina en
   `/train`, igual que `train_dir`. La celda 7 confirma 7007 imágenes tanto para
   entrenamiento como para supuesto test. El 98,96 % mostrado en la salida de
   la celda 8 corresponde por ello al entrenamiento; no es precisión sobre
   imágenes independientes. Corregir la ruta a `/test` y volver a evaluar el
   checkpoint cargado, manteniendo `shuffle=False`. No hace falta reentrenar
   para corregir esta evaluación.
2. **La inferencia de ejemplo usa otro preprocesamiento.** La celda 10 llama a
   `mobilenet_v2.preprocess_input`, mientras el entrenamiento de MobileNetV2
   usa `/255`. El backend conserva `/255`, coherente con el entrenamiento
   suministrado. La salida de ejemplo de esa celda no valida este backend.
3. **Las métricas no identifican inequívocamente el artefacto renombrado.** El
   notebook guarda `mobilenetv2_model.keras`; el archivo entregado se llama
   `mobilenetv2_model_estable.keras`. La arquitectura coincide y el hash
   identifica exactamente el archivo recibido, pero no hay un manifiesto del
   entrenamiento que registre el hash del checkpoint al guardarlo. Hace falta
   evaluar el archivo recibido sobre el test real.
4. **La división es por archivo.** El notebook de separación mezcla imágenes
   con `random.shuffle` sin semilla y después usa `train_test_split` con
   `random_state=42`; no reproduce exactamente los mismos splits entre
   ejecuciones. Tampoco agrupa por paciente o lesión: si existen varias fotos
   relacionadas, debe revisarse esa posible fuga usando los metadatos.

La salida guardada informa una mejor validación de 85,29 % en época 20 y una
validación de 84,09 % en época 28, seleccionada por menor `val_loss`. Son datos
registrados en el notebook; no se recalcularon ni constituyen validación clínica.

## Qué queda pendiente

- Obtener las imágenes del split original y sus etiquetas; no están en la
  carpeta suministrada. La ruta `/kaggle/input/...` referencia datos externos.
- Evaluar el `.keras` recibido sobre `/test`, comprobar separación entre
  entrenamiento y test, y calcular matriz de confusión y sensibilidad por clase.
- Comprobar también fotografías que hayan pasado por la compresión de la web.
- Desplegar un endpoint de inferencia y conectar su URL y secreto con Vercel.

El notebook permite avanzar con el contrato técnico. Todavía no permite
presentar el 98,96 % como rendimiento real ni asegurar precisión clínica.

Referencia de la API empleada: [ImageDataGenerator de TensorFlow](https://www.tensorflow.org/api_docs/python/tf/keras/preprocessing/image/ImageDataGenerator).
