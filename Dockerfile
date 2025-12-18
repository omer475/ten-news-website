# Ten News - Cloud Run Deployment
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Add python-dotenv if not in requirements
RUN pip install --no-cache-dir python-dotenv

# Copy application code
COPY rss_sources.py .
COPY complete_clustered_8step_workflow.py .
COPY step1_gemini_news_scoring_filtering.py .
COPY step1_5_event_clustering.py .
COPY step2_brightdata_full_article_fetching.py .
COPY step3_image_selection.py .
COPY step4_multi_source_synthesis.py .
COPY step5_gemini_component_selection.py .
COPY step2_gemini_context_search.py .
COPY step6_7_claude_component_generation.py .
COPY step8_fact_verification.py .
COPY article_deduplication.py .

# Copy the Cloud Run entrypoint
COPY cloudrun_entrypoint.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Run the entrypoint
CMD ["python", "cloudrun_entrypoint.py"]
