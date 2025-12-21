#!/bin/bash

# ============================================================
# Ten News - Google Cloud Run Deployment Script
# ============================================================
# This script sets up and deploys the news workflow to Cloud Run
# 
# Prerequisites:
#   - Google Cloud SDK (gcloud) installed
#   - Docker installed (for local testing)
#   - A Google Cloud project with billing enabled
# ============================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}🚀 TEN NEWS - CLOUD RUN DEPLOYMENT${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install Google Cloud SDK first.${NC}"
    echo "   Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No project set. Please enter your Google Cloud Project ID:${NC}"
    read -r PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

echo -e "${GREEN}📦 Project: $PROJECT_ID${NC}"

# Set region
REGION="${REGION:-us-central1}"
echo -e "${GREEN}🌍 Region: $REGION${NC}"
echo ""

# ============================================================
# STEP 1: Enable required APIs
# ============================================================
echo -e "${BLUE}📡 Step 1: Enabling required APIs...${NC}"

gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudscheduler.googleapis.com \
    --quiet

echo -e "${GREEN}✅ APIs enabled${NC}"
echo ""

# ============================================================
# STEP 2: Create secrets in Secret Manager
# ============================================================
echo -e "${BLUE}🔐 Step 2: Setting up secrets...${NC}"
echo ""
echo "You need to add your API keys to Google Cloud Secret Manager."
echo "If you've already done this, you can skip this step."
echo ""
read -p "Do you want to create/update secrets now? (y/n): " CREATE_SECRETS

if [ "$CREATE_SECRETS" = "y" ] || [ "$CREATE_SECRETS" = "Y" ]; then
    echo ""
    echo -e "${YELLOW}Enter your API keys (they will be stored securely in Secret Manager):${NC}"
    echo ""
    
    # Function to create or update secret
    create_secret() {
        local name=$1
        local value=$2
        
        # Check if secret exists
        if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
            # Update existing secret
            echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
            echo -e "  ${GREEN}✅ Updated: $name${NC}"
        else
            # Create new secret
            echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID"
            echo -e "  ${GREEN}✅ Created: $name${NC}"
        fi
    }
    
    read -sp "GEMINI_API_KEY: " GEMINI_KEY && echo ""
    create_secret "GEMINI_API_KEY" "$GEMINI_KEY"
    
    read -sp "ANTHROPIC_API_KEY: " ANTHROPIC_KEY && echo ""
    create_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
    
    read -sp "BRIGHTDATA_API_KEY: " BRIGHTDATA_KEY && echo ""
    create_secret "BRIGHTDATA_API_KEY" "$BRIGHTDATA_KEY"
    
    read -p "SUPABASE_URL: " SUPABASE_URL_VAL
    create_secret "SUPABASE_URL" "$SUPABASE_URL_VAL"
    
    read -sp "SUPABASE_SERVICE_KEY: " SUPABASE_KEY && echo ""
    create_secret "SUPABASE_SERVICE_KEY" "$SUPABASE_KEY"
    
    echo ""
    echo -e "${GREEN}✅ All secrets configured${NC}"
fi
echo ""

# ============================================================
# STEP 3: Build and push Docker image
# ============================================================
echo -e "${BLUE}🐳 Step 3: Building and pushing Docker image...${NC}"

IMAGE_NAME="gcr.io/$PROJECT_ID/tennews-workflow"

# Build the image for linux/amd64 (required for Cloud Run)
# Using --no-cache to ensure latest code changes are included
docker build --no-cache --platform linux/amd64 -t "$IMAGE_NAME:latest" .

# Configure Docker for GCR
gcloud auth configure-docker gcr.io --quiet

# Push the image
docker push "$IMAGE_NAME:latest"

echo -e "${GREEN}✅ Image pushed: $IMAGE_NAME:latest${NC}"
echo ""

# ============================================================
# STEP 4: Deploy Cloud Run Job
# ============================================================
echo -e "${BLUE}☁️  Step 4: Deploying Cloud Run Job...${NC}"

# Grant Secret Manager access to Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

echo "   Granting secret access to service account..."
for SECRET in GEMINI_API_KEY ANTHROPIC_API_KEY BRIGHTDATA_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY; do
    gcloud secrets add-iam-policy-binding "$SECRET" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$PROJECT_ID" \
        --quiet 2>/dev/null || true
done

# Deploy Cloud Run Job
gcloud run jobs deploy tennews-workflow \
    --image "$IMAGE_NAME:latest" \
    --region "$REGION" \
    --memory 2Gi \
    --cpu 2 \
    --task-timeout 30m \
    --max-retries 1 \
    --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,BRIGHTDATA_API_KEY=BRIGHTDATA_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest" \
    --quiet

echo -e "${GREEN}✅ Cloud Run Job deployed${NC}"
echo ""

# ============================================================
# STEP 5: Ensure scheduler is running (every 10 minutes)
# ============================================================
echo -e "${BLUE}⏰ Step 5: Setting up Cloud Scheduler (every 10 minutes)...${NC}"

# Check if scheduler job exists and resume it
if gcloud scheduler jobs describe tennews-trigger --location="$REGION" &>/dev/null 2>&1; then
    echo "   Resuming scheduler job..."
    gcloud scheduler jobs resume tennews-trigger --location="$REGION" --quiet 2>/dev/null || true
    echo -e "${GREEN}✅ Scheduler resumed (runs every 10 minutes)${NC}"
else
    echo "   Creating scheduler job..."
    gcloud scheduler jobs create http tennews-trigger \
        --location="$REGION" \
        --schedule="*/10 * * * *" \
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/tennews-workflow:run" \
        --http-method=POST \
        --oauth-service-account-email="$SERVICE_ACCOUNT" \
        --quiet
    echo -e "${GREEN}✅ Scheduler created (runs every 10 minutes)${NC}"
fi
echo ""

# ============================================================
# DONE!
# ============================================================
echo -e "${BLUE}============================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "Your news workflow runs every 10 minutes on Google Cloud Run!"
echo ""
echo -e "${YELLOW}📋 Useful Commands:${NC}"
echo ""
echo "  # Run the job manually:"
echo "  gcloud run jobs execute tennews-workflow --region=$REGION"
echo ""
echo "  # View job logs:"
echo "  gcloud logging read 'resource.type=\"cloud_run_job\"' --limit=50"
echo ""
echo "  # Pause scheduler:"
echo "  gcloud scheduler jobs pause tennews-trigger --location=$REGION"
echo ""
echo "  # Resume scheduler:"
echo "  gcloud scheduler jobs resume tennews-trigger --location=$REGION"
echo ""
echo -e "${YELLOW}💰 Cost Estimate:${NC}"
echo "  - Cloud Run: ~\$0.00002400/vCPU-second + \$0.00000250/GiB-second"
echo "  - Running every 10 min: ~\$5-15/month"
echo "  - Cloud Scheduler: Free tier"
echo ""
echo -e "${BLUE}============================================================${NC}"



