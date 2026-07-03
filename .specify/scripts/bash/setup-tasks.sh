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
    echo "Usage: bash .specify/scripts/bash/setup-tasks.sh specs/001-feature"
    exit 1
fi

FEATURE_DIR="$REPO_ROOT/$FEATURE_DIR_REL"
TASKS_FILE="$FEATURE_DIR/tasks.md"
TEMPLATE="$REPO_ROOT/.specify/templates/tasks-template.md"
FEATURE_NAME="$(basename "$FEATURE_DIR" | sed -E 's/^[0-9]{3}-//; s/-/ /g')"

mkdir -p "$FEATURE_DIR"
if [[ ! -f "$TASKS_FILE" ]]; then
    sed \
        -e "s#\\[FEATURE NAME\\]#$FEATURE_NAME#g" \
        -e "s#\\[SPECIFY_FEATURE_DIRECTORY\\]#$FEATURE_DIR_REL#g" \
        "$TEMPLATE" > "$TASKS_FILE"
fi

printf '%s\n' "$TASKS_FILE"
