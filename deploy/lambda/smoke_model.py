"""Execute the real model and benchmark the handler; this does not measure accuracy."""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import resource
import secrets
import statistics
import sys
import time
import warnings

from PIL import Image

# In Docker, exercise the code and weights copied into the built image.
sys.path.insert(0, os.environ.get("LAMBDA_TASK_ROOT", str(Path(__file__).parent)))
import lambda_function as app


def main():
    warnings.filterwarnings("error", message="The structure of `inputs` doesn't match")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, help="Optional local test image; no image is uploaded.")
    parser.add_argument("--repeats", type=int, default=5)
    args = parser.parse_args()
    if args.repeats < 1 or args.repeats > 100:
        parser.error("--repeats must be between 1 and 100")

    if args.image:
        raw = args.image.read_bytes()
        with Image.open(io.BytesIO(raw)) as image:
            mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(image.format)
        if not mime:
            parser.error("Use JPEG, PNG or WEBP")
        input_kind = "provided_image"
    else:
        buffer = io.BytesIO()
        Image.new("RGB", (300, 180), color=(160, 110, 90)).save(buffer, format="PNG")
        raw = buffer.getvalue()
        mime = "image/png"
        input_kind = "synthetic_image_not_a_skin_lesion"

    digest = hashlib.sha256((app.ROOT / "model.keras").read_bytes()).hexdigest()
    accepted = {app.CONTRACT["source_sha256"], app.CONTRACT.get("reconstructed_archive_sha256")}
    if digest not in accepted:
        raise RuntimeError("The model checksum does not match the recorded artifact.")
    os.environ["INFERENCE_API_KEY"] = secrets.token_urlsafe(32)
    event = {
        "headers": {"authorization": f"Bearer {os.environ['INFERENCE_API_KEY']}"},
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({"mime": mime, "image": base64.b64encode(raw).decode("ascii")}),
    }
    durations = []
    reference = None
    for _ in range(args.repeats + 1):
        started = time.perf_counter()
        response = app.handler(event, None)
        durations.append(time.perf_counter() - started)
        if response["statusCode"] != 200:
            raise RuntimeError(f"Real inference failed with HTTP {response['statusCode']}.")
        result = json.loads(response["body"])
        probabilities = result["confianza_porcentajes"]
        if list(probabilities) != app.CLASS_NAMES or abs(sum(probabilities.values()) - 100) > 0.01:
            raise RuntimeError("Unexpected output classes or probability sum.")
        if reference is not None and any(abs(probabilities[name] - reference[name]) > 0.001 for name in reference):
            raise RuntimeError("Repeated inference is not stable within tolerance.")
        reference = probabilities

    model = app.get_model()
    import tensorflow as tf
    report = {
        "purpose": "execution_smoke_test_not_accuracy_or_clinical_validation",
        "input_kind": input_kind,
        "model_sha256": digest,
        "tensorflow_version": tf.__version__,
        "input_shape": list(model.input_shape),
        "output_shape": list(model.output_shape),
        "returned_classes": app.CLASS_NAMES,
        "class_mapping_and_normalization": "still_require_training_notebook_confirmation",
        "probabilities_sum": round(sum(reference.values()), 6),
        "cold_handler_seconds": round(durations[0], 4),
        "warm_repeats": args.repeats,
        "warm_median_seconds": round(statistics.median(durations[1:]), 4),
        "warm_max_seconds": round(max(durations[1:]), 4),
        "process_peak_rss_mib": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2),
        "model_cached": model is app.get_model(),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
