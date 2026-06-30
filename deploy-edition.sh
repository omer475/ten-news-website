#!/usr/bin/env bash
#
# deploy-edition.sh — ship the daily Edition pipeline to Cloud Run + Scheduler.
#
# The same container image serves two scheduled jobs (routed by EDITION_JOB):
#   - tennews-workflow   : the existing 20-min ingest + clustering cycle (KEPT).
#                          With DISABLE_ARTICLE_WRITING=1 it stops the old, costly
#                          per-article writing but keeps producing fresh clusters.
#   - tennews-edition    : NEW. Builds + publishes the day's Edition, daily at
#                          07:00 Europe/London (BST/GMT handled by Scheduler tz).
#
# Designed to run in two SAFE PHASES (see flags). Re-runnable / idempotent.
#
#   ./deploy-edition.sh build         # build+push the new image, refresh both jobs
#   ./deploy-edition.sh edition-on    # create tennews-edition job + 07:00 scheduler
#                                     #   -> real editions start generating (old feed
#                                     #      still runs; no cost change yet)
#   ./deploy-edition.sh writing-off   # set DISABLE_ARTICLE_WRITING=1 on the 20-min
#                                     #   job -> stops the old per-article writing.
#                                     #   DO THIS WHEN THE WEB EDITION UI IS LIVE.
#   ./deploy-edition.sh all           # build -> edition-on (writing-off NOT included)
#
set -euo pipefail

PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
REGION="${REGION:-us-central1}"
SCHED_LOCATION="${SCHED_LOCATION:-us-central1}"
IMAGE="gcr.io/${PROJECT_ID}/tennews-workflow"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo manual)"
SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
SECRETS="GEMINI_API_KEY=GEMINI_API_KEY:latest,BRIGHTDATA_API_KEY=BRIGHTDATA_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,UNSPLASH_ACCESS_KEY=UNSPLASH_ACCESS_KEY:latest"

echo "project=$PROJECT_ID region=$REGION image=$IMAGE:$TAG"

build() {
  echo "🏗️  building $IMAGE:$TAG"
  gcloud builds submit --tag "$IMAGE:$TAG" .
  echo "🔁 refreshing tennews-workflow with new image (config preserved)"
  gcloud run jobs update tennews-workflow --image "$IMAGE:$TAG" --region "$REGION"
}

edition_on() {
  echo "🆕 creating/updating tennews-edition job (EDITION_JOB=1)"
  gcloud run jobs deploy tennews-edition \
    --image "$IMAGE:$TAG" \
    --region "$REGION" \
    --service-account "$SA" \
    --memory 2Gi --cpu 2 --task-timeout 30m --max-retries 1 \
    --set-secrets "$SECRETS" \
    --set-env-vars "EDITION_JOB=1"

  echo "⏰ creating/updating scheduler tennews-edition-trigger @ 07:00 Europe/London"
  local URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/tennews-edition:run"
  if gcloud scheduler jobs describe tennews-edition-trigger --location="$SCHED_LOCATION" &>/dev/null; then
    gcloud scheduler jobs update http tennews-edition-trigger \
      --location="$SCHED_LOCATION" \
      --schedule="0 7 * * *" --time-zone="Europe/London" \
      --uri="$URI" --http-method=POST \
      --oauth-service-account-email="$SA"
  else
    gcloud scheduler jobs create http tennews-edition-trigger \
      --location="$SCHED_LOCATION" \
      --schedule="0 7 * * *" --time-zone="Europe/London" \
      --uri="$URI" --http-method=POST \
      --oauth-service-account-email="$SA"
  fi
  echo "✅ edition job scheduled. Test now: gcloud run jobs execute tennews-edition --region=$REGION"
}

writing_off() {
  echo "🟦 disabling old per-article writing on tennews-workflow (ingest+clustering stay on)"
  gcloud run jobs update tennews-workflow \
    --region "$REGION" \
    --update-env-vars "DISABLE_ARTICLE_WRITING=1"
  echo "✅ writing disabled. Revert with: gcloud run jobs update tennews-workflow --region=$REGION --remove-env-vars DISABLE_ARTICLE_WRITING"
}

case "${1:-}" in
  build)        build ;;
  edition-on)   edition_on ;;
  writing-off)  writing_off ;;
  all)          build; edition_on ;;
  *) echo "usage: $0 {build|edition-on|writing-off|all}"; exit 1 ;;
esac
