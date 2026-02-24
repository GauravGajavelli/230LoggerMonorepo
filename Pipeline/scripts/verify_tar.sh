#!/bin/bash
# verify_tar.sh - Validate a single run.tar produced by the testSupport logger
#
# Usage: ./verify_tar.sh <path-to-run.tar> [--verbose] [--expect-runs N]
#
# Runs 8 structural/semantic checks (+ optional run-count check) and prints
# PASS/FAIL for each. Cross-platform: Mac, Linux, Windows Git Bash.
# Dependencies: bash, tar, python3 (for JSON parsing), unzip (for diff archives)
#
# Options:
#   --verbose, -v       Show extra detail per check
#   --expect-runs N     Assert prevRunNumber == N (proves flush-once-per-run via LauncherSessionListener)

set -euo pipefail

# ── Colours (disabled if not a terminal) ─────────────────────────────────────
if [ -t 1 ]; then
    GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
    GREEN=''; RED=''; YELLOW=''; NC=''
fi

# ── Args ─────────────────────────────────────────────────────────────────────
VERBOSE=false
TAR_PATH=""
EXPECT_RUNS=""

while [ $# -gt 0 ]; do
    case "$1" in
        --verbose|-v) VERBOSE=true; shift ;;
        --expect-runs)
            EXPECT_RUNS="$2"; shift 2 ;;
        --help|-h)
            head -12 "$0" | tail -11
            exit 0
            ;;
        -*)
            echo "Error: unknown option '$1'"
            exit 1
            ;;
        *)
            if [ -z "$TAR_PATH" ]; then
                TAR_PATH="$1"
            else
                echo "Error: unexpected argument '$1'"
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$TAR_PATH" ]; then
    echo "Usage: $0 <path-to-run.tar> [--verbose] [--expect-runs N]"
    exit 1
fi

# ── State ────────────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_CHECKS=8
if [ -n "$EXPECT_RUNS" ]; then
    TOTAL_CHECKS=9
fi

pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
verbose() { if $VERBOSE; then echo "       $1"; fi; }

TMPDIR_BASE=$(mktemp -d)
trap 'rm -rf "$TMPDIR_BASE"' EXIT

# ── Check 1: Tar exists & non-trivial ───────────────────────────────────────
if [ ! -f "$TAR_PATH" ]; then
    fail "Tar does not exist: $TAR_PATH"
    echo "=== 0/$TOTAL_CHECKS PASSED (file not found, remaining checks skipped) ==="
    exit 1
fi

TAR_SIZE=$(wc -c < "$TAR_PATH" | tr -d ' ')

if [ "$TAR_SIZE" -le 100 ]; then
    fail "Tar too small ($TAR_SIZE bytes, need >100)"
    echo "=== 0/$TOTAL_CHECKS PASSED (tar too small, remaining checks skipped) ==="
    exit 1
fi

pass "Tar exists ($TAR_SIZE bytes)"

# ── Check 2: Tar structure ──────────────────────────────────────────────────
TAR_ENTRIES=$(tar -tf "$TAR_PATH" 2>/dev/null) || {
    fail "Cannot list tar contents (corrupt archive?)"
    echo "=== $PASS_COUNT/$TOTAL_CHECKS PASSED ==="
    exit 1
}

HAS_TEST_RUN_INFO=false
UNEXPECTED_ENTRIES=""
ENTRY_COUNT=0
DIFF_ARCHIVES=""

while IFS= read -r entry; do
    ENTRY_COUNT=$((ENTRY_COUNT + 1))
    case "$entry" in
        testRunInfo.json)   HAS_TEST_RUN_INFO=true ;;
        error-logs.txt)     ;; # expected
        diffs_*_.tar.zip)   DIFF_ARCHIVES="$DIFF_ARCHIVES $entry" ;;
        *)                  UNEXPECTED_ENTRIES="$UNEXPECTED_ENTRIES $entry" ;;
    esac
done <<< "$TAR_ENTRIES"

