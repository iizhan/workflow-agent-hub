#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

REPO_ROOT="$(get_repo_root)"
FEATURE_DIR_REL="${1:-}"
CHECKLIST_NAME="${2:-requirements}"

if [[ -z "$FEATURE_DIR_REL" ]]; then
    FEATURE_DIR_REL="$(sed -n 's/.*"feature_directory"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO_ROOT/.specify/feature.json" 2>/dev/null || true)"
fi

if [[ -z "$FEATURE_DIR_REL" ]]; then
    echo "Usage: bash .specify/scripts/bash/setup-checklist.sh specs/001-feature [requirements]"
    exit 1
fi

FEATURE_DIR="$REPO_ROOT/$FEATURE_DIR_REL"
CHECKLIST_DIR="$FEATURE_DIR/checklists"
CHECKLIST_FILE="$CHECKLIST_DIR/$CHECKLIST_NAME.md"
TEMPLATE="$REPO_ROOT/.specify/templates/checklist-template.md"
DISPLAY_NAME="$(printf '%s' "$CHECKLIST_NAME" | sed 's/-/ /g')"

mkdir -p "$CHECKLIST_DIR"
if [[ ! -f "$CHECKLIST_FILE" ]]; then
    sed \
        -e "s#\\[CHECKLIST NAME\\]#$DISPLAY_NAME#g" \
        "$TEMPLATE" > "$CHECKLIST_FILE"
fi

printf '%s\n' "$CHECKLIST_FILE"
