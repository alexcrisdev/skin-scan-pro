"""Compare supplied artifacts on synthetic inputs; this is not a clinical evaluation."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import tensorflow as tf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keras", default="/var/task/model.keras")
    parser.add_argument("--tflite", default="/checks/model.tflite")
    parser.add_argument("--report")
    args = parser.parse_args()
    model = tf.keras.models.load_model(args.keras, compile=False, safe_mode=True)
    interpreter = tf.lite.Interpreter(model_path=args.tflite, num_threads=1)
    interpreter.allocate_tensors()
    inputs, = interpreter.get_input_details()
    outputs, = interpreter.get_output_details()
    assert tuple(inputs["shape"]) == (1, 224, 224, 3)
    assert tuple(outputs["shape"]) == (1, 7)
    assert inputs["dtype"] == outputs["dtype"] == np.float32
    rng = np.random.default_rng(42)
    samples = {
        "black": np.zeros((1, 224, 224, 3), np.float32),
        "white": np.ones((1, 224, 224, 3), np.float32),
        "constant": np.broadcast_to(np.array([0.73, 0.48, 0.34], np.float32), (1, 224, 224, 3)).copy(),
        "gradient": np.linspace(0, 1, 224 * 224 * 3, dtype=np.float32).reshape(1, 224, 224, 3),
        **{f"noise_{index}": rng.random((1, 224, 224, 3), dtype=np.float32) for index in range(4)},
    }
    comparisons = []
    for name, pixels in samples.items():
        expected = np.asarray(model([pixels] if isinstance(model.input, list) else pixels, training=False))
        interpreter.set_tensor(inputs["index"], pixels)
        interpreter.invoke()
        actual = interpreter.get_tensor(outputs["index"])
        np.testing.assert_allclose(actual, expected, atol=1e-4, rtol=1e-3, err_msg=name)
        assert int(actual.argmax()) == int(expected.argmax()), name
        comparisons.append({"sample": name, "max_absolute_error": float(np.max(np.abs(actual - expected))), "keras_scores": expected[0].tolist()})
    report = {
        "tflite_sha256": hashlib.sha256(Path(args.tflite).read_bytes()).hexdigest(),
        "tflite_bytes": Path(args.tflite).stat().st_size,
        "input_shape": inputs["shape"].tolist(),
        "output_shape": outputs["shape"].tolist(),
        "dtype": "float32",
        "comparisons": comparisons,
        "clinical_evaluation": "not_performed_synthetic_inputs_only",
    }
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
