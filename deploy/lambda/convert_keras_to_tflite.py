"""Optional float32 export; the provided Lambda Dockerfile runs .keras directly."""
import argparse
from pathlib import Path

import numpy as np
import tensorflow as tf


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, default=Path(__file__).with_name("model.keras"))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("mobilenetv2_model_estable.tflite"))
    args = parser.parse_args()
    model = tf.keras.models.load_model(args.model, compile=False, safe_mode=True)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    # No quantization or Select TF ops: first establish float32 parity.
    converted = converter.convert()
    interpreter = tf.lite.Interpreter(model_content=converted)
    interpreter.allocate_tensors()
    inputs = interpreter.get_input_details()[0]
    outputs = interpreter.get_output_details()[0]
    sample = np.random.default_rng(42).random((1, 224, 224, 3), dtype=np.float32)
    expected = np.asarray(model(sample, training=False))
    interpreter.set_tensor(inputs["index"], sample)
    interpreter.invoke()
    actual = interpreter.get_tensor(outputs["index"])
    np.testing.assert_allclose(actual, expected, atol=1e-4, rtol=1e-3)
    args.output.write_bytes(converted)
    print(f"Exportado {args.output}: {len(converted)} bytes. Paridad básica float32 correcta.")
    print("Valida además con imágenes del conjunto test independiente antes de sustituir el runtime.")


if __name__ == "__main__":
    main()
