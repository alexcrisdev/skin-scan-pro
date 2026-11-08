"""Prepare ignored Render credentials and optionally upload to this Supabase project."""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
from urllib.error import HTTPError
from urllib.request import Request, build_opener, urlopen

from model_store import NoRedirect

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = json.loads(Path(__file__).with_name("model_artifact.json").read_text())


def read_env(path):
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
    return values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--project-ref", default="lzmwczcqdmsgwjprvqwb")
    args = parser.parse_args()
    env_path = ROOT / ".env"
    values = read_env(env_path)
    origin = values.get("SUPABASE_URL", "").rstrip("/")
    if origin != f"https://{args.project_ref}.supabase.co":
        raise SystemExit("La URL no coincide con el proyecto solicitado; no se modificó Supabase.")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise SystemExit("Falta SUPABASE_SERVICE_ROLE_KEY en .env.")
    path = Path(__file__).with_name("model.tflite")
    data = path.read_bytes()
    if len(data) != ARTIFACT["bytes"] or hashlib.sha256(data).hexdigest() != ARTIFACT["sha256"]:
        raise SystemExit("El TFLite local no coincide con el artefacto revisado.")
    token = values.get("SKINSCAN_INFERENCE_API_KEY") or secrets.token_urlsafe(48)
    if len(token) < 32 or not token.isascii():
        raise SystemExit("SKINSCAN_INFERENCE_API_KEY debe tener al menos 32 caracteres ASCII.")
    directory = Path(__file__).with_name(".local")
    directory.mkdir(exist_ok=True)
    (directory / "render.env").write_text(
        f"INFERENCE_API_KEY={token}\nSUPABASE_URL={origin}\nSUPABASE_SERVICE_ROLE_KEY={key}\n", encoding="utf-8"
    )
    # Preserve comments and other values in the existing application .env.
    lines = env_path.read_text(encoding="utf-8-sig").splitlines()
    replacement = f"SKINSCAN_INFERENCE_API_KEY={token}"
    if any(line.startswith("SKINSCAN_INFERENCE_API_KEY=") for line in lines):
        lines = [replacement if line.startswith("SKINSCAN_INFERENCE_API_KEY=") else line for line in lines]
    else:
        lines.append(replacement)
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Credenciales preparadas en deploy/render/.local/render.env (excluido de Git).")
    if not args.upload:
        return

    def api(method, route, body=None, content_type="application/json"):
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": content_type}
        request = Request(origin + "/storage/v1/" + route, data=body, headers=headers, method=method)
        try:
            with build_opener(NoRedirect).open(request, timeout=90) as response:
                return response.read()
        except HTTPError as error:
            if error.code in (400, 404):
                # Storage can return 400 for Object/Bucket not found; inspect only the error code.
                try:
                    detail = json.loads(error.read())
                except ValueError:
                    detail = {}
                if str(detail.get("statusCode")) == "404" or detail.get("error") in ("NoSuchBucket", "NoSuchKey"):
                    return None
            raise RuntimeError(f"Storage rechazó {method} (HTTP {error.code}); no se mostraron credenciales.") from None

    bucket = ARTIFACT["bucket"]
    metadata = api("GET", f"bucket/{bucket}")
    if metadata is None:
        api("POST", "bucket", json.dumps({
            "id": bucket, "name": bucket, "public": False,
            "file_size_limit": 20 * 1024 * 1024,
            "allowed_mime_types": ["application/octet-stream"],
        }).encode())
        print("Creado bucket privado inference-models en el proyecto solicitado.")
    elif json.loads(metadata).get("public") is not False:
        raise SystemExit("El bucket existente es público; no se subió el modelo ni se alteró su configuración.")
    object_route = f"object/{bucket}/{ARTIFACT['object_path']}"
    existing = api("GET", object_route.replace("object/", "object/authenticated/", 1))
    if existing is None:
        api("POST", object_route, data, "application/octet-stream")
        existing = api("GET", object_route.replace("object/", "object/authenticated/", 1))
    if not existing or hashlib.sha256(existing).hexdigest() != ARTIFACT["sha256"]:
        raise SystemExit("No se verificó el hash remoto; no se sobrescribió ningún objeto existente.")
    # Check that the public route cannot return the weights without credentials.
    try:
        with urlopen(origin + "/storage/v1/" + object_route.replace("object/", "object/public/", 1), timeout=30) as response:
            if response.status == 200:
                raise SystemExit("El objeto está accesible públicamente; revisa las políticas del bucket.")
    except HTTPError:
        pass
    print("Artefacto remoto verificado por SHA-256; descarga pública denegada.")


if __name__ == "__main__":
    main()
