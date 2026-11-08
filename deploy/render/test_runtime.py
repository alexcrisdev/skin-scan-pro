"""Real LiteRT weights, HTTP contract and Keras reference parity."""
import base64
import io
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

from app import application
from model_store import verify_model


def request(method="POST", path="/predict", body=None, authorization=None, content_type="application/json", length=None):
    raw = json.dumps(body).encode() if body is not None else b"{}"
    environ = {
        "REQUEST_METHOD": method, "PATH_INFO": path, "CONTENT_TYPE": content_type,
        "CONTENT_LENGTH": str(len(raw)) if length is None else str(length),
        "wsgi.input": io.BytesIO(raw),
        "HTTP_AUTHORIZATION": authorization if authorization is not None else f"Bearer {application.token}",
    }
    captured = []
    result = b"".join(application(environ, lambda status, headers: captured.append((status, dict(headers)))))
    return int(captured[0][0].split()[0]), json.loads(result), captured[0][1]


def image_payload(size=(240, 180)):
    with Image.new("RGB", size, (180, 120, 90)) as image, io.BytesIO() as stream:
        image.save(stream, format="PNG")
        return {"mime": "image/png", "image": base64.b64encode(stream.getvalue()).decode()}


class RuntimeTests(unittest.TestCase):
    def test_litert_matches_eight_keras_references(self):
        report = json.loads(Path(__file__).with_name("parity_reference.json").read_text())
        rng = np.random.default_rng(42)
        samples = [
            np.zeros((1, 224, 224, 3), np.float32),
            np.ones((1, 224, 224, 3), np.float32),
            np.broadcast_to(np.array([0.73, 0.48, 0.34], np.float32), (1, 224, 224, 3)).copy(),
            np.linspace(0, 1, 224 * 224 * 3, dtype=np.float32).reshape(1, 224, 224, 3),
            *[rng.random((1, 224, 224, 3), dtype=np.float32) for _ in range(4)],
        ]
        for pixels, reference in zip(samples, report["comparisons"], strict=True):
            with self.subTest(sample=reference["sample"]):
                actual = application.scores(pixels)[0]
                expected = np.array(reference["keras_scores"])
                np.testing.assert_allclose(actual, expected, atol=1e-4, rtol=1e-3)
                self.assertEqual(int(actual.argmax()), int(expected.argmax()))

    def test_real_prediction_contract(self):
        status, result, headers = request(body=image_payload())
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "success")
        self.assertEqual(set(result["confianza_porcentajes"]), {"akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"})
        self.assertAlmostEqual(sum(result["confianza_porcentajes"].values()), 100, places=3)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_authentication_before_body_read(self):
        class Unreadable:
            def read(self, _):
                raise AssertionError("An unauthorized body must not be read")
        captured = []
        raw = application({"PATH_INFO": "/predict", "REQUEST_METHOD": "POST", "wsgi.input": Unreadable()},
                          lambda status, _: captured.append(status))
        self.assertTrue(captured[0].startswith("401 "))
        self.assertNotIn(application.token.encode(), b"".join(raw))

    def test_reject_invalid_images_and_bodies(self):
        payload = image_payload()
        for body in ({}, [], {**payload, "mime": "image/jpeg"}, {"mime": "image/png", "image": "invalid!"}):
            with self.subTest(body_type=type(body).__name__):
                self.assertEqual(request(body=body)[0], 400)
        self.assertEqual(request(body=payload, content_type="text/plain")[0], 415)
        self.assertEqual(request(body=payload, length=7 * 1024 * 1024)[0], 413)
        self.assertEqual(request(body=image_payload((3000, 3000)))[0], 400)

    def test_health_and_methods(self):
        self.assertEqual(request(method="GET", path="/healthz", authorization="")[1], {"status": "ready"})
        self.assertEqual(request(method="GET")[0], 405)
        self.assertEqual(request(path="/missing")[0], 404)

    def test_reject_modified_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.tflite"
            path.write_bytes(b"invalid model")
            with self.assertRaises(RuntimeError):
                verify_model(path)


if __name__ == "__main__":
    unittest.main()
