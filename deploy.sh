#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# RepoLens Backend - Google Cloud Run Deployment Script
# Region: asia-south1 (Mumbai)
# Context: Monorepo Root (repolens/)
# ==============================================================================

SERVICE_NAME="repolens-backend"
REGION="asia-south1"

echo "=== Deploying ${SERVICE_NAME} to Google Cloud Run [${REGION}] ==="

# Read environment variables from backend/.env if available
BACKEND_ENV_FILE="./backend/.env"
if [[ -f "${BACKEND_ENV_FILE}" ]]; then
  echo "Found ${BACKEND_ENV_FILE}, reading configuration..."
  # Export variables from .env without comments or empty lines
  set -a
  source <(grep -v '^#' "${BACKEND_ENV_FILE}" | grep -v '^[[:space:]]*$')
  set +a
fi

# Fallback defaults for Buildathon deployment
GEMINI_KEY="${GEMINI_API_KEY:-}"
GEMINI_MODEL="${GEMINI_FLASH_MODEL:-gemini-2.5-flash-lite}"
GEMMA_MODEL_NAME="${GEMMA_MODEL:-gemma-3-4b-it}"
FIREBASE_PROJECT="${FIREBASE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"

if [[ -z "${GEMINI_KEY}" ]]; then
  echo "WARNING: GEMINI_API_KEY is not set in environment or backend/.env."
  echo "You will need to configure it in Cloud Run Secret Manager or Cloud Run Environment Variables."
fi

# Build env vars parameter
ENV_VARS="GEMINI_FLASH_MODEL=${GEMINI_MODEL},GEMMA_MODEL=${GEMMA_MODEL_NAME}"

if [[ -n "${GEMINI_KEY}" ]]; then
  ENV_VARS="${ENV_VARS},GEMINI_API_KEY=${GEMINI_KEY}"
fi

if [[ -n "${FIREBASE_PROJECT}" ]]; then
  ENV_VARS="${ENV_VARS},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT}"
fi

echo "Deploying source from monorepo root: $(pwd)"

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "${ENV_VARS}"

echo "=== Deployment to Cloud Run completed successfully! ==="

