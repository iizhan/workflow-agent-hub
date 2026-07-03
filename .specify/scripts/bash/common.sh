#!/usr/bin/env bash

get_repo_root() {
    if command -v git >/dev/null 2>&1 && git rev-parse --show-toplevel >/dev/null 2>&1; then
        git rev-parse --show-toplevel
        return 0
    fi
    pwd
}

clean_branch_name() {
    local input="$1"
    local cleaned
    cleaned="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//')"
    if [[ -z "$cleaned" ]]; then
        cleaned="feature"
    fi
    printf '%s\n' "$cleaned"
}

