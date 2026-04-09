# Multi-stage build for backend with optimizations
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Final stage: Distroless Python image for minimal footprint
FROM gcr.io/distroless/python3.11-debian12:nonroot

WORKDIR /app

# Copy Python dependencies from builder
COPY --from=builder /root/.local /root/.local /root/.local

# Copy application code
COPY . .

# Set environment variables for optimization
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1

# Expose port
EXPOSE 8000

# Health check wrapper script
COPY --from=builder /root/.local/bin/uvicorn /root/.local/bin/uvicorn

# Run as non-root (distroless nonroot user)
USER nonroot:nonroot

# Run with optimized settings
CMD ["/root/.local/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
