# Ten News - Cloud Run Deployment
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies (CPU-only torch keeps image ~1.5GB smaller)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY rss_sources.py .
COPY complete_clustered_8step_workflow.py .
COPY step1_gemini_news_scoring_filtering.py .
COPY step1_5_event_clustering.py .
COPY step2_brightdata_full_article_fetching.py .
COPY step3_image_selection.py .
COPY image_selection.py .
COPY image_quality_checker.py .
# step4_multi_source_synthesis.py no longer used (synthesis is inline Gemini in workflow)
COPY step5_gemini_component_selection.py .
COPY step2_gemini_context_search.py .
COPY step6_7_claude_component_generation.py .
# step6_world_event_detection.py: imported by complete_clustered_8step_workflow.py
# (line 55). The Events tab UI was removed from the iOS app, but the
# underlying article_world_events data is still consumed by Trinity
# (recommendation algorithm) for in-slate story-cluster dedup and the
# cross-session 0.3× demote per audit fix A6 (2026-05-06). Removing it
# regresses the algorithm. Was missing from the COPY list, causing the
# tennews-workflow-276d8 ModuleNotFoundError on 2026-05-09.
COPY step6_world_event_detection.py .
# event_components.py: helper imported by step6_world_event_detection.py
# (`from event_components import generate_event_components, refresh_all_event_components`).
# Was also missing — caused tennews-workflow-jvj4n to crash with
# "No module named 'event_components'" on 2026-05-09 after the first
# fix landed. This file generates per-event components (timeline / details
# / map for the article_world_events rows). Needed for the same Trinity
# dedup pipeline.
COPY event_components.py .
COPY step8_fact_verification.py .
COPY step10_article_scoring.py .
COPY step11_article_tagging.py .
COPY article_deduplication.py .

# Copy services/ directory (hierarchical clustering helpers).
# Added 2026-04-23: the cluster_assign_helper import at
# complete_clustered_8step_workflow.py:1664 was silently failing because
# the services/ tree was never copied, leaving every article since
# 2026-04-21 with super_cluster_id / leaf_cluster_id = NULL. Copying the
# whole directory avoids maintaining a per-file list as new helpers land.
COPY services/ services/

# Copy the Cloud Run entrypoint
COPY cloudrun_entrypoint.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Run the entrypoint (Cloud Run Job - runs once and exits)
CMD ["python", "cloudrun_entrypoint.py"]
