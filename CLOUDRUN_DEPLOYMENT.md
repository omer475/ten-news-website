# Ten News - Google Cloud Run Deployment

This guide explains how to deploy the Ten News workflow to Google Cloud Run.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloud Scheduler │────▶│  Cloud Run Job   │────▶│    Supabase     │
│ (every 5 min)   │     │ (news workflow)  │     │   (database)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Secret Manager  │
                        │   (API keys)     │
                        └──────────────────┘
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** (`gcloud`) installed
3. **Docker** installed (for building images locally)

### Install Google Cloud SDK

```bash
# macOS
brew install google-cloud-sdk

# Or download from:
# https://cloud.google.com/sdk/docs/install
```

### Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

## Quick Deploy

The easiest way to deploy is using the automated script:

```bash
cd "/Users/omersogancioglu/Ten News Website"
./deploy-cloudrun.sh
```

This script will:
1. Enable required Google Cloud APIs
2. Set up secrets in Secret Manager
3. Build and push the Docker image
4. Deploy the Cloud Run Job
5. Configure Cloud Scheduler to run every 5 minutes

## Manual Deployment

### Step 1: Enable APIs

```bash
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com
```

### Step 2: Create Secrets

```bash
# Create each secret
echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-brightdata-key" | gcloud secrets create BRIGHTDATA_API_KEY --data-file=-
echo -n "your-supabase-url" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "your-supabase-key" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-
```

### Step 3: Build Docker Image

```bash
# Build locally
docker build -t gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest .

# Push to Container Registry
gcloud auth configure-docker gcr.io
docker push gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest
```

### Step 4: Deploy Cloud Run Job

```bash
gcloud run jobs deploy tennews-workflow \
    --image gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest \
    --region us-central1 \
    --memory 2Gi \
    --cpu 2 \
    --task-timeout 30m \
    --max-retries 1 \
    --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,BRIGHTDATA_API_KEY=BRIGHTDATA_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"
```

### Step 5: Set Up Cloud Scheduler

```bash
# Get service account
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')

# Create scheduler job
gcloud scheduler jobs create http tennews-trigger \
    --location=us-central1 \
    --schedule="*/5 * * * *" \
    --uri="https://us-central1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/YOUR_PROJECT_ID/jobs/tennews-workflow:run" \
    --http-method=POST \
    --oauth-service-account-email="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

## Useful Commands

### Run Job Manually

```bash
gcloud run jobs execute tennews-workflow --region=us-central1
```

### View Logs

```bash
# Recent logs
gcloud logging read 'resource.type="cloud_run_job" resource.labels.job_name="tennews-workflow"' --limit=100

# Stream logs
gcloud logging tail 'resource.type="cloud_run_job" resource.labels.job_name="tennews-workflow"'
```

### Manage Scheduler

```bash
# Pause (stop running)
gcloud scheduler jobs pause tennews-trigger --location=us-central1

# Resume
gcloud scheduler jobs resume tennews-trigger --location=us-central1

# Check status
gcloud scheduler jobs describe tennews-trigger --location=us-central1
```

### Update Deployment

```bash
# Rebuild and push
docker build -t gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest .
docker push gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest

# Update the job
gcloud run jobs update tennews-workflow \
    --image gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest \
    --region us-central1
```

## Cost Estimation

| Service | Cost | Notes |
|---------|------|-------|
| Cloud Run | ~$0.00002400/vCPU-second | 2 vCPU, ~5-10 min per run |
| Cloud Run Memory | ~$0.00000250/GiB-second | 2 GiB |
| Cloud Scheduler | Free | 3 free jobs/month |
| Container Registry | ~$0.026/GB/month | ~500MB image |
| Secret Manager | Free | 6 secrets, 10k access/month free |

**Estimated Monthly Cost: $5-20** (depending on run duration)

## Troubleshooting

### Job Fails Immediately

Check logs:
```bash
gcloud logging read 'resource.type="cloud_run_job"' --limit=50
```

Common issues:
- Missing secrets: Ensure all 5 secrets are created
- Wrong permissions: Service account needs Secret Manager access

### Scheduler Not Triggering

```bash
# Check scheduler status
gcloud scheduler jobs describe tennews-trigger --location=us-central1

# Check if it's paused
gcloud scheduler jobs resume tennews-trigger --location=us-central1
```

### API Key Errors

Update a secret:
```bash
echo -n "new-key-value" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

## Files Created

| File | Purpose |
|------|---------|
| `Dockerfile` | Container build configuration |
| `cloudbuild.yaml` | CI/CD pipeline for Cloud Build |
| `cloudrun_entrypoint.py` | Entry point for Cloud Run execution |
| `deploy-cloudrun.sh` | Automated deployment script |
| `.dockerignore` | Files to exclude from Docker build |

## Alternative: Cloud Run Service (HTTP)

If you prefer an HTTP-triggered service instead of a job:

```bash
# Set environment variable in Dockerfile
ENV RUN_AS_HTTP_SERVICE=true

# Deploy as service (not job)
gcloud run deploy tennews-workflow \
    --image gcr.io/YOUR_PROJECT_ID/tennews-workflow:latest \
    --region us-central1 \
    --memory 2Gi \
    --allow-unauthenticated \
    --set-secrets "..."
```

Then trigger via HTTP POST to the service URL.



