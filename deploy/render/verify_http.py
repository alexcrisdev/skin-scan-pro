"""Boot only this project's container, check HTTP, report memory, then clean up."""
import argparse
import base64
import json
from pathlib import Path
import statistics
import struct
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
import uuid
import zlib

from prepare_model import read_env
from model_store import NoRedirect


def docker(*args):
    result = subprocess.run(["docker", *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Falló el comando Docker de verificación; revisa Docker Desktop.")
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", help="Optional live HTTPS service origin instead of local Docker")
    args = parser.parse_args()
    root = Path(__file__).parent
    values = read_env(root / ".local" / "render.env")
    token = values["INFERENCE_API_KEY"]
    container = None
    startup = time.perf_counter()

    def call(path, payload=None, authorized=False):
        body = json.dumps(payload).encode() if payload is not None else None
        request = Request(origin + path, data=body, headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if authorized else {}),
        })
        try:
            with build_opener(NoRedirect).open(request, timeout=105) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            # Do not print remote error bodies, request headers or credentials.
            return error.code, None

    try:
        if args.endpoint:
            from urllib.parse import urlsplit
            parsed = urlsplit(args.endpoint)
            if parsed.scheme != "https" or not parsed.hostname or parsed.path not in ("", "/") or parsed.query or parsed.username:
                raise SystemExit("Usa solo el origen HTTPS de Render, sin /predict ni parámetros.")
            origin = args.endpoint.rstrip("/")
        else:
            container = docker("run", "--detach", "--name", "skinscan-render-check-" + uuid.uuid4().hex[:10],
                "--cpus", "0.1", "--memory", "512m", "--memory-swap", "512m", "--read-only",
                "--tmpfs", "/tmp:rw,size=64m", "--publish", "127.0.0.1::10000",
                "--env-file", str(root / ".local" / "render.env"), "skinscan-inference:render")
            mapping = docker("port", container, "10000/tcp")
            origin = "http://" + mapping.splitlines()[0]
        ready = False
        for _ in range(100):
            try:
                status, result = call("/healthz")
                if status == 200 and result == {"status": "ready"}:
                    ready = True
                    break
            except (URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
                pass
            if container and docker("inspect", "--format", "{{.State.Running}}", container) != "true":
                raise RuntimeError("El contenedor no logró iniciar; revisa su configuración.")
            time.sleep(0.5)
        if not ready:
            raise RuntimeError("El modelo no quedó listo durante la prueba.")
        startup_seconds = time.perf_counter() - startup

        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", 1, 1, 8, 2, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(b"\0\xb4\x78\x5a")) + chunk(b"IEND", b"")
        payload = {"mime": "image/png", "image": base64.b64encode(png).decode()}
        assert call("/predict", payload)[0] == 401, "Se esperaba rechazo sin credencial."
        assert call("/predict", {"mime": "image/png", "image": "invalid!"}, True)[0] == 400
        elapsed = []
        for _ in range(5):
            start = time.perf_counter()
            status, result = call("/predict", payload, True)
            assert status == 200 and result["status"] == "success", "Falló la inferencia HTTP real."
            scores = result["confianza_porcentajes"]
            assert set(scores) == {"akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"}
            assert abs(sum(scores.values()) - 100) < 0.01
            elapsed.append(time.perf_counter() - start)
        peak = int(docker("exec", container, "cat", "/sys/fs/cgroup/memory.peak")) if container else None
        report = {
            "mode": "live_render" if args.endpoint else "docker_0.1_cpu_512_mib_no_swap",
            "startup_seconds": round(startup_seconds, 4),
            "warm_median_seconds": round(statistics.median(elapsed), 4),
            "warm_max_seconds": round(max(elapsed), 4),
            "cgroup_peak_mib": round(peak / 1024 ** 2, 2) if peak else None,
            "checks": ["health_ready", "unauthorized_401", "invalid_image_400", "five_real_predictions_200"],
            "input": "synthetic_png_not_a_lesion",
            "clinical_accuracy": "not_evaluated",
        }
        (root / ".local" / ("live_report.json" if args.endpoint else "http_report.json")).write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report))
    finally:
        if container:
            subprocess.run(["docker", "stop", "--time", "5", container], capture_output=True)
            subprocess.run(["docker", "rm", container], capture_output=True)


if __name__ == "__main__":
    main()
