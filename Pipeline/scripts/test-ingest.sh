#!/usr/bin/env bash
# test-ingest.sh — run ingest on all synthetic scenarios and assert output structure.
#
# Usage (from repo root):
#   bash Pipeline/scripts/test-ingest.sh
#
# Prerequisites:
#   - Pipeline/target/csse230-feedback.jar must exist (run `make build` first)
#   - Pipeline/testInputs/synthetic/ must be populated (run make-test-tars.py first)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JAR="$REPO_ROOT/Pipeline/target/csse230-feedback.jar"
SYNTHETIC_DIR="$REPO_ROOT/Pipeline/testInputs/synthetic"
OUTPUT_BASE="$REPO_ROOT/Pipeline/output/test-synthetic"

# ── Preflight checks ─────────────────────────────────────────────────────────

if [ ! -f "$JAR" ]; then
    echo "ERROR: JAR not found at $JAR — run 'make build' first." >&2
    exit 1
fi

if [ ! -d "$SYNTHETIC_DIR" ] || [ -z "$(ls -A "$SYNTHETIC_DIR" 2>/dev/null)" ]; then
    echo "ERROR: No synthetic tars found at $SYNTHETIC_DIR" >&2
    echo "       Run: python3 Pipeline/scripts/make-test-tars.py" >&2
    exit 1
fi

# ── Scenario-specific expected warnings ──────────────────────────────────────
# Returns the expected warning substring for a given scenario name (or empty string).
expected_warning_for() {
    case "$1" in
        03-no-run-times)      echo "runTimes" ;;
        04-non-integer-key)   echo "Non-integer runTimes key" ;;
        *)                    echo "" ;;
    esac
}

# Scenarios expected to fail ingest (exit non-zero) — none by design: ingest degrades gracefully.
EXPECT_INGEST_FAIL=""

# ── Helpers ───────────────────────────────────────────────────────────────────

pass=0
fail=0
warn_fail=0

check_warning() {
    local scenario="$1"
    local out_dir="$2"
    local expected
    expected=$(expected_warning_for "$scenario")
    if [ -z "$expected" ]; then
        return 0
    fi
    local manifest="$out_dir/manifest.json"
    if [ ! -f "$manifest" ]; then
        echo "    WARN-CHECK SKIP: manifest.json missing for $scenario"
        return 0
    fi
    # Extract warnings array from manifest.json using python3 (always available in dev env)
    local warnings_text
    warnings_text=$(python3 -c "
import json, sys
d = json.load(open('$manifest'))
ws = d.get('warnings', [])
print('\n'.join(ws))
" 2>/dev/null || echo "")
    if echo "$warnings_text" | grep -qF "$expected"; then
        echo "    ✓ warning present: '$expected'"
    else
        echo "    ✗ MISSING expected warning: '$expected'"
        echo "      Actual warnings: $(echo "$warnings_text" | head -5 | sed 's/^/        /')"
        warn_fail=$((warn_fail + 1))
    fi
}

# ── Main loop ─────────────────────────────────────────────────────────────────

mkdir -p "$OUTPUT_BASE"

for scenario_dir in "$SYNTHETIC_DIR"/*/; do
    [ -d "$scenario_dir" ] || continue
    scenario=$(basename "$scenario_dir")
    out_dir="$OUTPUT_BASE/$scenario"
    rm -rf "$out_dir"
    mkdir -p "$out_dir"

    printf "  %-30s" "$scenario"

    # Run ingest
    ingest_output=$(java -jar "$JAR" ingest \
        -i "$scenario_dir" \
        -o "$out_dir" 2>&1) || ingest_exit=$?
    ingest_exit="${ingest_exit:-0}"

    # Check expected exit code
    expected_fail=0
    if echo "$EXPECT_INGEST_FAIL" | grep -qw "$scenario"; then
        expected_fail=1
    fi

    if [ "$expected_fail" -eq 1 ] && [ "$ingest_exit" -ne 0 ]; then
        echo "PASS (expected failure, got exit $ingest_exit)"
        pass=$((pass + 1))
        continue
    elif [ "$expected_fail" -eq 0 ] && [ "$ingest_exit" -ne 0 ]; then
        echo "FAIL (unexpected ingest exit $ingest_exit)"
        echo "      Output: $(echo "$ingest_output" | head -5)"
        fail=$((fail + 1))
        continue
    fi

    # Assert required output files exist
    missing=""
    [ ! -f "$out_dir/runs.jsonl"    ] && missing="$missing runs.jsonl"
    [ ! -f "$out_dir/manifest.json" ] && missing="$missing manifest.json"
    [ ! -f "$out_dir/diff_index.json" ] && missing="$missing diff_index.json"

    if [ -n "$missing" ]; then
        echo "FAIL (missing output files:$missing)"
        fail=$((fail + 1))
        continue
    fi

    # Assert runs.jsonl is valid JSON lines (at least one line or empty is ok)
    if ! python3 -c "
import sys
for line in open('$out_dir/runs.jsonl'):
    line = line.strip()
    if line:
        import json; json.loads(line)
" 2>/dev/null; then
        echo "FAIL (runs.jsonl contains invalid JSON)"
        fail=$((fail + 1))
        continue
    fi

    echo "PASS"
    pass=$((pass + 1))

    # Check expected warnings (advisory — counted separately)
    check_warning "$scenario" "$out_dir"
done

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "── Ingest test summary ──────────────────────────────────────────────"
echo "  $pass passed,  $fail failed,  $warn_fail warning assertion(s) failed"

total_fail=$((fail + warn_fail))
if [ "$total_fail" -gt 0 ]; then
    echo "  OVERALL: FAIL"
    exit 1
else
    echo "  OVERALL: PASS"
    exit 0
fi
