# Production Dockerfile for Universal Financial Nowcasting Platform
FROM python:3.11-slim

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir psycopg2-binary pg8000 uvicorn gunicorn

# Copy application source code
COPY config.yaml .
COPY src/ src/

EXPOSE 8000

CMD ["uvicorn", "src.backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
