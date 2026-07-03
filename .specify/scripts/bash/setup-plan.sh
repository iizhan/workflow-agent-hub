#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(get_repo_root)"
FEATURE_DIR_REL="${1:-}"
if [[ -z "$FEATURE_DIR_REL" ]]; then
    FEATURE_DIR_REL="$(sed -n 's/.*"feature_directory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO_ROOT/.specify/feature.json" 2>/dev/null || true)"
fi

if [[ -z "$FEATURE_DIR_REL" ]]; then
    echo "Usage: bash .specify/scripts/bash/setup-plan.sh specs/001-feature"
    exit 1
fi

FEATURE_DIR="$REPO_ROOT/$FEATURE_DIR_REL"
PLAN_FILE="$FEATURE_DIR/plan.md"
SPEC_FILE="$FEATURE_DIR/spec.md"
TEMPLATE="$REPO_ROOT/.specify/templates/plan-template.md"
FEATURE_NAME="$(basename "$FEATURE_DIR" | sed -E 's/^[0-9]{3}-//; s/-/ /g')"
TODAY="$(date +%F)"

mkdir -p "$FEATURE_DIR"
if [[ ! -f "$PLAN_FILE" ]]; then
    sed \
        -e "s#\\[FEATURE NAME\\]#$FEATURE_NAME#g" \
        -e "s#\\[SPECIFY_FEATURE_DIRECTORY\\]#$FEATURE_DIR_REL#g" \
        -e "s#\\[DATE\\]#$TODAY#g" \
        -e "s#\\[SPEC_FILE\\]#$SPEC_FILE#g" \
        "$TEMPLATE" > "$PLAN_FILE"
fi

printf '%s\n' "$PLAN_FILE"
