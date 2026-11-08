FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1

WORKDIR /app
COPY deploy/render/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home skinscan
COPY deploy/lambda/lambda_function.py deploy/lambda/model_contract.json ./
COPY deploy/render/app.py deploy/render/model_store.py deploy/render/model_artifact.json ./
USER skinscan
EXPOSE 10000
CMD ["sh", "-c", "exec gunicorn --bind \"0.0.0.0:${PORT:-10000}\" --workers 1 --threads 1 --timeout 110 --preload app:application"]
