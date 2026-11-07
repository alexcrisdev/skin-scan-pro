import base64
import io
import json
import os
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
import lambda_function as app


def image_payload():
    buffer = io.BytesIO()
    Image.new("RGB", (300, 180), color=(255, 128, 0)).save(buffer, format="PNG")
    return {"mime": "image/png", "image": base64.b64encode(buffer.getvalue()).decode()}


class LambdaTests(unittest.TestCase):
    def event(self, payload):
        return {"headers": {"Authorization": "Bearer unit-test"}, "body": json.dumps(payload), "requestContext": {"http": {"method": "POST"}}}

    @patch.dict(os.environ, {"INFERENCE_API_KEY": "unit-test"})
    def test_authentication_before_loading_model(self):
        with patch.object(app, "get_model") as model:
            self.assertEqual(app.handler({"headers": {}}, None)["statusCode"], 401)
            model.assert_not_called()

    def test_contract_preprocessing(self):
        batch = app.preprocess_image(image_payload())
        self.assertEqual(batch.shape, (1, 224, 224, 3))
        self.assertEqual(batch.dtype, np.float32)
        np.testing.assert_allclose(batch[0, 0, 0], [1, 128 / 255, 0], atol=1e-6)

    @patch.dict(os.environ, {"INFERENCE_API_KEY": "unit-test"})
    def test_contract_and_class_order(self):
        scores = np.array([[0.02, 0.03, 0.04, 0.05, 0.06, 0.7, 0.1]])
        with patch.object(app, "get_model", return_value=lambda pixels, training: scores):
            result = app.handler(self.event(image_payload()), None)
        self.assertEqual(result["statusCode"], 200)
        probabilities = json.loads(result["body"])["confianza_porcentajes"]
        self.assertEqual(list(probabilities), ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"])
        self.assertEqual(probabilities["nv"], 70)

    @patch.dict(os.environ, {"INFERENCE_API_KEY": "unit-test"})
    def test_invalid_images_never_reach_model(self):
        with patch.object(app, "get_model") as model:
            for payload in [[], {"mime": "image/jpeg", "image": "invalid!"}, {**image_payload(), "mime": "image/jpeg"}]:
                self.assertEqual(app.handler(self.event(payload), None)["statusCode"], 400)
            model.assert_not_called()

    @patch.dict(os.environ, {"INFERENCE_API_KEY": "unit-test"})
    def test_preserves_saved_model_input_list(self):
        class ListInputModel:
            input = [object()]

            def __call__(self, inputs, training):
                self_test.assertIsInstance(inputs, list)
                self_test.assertEqual(len(inputs), 1)
                self_test.assertEqual(inputs[0].shape, (1, 224, 224, 3))
                self_test.assertFalse(training)
                return np.array([[0.02, 0.03, 0.04, 0.05, 0.06, 0.7, 0.1]])

        self_test = self
        with patch.object(app, "get_model", return_value=ListInputModel()):
            result = app.handler(self.event(image_payload()), None)
        self.assertEqual(result["statusCode"], 200)


if __name__ == "__main__":
    unittest.main()
