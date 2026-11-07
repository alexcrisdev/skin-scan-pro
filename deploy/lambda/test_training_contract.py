"""Compare deployment preprocessing with the Keras API used by the notebook."""
import base64
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image
from tensorflow.keras.preprocessing.image import ImageDataGenerator, img_to_array, load_img

import lambda_function as app


class TrainingContractTests(unittest.TestCase):
    def test_class_indices_and_pixels_match_notebook_generator(self):
        # Deliberately create folders in reverse order to verify inferred sorting.
        pixels = np.random.default_rng(2026).integers(0, 256, size=(37, 59, 3), dtype=np.uint8)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in reversed(app.CLASS_NAMES):
                folder = root / name
                folder.mkdir()
                Image.fromarray(pixels).save(folder / "synthetic.png")

            generator = ImageDataGenerator(rescale=1. / 255).flow_from_directory(
                directory, target_size=(224, 224), class_mode="categorical",
                color_mode="rgb", batch_size=32, shuffle=False,
            )
            self.assertEqual(generator.class_indices, app.CONTRACT["training_evidence"]["class_indices"])
            self.assertEqual(generator.interpolation, "nearest")
            image_path = Path(generator.filepaths[0])
            # No augmentation is configured in the supplied training notebook.
            # Exercise its reference image loading and rescaling without training.
            image = load_img(image_path, color_mode="rgb", target_size=(224, 224))
            expected = generator.image_data_generator.standardize(img_to_array(image))[None, ...]
            actual = app.preprocess_image({
                "mime": "image/png",
                "image": base64.b64encode(image_path.read_bytes()).decode("ascii"),
            })
            np.testing.assert_allclose(actual, expected, rtol=1e-6, atol=1e-7)
            self.assertEqual(actual.dtype, expected.dtype)


if __name__ == "__main__":
    unittest.main()
