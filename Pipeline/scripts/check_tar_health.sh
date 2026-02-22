#!/bin/bash
# check_tar_health.sh - Check for timing/logging issues in run.tar files within .zip archives
#
# Usage: ./check_tar_health.sh [--sizes-dir DIR] [--baseline-size BYTES] [--baseline-threshold BYTES]
#
# Options:
#   --sizes-dir DIR           Directory containing repo size files (e.g., allFolderSizesBST.txt)
#                             Files should have format: "BYTES bytes \t runXX"
#   --baseline-size BYTES     Override auto-detected baseline size (template repo size)
#   --baseline-threshold BYTES Size difference to consider "engaged" (default: 20000 bytes / ~20KB)
#
# Processes all .zip files in ../testInputs/redactedTars/
# Outputs results to ./scriptOutputs/
#
# Status levels:
#   CRITICAL_NO_ENGAGEMENT - Empty tar + template-sized repo (student likely never ran tests)
#   CRITICAL_LOGGER_BUG    - Empty tar + larger repo (student wrote code, logger failed)
#   CRITICAL               - Empty tar, no repo size data available
#   WARNING                - skipLogging=true but has data (partial success, past error)
#   OK                     - Normal operation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT_DIR="$SCRIPT_DIR/../testInputs/redactedTars"
OUTPUT_DIR="$SCRIPT_DIR/scriptOutputs"
TEMP_DIR="$OUTPUT_DIR/temp_extracted"

# Default values
SIZES_DIR=""
BASELINE_SIZE=""
BASELINE_THRESHOLD=20000  # 20KB difference to consider "engaged"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --sizes-dir)
            SIZES_DIR="$2"
            shift 2
            ;;
        --baseline-size)
            BASELINE_SIZE="$2"
            shift 2
            ;;
        --baseline-threshold)
            BASELINE_THRESHOLD="$2"
            shift 2
            ;;
        -h|--help)
            head -20 "$0" | tail -18
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# File to store repo sizes (bash 3.x compatible - no associative arrays)
SIZES_TEMP_FILE=""

# Function to load repo sizes from a file into temp lookup file
load_repo_sizes() {
    local sizefile="$1"
    if [ ! -f "$sizefile" ]; then
        return
    fi
    # Create temp file for this zip's sizes
    SIZES_TEMP_FILE=$(mktemp)
    # Parse lines like "6823936 bytes 	  run02" and store as "run02 6823936"
    grep -E '^[0-9]+[[:space:]]+bytes' "$sizefile" | while read -r line; do
        size=$(echo "$line" | grep -oE '^[0-9]+')
        runnum=$(echo "$line" | grep -oE 'run[0-9]+')
        if [ -n "$size" ] && [ -n "$runnum" ]; then
            echo "$runnum $size" >> "$SIZES_TEMP_FILE"
        fi
    done
}

# Function to get repo size for a run
get_repo_size() {
    local runname="$1"
    # Strip .tar extension if present
    runname="${runname%.tar}"

    if [ -z "$SIZES_TEMP_FILE" ] || [ ! -f "$SIZES_TEMP_FILE" ]; then
        echo ""
        return
    fi
    grep "^${runname} " "$SIZES_TEMP_FILE" 2>/dev/null | awk '{print $2}'
}

# Function to check if a student engaged based on repo size
check_engagement() {
    local runname="$1"
    local baseline="$2"

    # Strip .tar extension if present
    runname="${runname%.tar}"

    local size=$(get_repo_size "$runname")

    if [ -z "$size" ] || [ -z "$baseline" ]; then
        echo "unknown"
        return
    fi

    local diff=$((size - baseline))
    if [ "$diff" -gt "$BASELINE_THRESHOLD" ]; then
        echo "engaged"
    else
        echo "minimal"
    fi
}

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

# Output files
SUMMARY_FILE="$OUTPUT_DIR/health_summary.txt"
DETAILED_FILE="$OUTPUT_DIR/health_detailed.txt"
CRITICAL_FILE="$OUTPUT_DIR/critical_tars.txt"
WARNING_FILE="$OUTPUT_DIR/warning_tars.txt"
ENGAGEMENT_FILE="$OUTPUT_DIR/engagement_analysis.txt"

echo "=== Tar Health Check ===" > "$SUMMARY_FILE"
echo "Run: $(date)" >> "$SUMMARY_FILE"
if [ -n "$SIZES_DIR" ]; then
    echo "Repo sizes from: $SIZES_DIR" >> "$SUMMARY_FILE"
    echo "Baseline threshold: $BASELINE_THRESHOLD bytes" >> "$SUMMARY_FILE"
fi
echo "" >> "$SUMMARY_FILE"

echo "=== Detailed Tar Health Check ===" > "$DETAILED_FILE"
echo "Run: $(date)" >> "$DETAILED_FILE"
echo "" >> "$DETAILED_FILE"

