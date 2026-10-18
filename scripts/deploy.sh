#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?usage: scripts/deploy.sh <commit-sha>}"

helm upgrade --install inherit charts/inherit -n inherit \
  --set image.tag="$TAG" \
  --rollback-on-failure --timeout 3m

helm test inherit -n inherit
kubectl -n inherit get pods -l app.kubernetes.io/name=inherit
