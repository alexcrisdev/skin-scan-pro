"""Fetch the private, immutable artifact at startup; never log credentials."""
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ARTIFACT = json.loads(Path(__file__).with_name("model_artifact.json").read_text())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def verify_model(path):
    if path.stat().st_size != ARTIFACT["bytes"]:
        raise RuntimeError("El tamaño del modelo no coincide con el artefacto revisado.")
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != ARTIFACT["sha256"]:
        raise RuntimeError("El hash del modelo no coincide con el artefacto revisado.")
    return path


def ensure_model():
    path = Path(os.environ.get("MODEL_PATH", "/tmp/skinscan/model.tflite"))
    if path.is_file():
        return verify_model(path)
    origin = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    parts = urlsplit(origin)
    if parts.scheme != "https" or not parts.hostname or parts.path or parts.query or parts.fragment or parts.username:
        raise RuntimeError("Configura SUPABASE_URL con el origen HTTPS del proyecto.")
    if not key:
        raise RuntimeError("Falta la credencial de servidor para descargar el modelo privado.")
    url = f'{origin}/storage/v1/object/authenticated/{ARTIFACT["bucket"]}/{ARTIFACT["object_path"]}'
    request = Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".partial")
    try:
        total = 0
        with build_opener(NoRedirect).open(request, timeout=45) as source, temporary.open("wb") as target:
            while chunk := source.read(64 * 1024):
                total += len(chunk)
                if total > ARTIFACT["bytes"]:
                    raise RuntimeError("El artefacto descargado es demasiado grande.")
                target.write(chunk)
        verify_model(temporary)
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("No se pudo descargar y verificar el modelo privado de SkinScan.") from None
    return path
