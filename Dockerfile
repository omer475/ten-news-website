# Dockerfile for Railway Deployment - Python News Generator
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy only Python files (not Next.js)
COPY *.py .
COPY unified_news_scoring.py .
COPY supabase_storage.py .

# Default command (will be overridden by Procfile)
CMD ["python3", "news-part1-breaking.py"]