if ! $HAS_TEST_RUN_INFO; then
    fail "Structure: missing testRunInfo.json"
    echo "=== $PASS_COUNT/$TOTAL_CHECKS PASSED ==="
    exit 1
fi

if [ -n "$UNEXPECTED_ENTRIES" ]; then
    fail "Structure: unexpected entries:$UNEXPECTED_ENTRIES"
else
    pass "Structure valid ($ENTRY_COUNT entries)"
    verbose "Entries: $(echo "$TAR_ENTRIES" | tr '\n' ', ')"
fi

# ── Extract testRunInfo.json ─────────────────────────────────────────────────
JSON_FILE="$TMPDIR_BASE/testRunInfo.json"
tar -xOf "$TAR_PATH" testRunInfo.json > "$JSON_FILE" 2>/dev/null

# ── Checks 3-7: JSON validation via Python ──────────────────────────────────
# Single Python invocation handles checks 3 through 7 for efficiency.
export JSON_FILE
export VERBOSE
export EXPECT_RUNS
PYTHON_OUTPUT=$(python3 << 'PYEOF'
import json, sys, os

json_path = os.environ["JSON_FILE"]
verbose = os.environ.get("VERBOSE", "false") == "true"

RESERVED_KEYS = {
    "prevRunNumber", "randomSeed", "redactDiffs", "rebaselining",
    "toIgnore", "skipLogging", "strikes", "prevBaselineRunNumber", "runTimes",
    "schema_version",
    "beforeAllInitDurationMs", "beforeAllTotalDurationMs",
    "closeDurationMs", "closeTiming",
}

REQUIRED_FIELDS = [
    "prevRunNumber", "runTimes", "skipLogging", "strikes",
    "redactDiffs", "rebaselining", "prevBaselineRunNumber", "schema_version"
]

VALID_STATUS_PREFIXES = ("SUCCESSFUL", "FAILED", "ABORTED", "DISABLED")

results = {}  # check_name -> (pass:bool, message:str, details:list[str])

# ── Check 3: Valid JSON ──────────────────────────────────────────────────────
try:
    with open(json_path, "r") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        results["json"] = (False, "Top-level is not a JSON object", [])
        # Can't continue without a dict
        for name, msg in [("schema", "Skipped"), ("consistency", "Skipped"),
                          ("performance", "Skipped"), ("tests", "Skipped")]:
            results[name] = (False, msg, [])
        for name in sorted(results):
            ok, msg, details = results[name]
            print(f"{'PASS' if ok else 'FAIL'}|{name}|{msg}")
            for d in details:
                print(f"DETAIL|{name}|{d}")
        sys.exit(0)
    results["json"] = (True, "Valid JSON", [])
except json.JSONDecodeError as e:
    results["json"] = (False, f"Invalid JSON: {e}", [])
    for name in ["schema", "consistency", "performance", "tests"]:
        results[name] = (False, "Skipped (invalid JSON)", [])
    for name in sorted(results):
        ok, msg, details = results[name]
        print(f"{'PASS' if ok else 'FAIL'}|{name}|{msg}")
    sys.exit(0)

# ── Check 4: Schema ─────────────────────────────────────────────────────────
missing = [f for f in REQUIRED_FIELDS if f not in data]
if missing:
    results["schema"] = (False, f"Missing {len(missing)} required fields: {', '.join(missing)}", [])
else:
    results["schema"] = (True, f"Schema complete ({len(REQUIRED_FIELDS)}/{len(REQUIRED_FIELDS)} required fields)", [])

# ── Check 5: Run consistency ────────────────────────────────────────────────
prev_run = data.get("prevRunNumber")
run_times = data.get("runTimes", {})
details5 = []

if prev_run is None or not isinstance(run_times, dict):
    results["consistency"] = (False, "Cannot check: prevRunNumber or runTimes missing/malformed", [])
else:
    # Parse run_times keys as integers
    rt_keys = []
    bad_keys = []
    for k in run_times:
        try:
            rt_keys.append(int(k))
        except ValueError:
            bad_keys.append(k)

    rt_keys.sort()
    issues = []

    # Count match
    if prev_run != len(rt_keys):
        issues.append(f"prevRunNumber={prev_run} but runTimes has {len(rt_keys)} entries")

    if bad_keys:
        issues.append(f"Non-integer runTimes keys: {bad_keys}")

    # Consecutive check: keys should be 1..N (or possibly starting from a different offset)
    if rt_keys:
        expected_start = rt_keys[0]
        expected = list(range(expected_start, expected_start + len(rt_keys)))
        if rt_keys != expected:
            gaps = [i for i in expected if i not in rt_keys]
            if gaps:
                issues.append(f"Non-consecutive runTimes keys (gaps at: {gaps[:5]}{'...' if len(gaps)>5 else ''})")
                if verbose:
                    details5.append(f"Keys: {rt_keys[:20]}{'...' if len(rt_keys)>20 else ''}")

    if issues:
        results["consistency"] = (False, "; ".join(issues), details5)
    else:
        results["consistency"] = (True, f"Run consistency: prevRunNumber={prev_run}, runTimes={len(rt_keys)} entries", details5)

# ── Check 6: Performance ────────────────────────────────────────────────────
skip_logging = data.get("skipLogging")
strikes_obj = data.get("strikes", {})
details6 = []

if not isinstance(strikes_obj, dict):
    results["performance"] = (False, "strikes is not an object", [])
else:
    strike_trues = sum(1 for v in strikes_obj.values() if v is True)
    issues = []
    if skip_logging is True:
        issues.append("skipLogging=true")
    if strike_trues > 0:
        issues.append(f"{strike_trues} true value(s) in strikes")
        if verbose:
            flagged = {k: v for k, v in strikes_obj.items() if v is True}
            details6.append(f"Struck entries: {flagged}")

    if issues:
        results["performance"] = (False, f"Performance issue: {'; '.join(issues)}", details6)
    else:
        msg = f"Performance: skipLogging=false, strikes={strike_trues}"
        results["performance"] = (True, msg, details6)

# ── Check 7: Test results ───────────────────────────────────────────────────
test_classes = {k: v for k, v in data.items() if k not in RESERVED_KEYS}
details7 = []
issues = []
total_methods = 0
total_results = 0
bad_statuses = []

for cls_name, cls_obj in test_classes.items():
    if not isinstance(cls_obj, dict):
        issues.append(f"Class '{cls_name}' is not an object")
        continue

    for method_name, method_obj in cls_obj.items():
        total_methods += 1
        if not isinstance(method_obj, dict):
            issues.append(f"Method '{cls_name}.{method_name}' is not an object")
            continue

        for run_key, run_obj in method_obj.items():
            # run_key should be a run number (string int)
            if isinstance(run_obj, dict):
                # New format: {"status": "...", "evidence": {...}}
                status = run_obj.get("status", "")
            elif isinstance(run_obj, str):
                # Old format: direct status string
                status = run_obj
            else:
                continue
            total_results += 1
            if not any(status.startswith(prefix) for prefix in VALID_STATUS_PREFIXES):
                bad_statuses.append(f"{cls_name}.{method_name}[{run_key}]: '{status[:50]}'")

if not test_classes:
    issues.append("No test classes found (only reserved keys)")

if bad_statuses:
    issues.append(f"{len(bad_statuses)} result(s) with unexpected status prefix")
    if verbose:
        for bs in bad_statuses[:5]:
            details7.append(f"Bad status: {bs}")

if issues:
    results["tests"] = (False, "; ".join(issues), details7)
else:
    results["tests"] = (True, f"Test results: {len(test_classes)} classes, {total_methods} methods, {total_results} results", details7)

# ── Check 9 (optional): Expected run count ───────────────────────────────────
expect_runs_str = os.environ.get("EXPECT_RUNS", "")
if expect_runs_str:
    try:
        expected = int(expect_runs_str)
        actual = data.get("prevRunNumber")
        if actual == expected:
            results["runcount"] = (True, f"Run count: prevRunNumber={actual} matches expected {expected}", [])
        else:
            results["runcount"] = (False, f"Run count mismatch: prevRunNumber={actual}, expected {expected}", [])
    except (ValueError, TypeError):
        results["runcount"] = (False, f"Bad --expect-runs value: {expect_runs_str}", [])

# ── Output ───────────────────────────────────────────────────────────────────
check_order = ["json", "schema", "consistency", "performance", "tests"]
if "runcount" in results:
    check_order.append("runcount")
for name in check_order:
    ok, msg, details = results[name]
    print(f"{'PASS' if ok else 'FAIL'}|{name}|{msg}")
    for d in details:
        print(f"DETAIL|{name}|{d}")
PYEOF
)