echo "# Critical tars (empty/malformed - no data captured)" > "$CRITICAL_FILE"
echo "# Warning tars (skipLogging=true but has data)" > "$WARNING_FILE"

echo "=== Engagement Analysis ===" > "$ENGAGEMENT_FILE"
echo "Run: $(date)" >> "$ENGAGEMENT_FILE"
echo "Baseline threshold: $BASELINE_THRESHOLD bytes above template size" >> "$ENGAGEMENT_FILE"
echo "" >> "$ENGAGEMENT_FILE"

total_tars=0
critical_count=0
critical_no_engage=0
critical_logger_bug=0
warning_count=0
ok_count=0

# Process each .zip file
for zipfile in "$INPUT_DIR"/*.zip; do
    if [ ! -f "$zipfile" ]; then
        continue
    fi

    zipname=$(basename "$zipfile" .zip)
    echo "Processing: $zipname"
    echo "=== $zipname ===" >> "$DETAILED_FILE"
    echo "" >> "$CRITICAL_FILE"
    echo "=== $zipname ===" >> "$CRITICAL_FILE"
    echo "" >> "$WARNING_FILE"
    echo "=== $zipname ===" >> "$WARNING_FILE"
    echo "=== $zipname ===" >> "$ENGAGEMENT_FILE"

    # Load repo sizes if available
    # Clean up previous temp file
    if [ -n "$SIZES_TEMP_FILE" ] && [ -f "$SIZES_TEMP_FILE" ]; then
        rm -f "$SIZES_TEMP_FILE"
    fi
    SIZES_TEMP_FILE=""
    zip_has_sizes=false
    zip_baseline=""

    if [ -n "$SIZES_DIR" ]; then
        # Try to find matching size file - extract assignment name from zip
        # e.g., allTar-StringHashSet -> StringHashSet
        assignment_name="${zipname#allTar-}"
        for pattern in "allFolderSizes${assignment_name}.txt" "allFolderSizes${zipname}.txt" "sizes_${assignment_name}.txt"; do
            sizefile="$SIZES_DIR/$pattern"
            if [ -f "$sizefile" ]; then
                echo "  Loading sizes from: $pattern"
                load_repo_sizes "$sizefile"
                zip_has_sizes=true

                # Auto-detect baseline if not specified
                if [ -n "$BASELINE_SIZE" ]; then
                    zip_baseline="$BASELINE_SIZE"
                else
                    zip_baseline=$(grep -oE '^[0-9]+' "$sizefile" | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
                fi
                echo "  Baseline size: $zip_baseline bytes"
                echo "Baseline (template) size: $zip_baseline bytes" >> "$ENGAGEMENT_FILE"
                break
            fi
        done
    fi

    if [ "$zip_has_sizes" = false ]; then
        echo "  (no repo size data available)"
        echo "(no repo size data available)" >> "$ENGAGEMENT_FILE"
    fi
    echo "" >> "$ENGAGEMENT_FILE"

    # Create temp directory for this zip
    zip_temp="$TEMP_DIR/$zipname"
    rm -rf "$zip_temp"
    mkdir -p "$zip_temp"

    # Extract zip
    unzip -q -o "$zipfile" -d "$zip_temp"

    # Counters for this zip
    zip_total=0
    zip_critical=0
    zip_critical_no_engage=0
    zip_critical_logger_bug=0
    zip_warning=0
    zip_ok=0

    while IFS= read -r -d '' tarfile; do
        ((total_tars++))
        ((zip_total++))

        tarname=$(basename "$tarfile")
        tarsize=$(stat -f%z "$tarfile" 2>/dev/null || stat -c%s "$tarfile" 2>/dev/null)

        echo "  --- $tarname (${tarsize} bytes) ---" >> "$DETAILED_FILE"

        # Check if file is empty or too small to be valid
        if [ "$tarsize" -lt 100 ]; then
            # Check engagement if we have size data
            engagement=$(check_engagement "$tarname" "$zip_baseline")
            runname="${tarname%.tar}"
            repo_size=$(get_repo_size "$runname")

            if [ "$engagement" = "engaged" ]; then
                echo "    CRITICAL_LOGGER_BUG: Empty tar but student wrote code (repo: $repo_size bytes)" >> "$DETAILED_FILE"
                echo "$tarname (LOGGER_BUG: repo=$repo_size)" >> "$CRITICAL_FILE"
                echo "$runname: LOGGER_BUG (repo=$repo_size, baseline=$zip_baseline, diff=$((repo_size - zip_baseline)))" >> "$ENGAGEMENT_FILE"
                ((critical_logger_bug++))
                ((zip_critical_logger_bug++))
            elif [ "$engagement" = "minimal" ]; then
                echo "    CRITICAL_NO_ENGAGEMENT: Empty tar + template-sized repo (repo: $repo_size bytes)" >> "$DETAILED_FILE"
                echo "$tarname (NO_ENGAGEMENT: repo=$repo_size)" >> "$CRITICAL_FILE"
                echo "$runname: NO_ENGAGEMENT (repo=$repo_size, baseline=$zip_baseline, diff=$((repo_size - zip_baseline)))" >> "$ENGAGEMENT_FILE"
                ((critical_no_engage++))
                ((zip_critical_no_engage++))
            else
                echo "    CRITICAL: Empty or malformed tar file" >> "$DETAILED_FILE"
                echo "$tarname" >> "$CRITICAL_FILE"
            fi
            ((critical_count++))
            ((zip_critical++))
            continue
        fi

        # Extract testRunInfo.json
        info=$(tar -xOf "$tarfile" testRunInfo.json 2>/dev/null)

        if [ -z "$info" ]; then
            # Check engagement for this case too
            engagement=$(check_engagement "$tarname" "$zip_baseline")
            runname="${tarname%.tar}"
            repo_size=$(get_repo_size "$runname")

            if [ "$engagement" = "engaged" ]; then
                echo "    CRITICAL_LOGGER_BUG: No testRunInfo.json but student wrote code (repo: $repo_size bytes)" >> "$DETAILED_FILE"
                echo "$tarname (LOGGER_BUG, no testRunInfo.json: repo=$repo_size)" >> "$CRITICAL_FILE"
                echo "$runname: LOGGER_BUG (repo=$repo_size, no testRunInfo.json)" >> "$ENGAGEMENT_FILE"
                ((critical_logger_bug++))
                ((zip_critical_logger_bug++))
            elif [ "$engagement" = "minimal" ]; then
                echo "    CRITICAL_NO_ENGAGEMENT: No testRunInfo.json + template-sized repo (repo: $repo_size bytes)" >> "$DETAILED_FILE"
                echo "$tarname (NO_ENGAGEMENT, no testRunInfo.json: repo=$repo_size)" >> "$CRITICAL_FILE"
                echo "$runname: NO_ENGAGEMENT (repo=$repo_size, no testRunInfo.json)" >> "$ENGAGEMENT_FILE"
                ((critical_no_engage++))
                ((zip_critical_no_engage++))
            else
                echo "    CRITICAL: No testRunInfo.json found" >> "$DETAILED_FILE"
                echo "$tarname (no testRunInfo.json)" >> "$CRITICAL_FILE"
            fi
            ((critical_count++))
            ((zip_critical++))
            continue
        fi

        # Check skipLogging
        skip=$(echo "$info" | grep -o '"skipLogging"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false')
        echo "    skipLogging: $skip" >> "$DETAILED_FILE"

        # Check strikes
        strikes=$(echo "$info" | grep -o '"strikes"[[:space:]]*:[[:space:]]*{[^}]*}')
        strike_count=$(echo "$strikes" | grep -o 'true' | wc -l | tr -d ' ')
        echo "    strikes: $strike_count" >> "$DETAILED_FILE"

        # Check prevRunNumber (how many successful runs)
        run_number=$(echo "$info" | grep -o '"prevRunNumber"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')
        echo "    prevRunNumber: $run_number" >> "$DETAILED_FILE"

        # Check error-logs.txt
        errors=$(tar -xOf "$tarfile" error-logs.txt 2>/dev/null)
        if [ -n "$errors" ]; then
            error_lines=$(echo "$errors" | wc -l | tr -d ' ')
            echo "    error-logs.txt: $error_lines lines" >> "$DETAILED_FILE"
        else
            echo "    error-logs.txt: empty/none" >> "$DETAILED_FILE"
        fi

        # Determine status
        if [ "$skip" = "true" ] || [ "$strike_count" -ge 2 ]; then
            echo "    STATUS: WARNING (has data but skipLogging=$skip, strikes=$strike_count)" >> "$DETAILED_FILE"
            echo "$tarname (runs=$run_number, skipLogging=$skip, strikes=$strike_count)" >> "$WARNING_FILE"
            ((warning_count++))
            ((zip_warning++))
        else
            echo "    STATUS: OK" >> "$DETAILED_FILE"
            ((ok_count++))
            ((zip_ok++))
        fi

    done < <(find "$zip_temp" -name "*.tar" -print0)

    # Per-zip summary
    echo "$zipname:" >> "$SUMMARY_FILE"
    echo "  Total: $zip_total" >> "$SUMMARY_FILE"
    echo "  CRITICAL: $zip_critical ($(echo "scale=1; $zip_critical * 100 / $zip_total" | bc)%)" >> "$SUMMARY_FILE"
    if [ "$zip_has_sizes" = true ] && [ "$zip_critical" -gt 0 ]; then
        echo "    - No engagement (template-sized): $zip_critical_no_engage" >> "$SUMMARY_FILE"
        echo "    - Logger bug (has code):          $zip_critical_logger_bug" >> "$SUMMARY_FILE"
        echo "    - Unknown (no size data):         $((zip_critical - zip_critical_no_engage - zip_critical_logger_bug))" >> "$SUMMARY_FILE"
    fi
    echo "  WARNING:  $zip_warning ($(echo "scale=1; $zip_warning * 100 / $zip_total" | bc)%)" >> "$SUMMARY_FILE"
    echo "  OK:       $zip_ok ($(echo "scale=1; $zip_ok * 100 / $zip_total" | bc)%)" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Per-zip engagement summary
    if [ "$zip_has_sizes" = true ]; then
        echo "" >> "$ENGAGEMENT_FILE"
        echo "Summary for $zipname:" >> "$ENGAGEMENT_FILE"
        echo "  CRITICAL total: $zip_critical" >> "$ENGAGEMENT_FILE"
        echo "    No engagement: $zip_critical_no_engage ($(echo "scale=1; $zip_critical_no_engage * 100 / ($zip_critical + 1)" | bc)%)" >> "$ENGAGEMENT_FILE"
        echo "    Logger bug:    $zip_critical_logger_bug ($(echo "scale=1; $zip_critical_logger_bug * 100 / ($zip_critical + 1)" | bc)%)" >> "$ENGAGEMENT_FILE"
    fi
    echo "" >> "$ENGAGEMENT_FILE"
    echo "" >> "$DETAILED_FILE"
done

# Final summary
echo "=== TOTAL ===" >> "$SUMMARY_FILE"
echo "Total tar files: $total_tars" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "CRITICAL: $critical_count ($(echo "scale=1; $critical_count * 100 / $total_tars" | bc)%) - No data captured" >> "$SUMMARY_FILE"
if [ -n "$SIZES_DIR" ]; then
    echo "  Breakdown (where repo size data available):" >> "$SUMMARY_FILE"
    echo "    - No engagement (template-sized): $critical_no_engage - Student likely never ran tests" >> "$SUMMARY_FILE"
    echo "    - Logger bug (has code):          $critical_logger_bug - Logger failed despite student work" >> "$SUMMARY_FILE"
    unknown_critical=$((critical_count - critical_no_engage - critical_logger_bug))
    echo "    - Unknown (no size data):         $unknown_critical" >> "$SUMMARY_FILE"
fi
echo "WARNING:  $warning_count ($(echo "scale=1; $warning_count * 100 / $total_tars" | bc)%) - Has data but self-shutoff triggered" >> "$SUMMARY_FILE"
echo "OK:       $ok_count ($(echo "scale=1; $ok_count * 100 / $total_tars" | bc)%) - Normal operation" >> "$SUMMARY_FILE"

# Final engagement summary
if [ -n "$SIZES_DIR" ]; then
    echo "" >> "$ENGAGEMENT_FILE"
    echo "=== OVERALL ENGAGEMENT ANALYSIS ===" >> "$ENGAGEMENT_FILE"
    echo "Total CRITICAL: $critical_count" >> "$ENGAGEMENT_FILE"
    if [ "$critical_count" -gt 0 ]; then
        echo "  No engagement (likely never ran tests): $critical_no_engage ($(echo "scale=1; $critical_no_engage * 100 / $critical_count" | bc)%)" >> "$ENGAGEMENT_FILE"
        echo "  Logger bug (student wrote code):        $critical_logger_bug ($(echo "scale=1; $critical_logger_bug * 100 / $critical_count" | bc)%)" >> "$ENGAGEMENT_FILE"
    fi
    echo "" >> "$ENGAGEMENT_FILE"
    echo "Interpretation:" >> "$ENGAGEMENT_FILE"
    echo "  - NO_ENGAGEMENT: Repo size within $BASELINE_THRESHOLD bytes of template" >> "$ENGAGEMENT_FILE"
    echo "  - LOGGER_BUG: Repo size > $BASELINE_THRESHOLD bytes above template" >> "$ENGAGEMENT_FILE"
fi

# Cleanup temp files
rm -rf "$TEMP_DIR"
if [ -n "$SIZES_TEMP_FILE" ] && [ -f "$SIZES_TEMP_FILE" ]; then
    rm -f "$SIZES_TEMP_FILE"
fi

echo ""
echo "Done! Results:"
cat "$SUMMARY_FILE"
echo ""
echo "Files written:"
echo "  $SUMMARY_FILE"
echo "  $DETAILED_FILE"
echo "  $CRITICAL_FILE"
echo "  $WARNING_FILE"
if [ -n "$SIZES_DIR" ]; then
    echo "  $ENGAGEMENT_FILE"
fi
