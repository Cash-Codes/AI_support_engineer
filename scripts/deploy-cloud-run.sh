#!/usr/bin/env bash
set -euo pipefail

# Builds + deploys the agent api to Cloud Run as a mock-mode demo.
#
# Prerequisites:
#   • gcloud authenticated (`gcloud auth login`)
#   • The target project exists and the user has Cloud Run + Artifact Registry roles
#   • An Artifact Registry repo exists (created on first run if missing)
#
# Usage:
#   ./scripts/deploy-cloud-run.sh
#
# Environment overrides:
#   PROJECT_ID    - GCP project (default: ai-support-engineer)
#   REGION        - Cloud Run region (default: us-central1)
#   SERVICE_NAME  - Cloud Run service name (default: agent-api)
#   AR_REPO       - Artifact Registry repo (default: containers)
#   ALLOWED_ORIGINS - comma-separated CORS origins for the widget
#                    (set after the host product deploys)

PROJECT_ID="${PROJECT_ID:-ai-support-engineer}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-agent-api}"
AR_REPO="${AR_REPO:-containers}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE_NAME}"

cd "$(dirname "$0")/.."

# Re-snapshot demo assets so the image always matches the current product
# repo's docs + fixtures. Skip with SKIP_SNAPSHOT=1 if you've already run it.
if [ "${SKIP_SNAPSHOT:-0}" != "1" ]; then
  ./scripts/snapshot-demo-assets.sh
fi

# Enable required APIs the first time we deploy in a project. Idempotent.
REQUIRED_APIS=(
  "artifactregistry.googleapis.com"
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
)
for api in "${REQUIRED_APIS[@]}"; do
  if ! gcloud services list --project="$PROJECT_ID" \
      --enabled --filter="config.name:$api" --format='value(config.name)' \
      | grep -q "$api"; then
    echo "enabling $api..."
    gcloud services enable "$api" --project="$PROJECT_ID"
  fi
done

# Ensure Artifact Registry repo exists (idempotent).
if ! gcloud artifacts repositories describe "$AR_REPO" \
    --project="$PROJECT_ID" --location="$REGION" >/dev/null 2>&1; then
  echo "creating Artifact Registry repo $AR_REPO in $REGION..."
  gcloud artifacts repositories create "$AR_REPO" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --repository-format=docker
fi

# Build remotely on Cloud Build (linux/amd64, no local platform mismatch).
echo "building image: $IMAGE"
gcloud builds submit \
  --project="$PROJECT_ID" \
  --tag="$IMAGE" \
  .

# Deploy to Cloud Run. Public widget - unauthenticated invocations allowed.
# Use ^@^ as the K=V pair separator so values containing commas (a CSV
# list of allowed widget origins) survive parsing intact.
ENV_PAIRS="NODE_ENV=production@LOG_LEVEL=info@DEMO_MODE=true@ENABLE_PR_FLOW=false@DATABASE_PATH=:memory:"
if [ -n "$ALLOWED_ORIGINS" ]; then
  ENV_PAIRS+="@WIDGET_ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
fi
DEPLOY_ARGS=(
  --project="$PROJECT_ID"
  --region="$REGION"
  --image="$IMAGE"
  --platform=managed
  --allow-unauthenticated
  --port=8080
  --cpu=1
  --memory=1Gi
  --concurrency=80
  --min-instances=0
  --max-instances=3
  --timeout=300
  --set-env-vars="^@^${ENV_PAIRS}"
)

echo "deploying to Cloud Run: $SERVICE_NAME ($REGION)"
gcloud run deploy "$SERVICE_NAME" "${DEPLOY_ARGS[@]}"

# Print the service URL - paste this into the host product's <script src>.
URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
echo
echo "service URL: $URL"
echo
echo "next:"
echo "  • smoke check:  curl -s ${URL}/health"
echo "  • loader URL:   ${URL}/widget/loader.js"
echo "  • after host product (e.g. pulsefile) deploys, run:"
echo "      ALLOWED_ORIGINS=https://your-host.example.com ./scripts/deploy-cloud-run.sh"