# Parse Python output into pass/fail calls
while IFS='|' read -r status name msg; do
    case "$status" in
        PASS)   pass "$msg" ;;
        FAIL)   fail "$msg" ;;
        DETAIL) verbose "$msg" ;;
    esac
done <<< "$PYTHON_OUTPUT"

# ── Check 8: Diff archives ──────────────────────────────────────────────────
DIFF_ARCHIVES=$(echo "$DIFF_ARCHIVES" | xargs)  # trim whitespace

if [ -z "$DIFF_ARCHIVES" ]; then
    pass "Diff archives: none present (OK for few runs)"
else
    ARCHIVE_COUNT=0
    ARCHIVE_ERRORS=""

    for archive in $DIFF_ARCHIVES; do
        ARCHIVE_COUNT=$((ARCHIVE_COUNT + 1))

        # Validate filename pattern: diffs_<digits>_.tar.zip
        if ! echo "$archive" | grep -qE '^diffs_[0-9]+_\.tar\.zip$'; then
            ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Bad filename: $archive\n"
            continue
        fi

        # Extract the archive from the tar into tmpdir
        ARCHIVE_PATH="$TMPDIR_BASE/$archive"
        tar -xf "$TAR_PATH" -C "$TMPDIR_BASE" "$archive" 2>/dev/null || {
            ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Cannot extract: $archive\n"
            continue
        }

        # Validate it's a valid ZIP
        unzip -t "$ARCHIVE_PATH" > /dev/null 2>&1 || {
            ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Invalid ZIP: $archive\n"
            continue
        }

        # Extract the inner file and check it's a valid TAR
        INNER_DIR="$TMPDIR_BASE/inner_$ARCHIVE_COUNT"
        mkdir -p "$INNER_DIR"
        unzip -o -q "$ARCHIVE_PATH" -d "$INNER_DIR" 2>/dev/null || {
            ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Cannot unzip: $archive\n"
            continue
        }

        # The zip should contain a file named "diffs" which is a tar
        INNER_TAR="$INNER_DIR/diffs"
        if [ ! -f "$INNER_TAR" ]; then
            # Try finding whatever file is in there
            INNER_TAR=$(find "$INNER_DIR" -type f | head -1)
            if [ -z "$INNER_TAR" ]; then
                ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Empty ZIP: $archive\n"
                continue
            fi
        fi

        tar -tf "$INNER_TAR" > /dev/null 2>&1 || {
            ARCHIVE_ERRORS="$ARCHIVE_ERRORS  Inner file is not a valid TAR: $archive\n"
            continue
        }

        verbose "Archive $archive: valid ZIP+TAR"
    done

    if [ -n "$ARCHIVE_ERRORS" ]; then
        fail "Diff archives: $ARCHIVE_COUNT archive(s), errors found"
        if $VERBOSE; then
            echo -e "$ARCHIVE_ERRORS" | while read -r line; do
                [ -n "$line" ] && verbose "$line"
            done
        fi
    else
        pass "Diff archives: $ARCHIVE_COUNT archive(s), valid"
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}=== $PASS_COUNT/$TOTAL_CHECKS PASSED ===${NC}"
    exit 0
else
    echo -e "${RED}=== $PASS_COUNT/$TOTAL_CHECKS PASSED, $FAIL_COUNT FAILED ===${NC}"
    exit 1
fi
