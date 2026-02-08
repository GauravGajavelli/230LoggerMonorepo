#!/bin/bash
# check_tar_health.sh - Check for timing/logging issues in run.tar files within .zip archives
#
# Usage: ./check_tar_health.sh
#
# Processes all .zip files in ../testInputs/redactedTars/
# Outputs results to ./scriptOutputs/
#
# Status levels:
#   CRITICAL - Empty/malformed tar (no data captured, logging crashed)
#   WARNING  - skipLogging=true but has data (partial success, past error)
#   OK       - Normal operation

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT_DIR="$SCRIPT_DIR/../testInputs/redactedTars"
OUTPUT_DIR="$SCRIPT_DIR/scriptOutputs"
TEMP_DIR="$OUTPUT_DIR/temp_extracted"

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

# Output files
SUMMARY_FILE="$OUTPUT_DIR/health_summary.txt"
DETAILED_FILE="$OUTPUT_DIR/health_detailed.txt"
CRITICAL_FILE="$OUTPUT_DIR/critical_tars.txt"
WARNING_FILE="$OUTPUT_DIR/warning_tars.txt"

echo "=== Tar Health Check ===" > "$SUMMARY_FILE"
echo "Run: $(date)" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

echo "=== Detailed Tar Health Check ===" > "$DETAILED_FILE"
echo "Run: $(date)" >> "$DETAILED_FILE"
echo "" >> "$DETAILED_FILE"

echo "# Critical tars (empty/malformed - no data captured)" > "$CRITICAL_FILE"
echo "# Warning tars (skipLogging=true but has data)" > "$WARNING_FILE"

total_tars=0
critical_count=0
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

    # Create temp directory for this zip
    zip_temp="$TEMP_DIR/$zipname"
    rm -rf "$zip_temp"
    mkdir -p "$zip_temp"

    # Extract zip
    unzip -q -o "$zipfile" -d "$zip_temp"

    # Counters for this zip
    zip_total=0
    zip_critical=0
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
            echo "    CRITICAL: Empty or malformed tar file" >> "$DETAILED_FILE"
            echo "$tarname" >> "$CRITICAL_FILE"
            ((critical_count++))
            ((zip_critical++))
            continue
        fi

        # Extract testRunInfo.json
        info=$(tar -xOf "$tarfile" testRunInfo.json 2>/dev/null)

        if [ -z "$info" ]; then
            echo "    CRITICAL: No testRunInfo.json found" >> "$DETAILED_FILE"
            echo "$tarname (no testRunInfo.json)" >> "$CRITICAL_FILE"
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
    echo "  WARNING:  $zip_warning ($(echo "scale=1; $zip_warning * 100 / $zip_total" | bc)%)" >> "$SUMMARY_FILE"
    echo "  OK:       $zip_ok ($(echo "scale=1; $zip_ok * 100 / $zip_total" | bc)%)" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    echo "" >> "$DETAILED_FILE"
done

# Final summary
echo "=== TOTAL ===" >> "$SUMMARY_FILE"
echo "Total tar files: $total_tars" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "CRITICAL: $critical_count ($(echo "scale=1; $critical_count * 100 / $total_tars" | bc)%) - No data captured, logging crashed" >> "$SUMMARY_FILE"
echo "WARNING:  $warning_count ($(echo "scale=1; $warning_count * 100 / $total_tars" | bc)%) - Has data but self-shutoff triggered" >> "$SUMMARY_FILE"
echo "OK:       $ok_count ($(echo "scale=1; $ok_count * 100 / $total_tars" | bc)%) - Normal operation" >> "$SUMMARY_FILE"

# Cleanup temp files
rm -rf "$TEMP_DIR"

echo ""
echo "Done! Results:"
cat "$SUMMARY_FILE"
echo ""
echo "Files written:"
echo "  $SUMMARY_FILE"
echo "  $DETAILED_FILE"
echo "  $CRITICAL_FILE"
echo "  $WARNING_FILE"
