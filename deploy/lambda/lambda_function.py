"""Lambda Function URL / API Gateway proxy adapter for the supplied CNN."""
import base64
import binascii
import hmac
import io
import json
import logging
import os
from pathlib import Path
import threading
import warnings

import numpy as np
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).parent
CONTRACT = json.loads((ROOT / "model_contract.json").read_text())
CLASS_NAMES = CONTRACT["class_names"]
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_BASE64_LENGTH = 4 * ((MAX_IMAGE_BYTES + 2) // 3)
Image.MAX_IMAGE_PIXELS = 20_000_000
LOGGER = logging.getLogger(__name__)
_model = None
_load_lock = threading.Lock()


def response(status, payload):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
        "body": json.dumps(payload, ensure_ascii=False, allow_nan=False),
    }


def get_model():
    global _model
    if _model is None:
        with _load_lock:
            if _model is None:
                import tensorflow as tf
                model = tf.keras.models.load_model(ROOT / "model.keras", compile=False, safe_mode=True)
                if tuple(model.input_shape) != (None, 224, 224, 3) or tuple(model.output_shape) != (None, 7):
                    raise RuntimeError("El artefacto no coincide con el contrato del modelo.")
                _model = model
    return _model


def preprocess_image(payload):
    if not isinstance(payload, dict):
        raise ValueError("El cuerpo debe ser un objeto JSON.")
    mime = payload.get("mime")
    formats = {"image/jpeg": "JPEG", "image/jpg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
    encoded = payload.get("image")
    if mime not in formats:
        raise ValueError("Formato no admitido. Usa JPEG, PNG o WEBP.")
    if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_BASE64_LENGTH:
        raise ValueError("Imagen ausente o demasiado grande (máximo 4 MiB comprimida).")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("La imagen debe ser Base64 válido sin prefijo Data URI.") from error
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("La imagen excede 4 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != formats[mime]:
                    raise ValueError("El contenido de la imagen no coincide con su MIME.")
                # Contract assumption: RGB 224x224, nearest resize and /255.
                # Confirm the external preprocessing against the training notebook.
                image = image.convert("RGB").resize((224, 224), Image.Resampling.NEAREST)
                pixels = np.asarray(image, dtype=np.float32) / np.float32(255.0)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ValueError("La imagen está dañada o sus dimensiones son excesivas.") from error
    return np.expand_dims(pixels, axis=0)


def handler(event, context):
    if not isinstance(event, dict):
        return response(400, {"status": "error", "message": "Evento inválido."})
    headers = {str(key).lower(): str(value) for key, value in (event.get("headers") or {}).items()}
    token = os.environ.get("INFERENCE_API_KEY", "")
    if not token:
        return response(503, {"status": "error", "message": "El servicio de inferencia no está configurado."})
    authorization = headers.get("authorization", "")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        return response(401, {"status": "error", "message": "No autorizado."})
    method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "POST")
    if method != "POST":
        return response(405, {"status": "error", "message": "Solo se permite POST."})
    try:
        body = event.get("body", "")
        if not isinstance(body, str) or len(body) > 6 * 1024 * 1024:
            raise ValueError("Cuerpo ausente o demasiado grande.")
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body, validate=True).decode("utf-8")
        payload = json.loads(body)
        pixels = preprocess_image(payload)
    except (ValueError, TypeError, UnicodeError, binascii.Error) as error:
        return response(400, {"status": "error", "message": str(error)})
    try:
        model = get_model()
        # The supplied Functional model was saved with a one-element input list.
        # Preserve that structure while also accepting a single-tensor model.
        model_input = [pixels] if isinstance(getattr(model, "input", None), list) else pixels
        scores = np.asarray(model(model_input, training=False), dtype=np.float64)
        if scores.shape != (1, 7) or not np.isfinite(scores).all() or np.any(scores < 0) or np.any(scores > 1) or not np.isclose(scores.sum(), 1.0, atol=0.01):
            raise RuntimeError("Salida softmax inválida.")
        return response(200, {
            "status": "success",
            "confianza_porcentajes": {name: round(float(scores[0, index]) * 100, 6) for index, name in enumerate(CLASS_NAMES)},
            "interpretacion_ia": "Clasificación del modelo CNN MobileNetV2. Requiere evaluación por un profesional de salud.",
        })
    except Exception:
        # Do not log images, authorization headers or patient data.
        LOGGER.exception("No se pudo ejecutar el modelo CNN")
        return response(500, {"status": "error", "message": "No se pudo ejecutar el modelo CNN."})
