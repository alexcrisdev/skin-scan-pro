FROM public.ecr.aws/lambda/python:3.12

ENV TF_CPP_MIN_LOG_LEVEL=2 \
    KERAS_HOME=/tmp/keras \
    CUDA_VISIBLE_DEVICES=-1 \
    TF_NUM_INTRAOP_THREADS=2 \
    TF_NUM_INTEROP_THREADS=1

COPY requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt
COPY lambda_function.py model_contract.json ${LAMBDA_TASK_ROOT}/
COPY model.keras ${LAMBDA_TASK_ROOT}/model.keras

CMD ["lambda_function.handler"]
