#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

FEATURE_NAME="${1:-}"
if [[ -z "$FEATURE_NAME" ]]; then
    echo "Usage: bash .specify/scripts/bash/create-new-feature.sh \"feature name\""
    exit 1
fi

REPO_ROOT="$(get_repo_root)"
SPECS_DIR="$REPO_ROOT/specs"
TEMPLATE="$REPO_ROOT/.specify/templates/spec-template.md"
mkdir -p "$SPECS_DIR"

SLUG="$(clean_branch_name "$FEATURE_NAME")"
NEXT_NUMBER="$(
    find "$SPECS_DIR" -maxdepth 1 -type d -name '[0-9][0-9][0-9]-*' -print |
        sed -E 's#.*/([0-9]{3})-.*#\1#' |
        sort -n |
        tail -n 1
)"
if [[ -z "$NEXT_NUMBER" ]]; then
    NEXT_NUMBER="001"
else
    NEXT_NUMBER="$(printf "%03d" "$((10#$NEXT_NUMBER + 1))")"
fi

FEATURE_DIR="$SPECS_DIR/$NEXT_NUMBER-$SLUG"
mkdir -p "$FEATURE_DIR/checklists" "$FEATURE_DIR/contracts"

SPEC_FILE="$FEATURE_DIR/spec.md"
if [[ ! -f "$SPEC_FILE" ]]; then
    TODAY="$(date +%F)"
    sed \
        -e "s#\\[FEATURE NAME\\]#$FEATURE_NAME#g" \
        -e "s#\\[SPECIFY_FEATURE_DIRECTORY\\]#specs/$NEXT_NUMBER-$SLUG#g" \
        -e "s#\\[DATE\\]#$TODAY#g" \
        -e "s#\\$ARGUMENTS#$FEATURE_NAME#g" \
        "$TEMPLATE" > "$SPEC_FILE"
fi

cat > "$REPO_ROOT/.specify/feature.json" <<JSON
{
  "feature_directory": "specs/$NEXT_NUMBER-$SLUG"
}
JSON

printf '%s\n' "specs/$NEXT_NUMBER-$SLUG"
