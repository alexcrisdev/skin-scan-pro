"""Single-worker WSGI API. Images remain in memory and are never logged."""
import hmac
from http import HTTPStatus
import json
import os

import numpy as np
from ai_edge_litert.interpreter import Interpreter
from PIL import Image

# Reuse the already tested training preprocessing without importing TensorFlow.
from lambda_function import CLASS_NAMES, preprocess_image
from model_store import ensure_model

MAX_BODY_BYTES = 6 * 1024 * 1024
# Smaller decode budget for the 512 MB service; frontend normally resizes first.
Image.MAX_IMAGE_PIXELS = 8_000_000


class InferenceApplication:
    def __init__(self):
        self.token = os.environ.get("INFERENCE_API_KEY", "")
        if len(self.token) < 32 or not self.token.isascii():
            raise RuntimeError("Configura INFERENCE_API_KEY con al menos 32 caracteres ASCII aleatorios.")
        self.interpreter = Interpreter(model_path=str(ensure_model()), num_threads=1)
        self.interpreter.allocate_tensors()
        self.input, = self.interpreter.get_input_details()
        self.output, = self.interpreter.get_output_details()
        if (tuple(self.input["shape"]) != (1, 224, 224, 3)
                or tuple(self.output["shape"]) != (1, 7)
                or self.input["dtype"] != np.float32 or self.output["dtype"] != np.float32):
            raise RuntimeError("El modelo no coincide con el contrato float32 de siete clases.")
        self.scores(np.zeros((1, 224, 224, 3), dtype=np.float32))

    def scores(self, pixels):
        # Gunicorn uses one synchronous worker: interpreter calls never overlap.
        self.interpreter.set_tensor(self.input["index"], pixels)
        self.interpreter.invoke()
        result = self.interpreter.get_tensor(self.output["index"])
        if (result.shape != (1, 7) or not np.isfinite(result).all()
                or np.any(result < 0) or np.any(result > 1)
                or not np.isclose(result.sum(), 1.0, atol=0.01)):
            raise RuntimeError("Salida softmax inválida.")
        return result

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        method = environ.get("REQUEST_METHOD", "")
        if path == "/healthz" and method == "GET":
            return self.respond(start_response, 200, {"status": "ready"})
        if path != "/predict":
            return self.respond(start_response, 404, {"status": "error", "message": "Ruta no encontrada."})
        supplied = environ.get("HTTP_AUTHORIZATION", "")
        if not hmac.compare_digest(supplied.encode(), f"Bearer {self.token}".encode()):
            return self.respond(start_response, 401, {"status": "error", "message": "No autorizado."})
        if method != "POST":
            return self.respond(start_response, 405, {"status": "error", "message": "Solo se permite POST."})
        if environ.get("CONTENT_TYPE", "").split(";", 1)[0].strip().lower() != "application/json":
            return self.respond(start_response, 415, {"status": "error", "message": "Se requiere application/json."})
        try:
            length = int(environ.get("CONTENT_LENGTH", ""))
            if not 0 < length <= MAX_BODY_BYTES:
                return self.respond(start_response, 413, {"status": "error", "message": "Tamaño de solicitud inválido."})
            raw = environ["wsgi.input"].read(length)
            if len(raw) != length:
                raise ValueError("Cuerpo incompleto.")
            payload = json.loads(raw)
            pixels = preprocess_image(payload)
        except (ValueError, TypeError, UnicodeError):
            return self.respond(start_response, 400, {"status": "error", "message": "Imagen o solicitud inválida; usa JPEG, PNG o WEBP de hasta 4 MiB y 8 megapíxeles."})
        try:
            scores = self.scores(pixels)
            return self.respond(start_response, 200, {
                "status": "success",
                "confianza_porcentajes": {name: round(float(scores[0, i]) * 100, 6) for i, name in enumerate(CLASS_NAMES)},
                "interpretacion_ia": "Clasificación del modelo CNN MobileNetV2. Requiere evaluación por un profesional de salud.",
            })
        except Exception:
            # Deliberately omit exception text, images, headers and patient data.
            return self.respond(start_response, 500, {"status": "error", "message": "No se pudo ejecutar el modelo CNN."})

    @staticmethod
    def respond(start_response, status, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        start_response(f"{status} {HTTPStatus(status).phrase}", [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))), ("Cache-Control", "no-store"),
            ("X-Content-Type-Options", "nosniff"),
        ])
        return [body]


application = InferenceApplication()
