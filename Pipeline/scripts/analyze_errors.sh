#!/bin/bash
# analyze_errors.sh - Extract and aggregate error messages from run.tar files
#
# Usage: ./analyze_errors.sh /path/to/tars/
#        ./analyze_errors.sh /path/to/*.tar
#        ./analyze_errors.sh submission1.tar submission2.tar
#
# Outputs:
#   - Error frequency summary
#   - Detailed error list
#   - Files: error_summary.txt, error_details.txt in scriptOutputs/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/scriptOutputs"
TEMP_DIR="$OUTPUT_DIR/temp_error_analysis"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$TEMP_DIR"

SUMMARY_FILE="$OUTPUT_DIR/error_summary.txt"
DETAILS_FILE="$OUTPUT_DIR/error_details.txt"
ALL_ERRORS_FILE="$TEMP_DIR/all_errors.txt"

echo "=== Logger Error Analysis ===" > "$SUMMARY_FILE"
echo "Run: $(date)" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

echo "=== Detailed Error Log ===" > "$DETAILS_FILE"
echo "Run: $(date)" >> "$DETAILS_FILE"
echo "" >> "$DETAILS_FILE"

> "$ALL_ERRORS_FILE"

total_tars=0
tars_with_errors=0

# Handle both directory and file arguments
files=()
for arg in "$@"; do
    if [ -d "$arg" ]; then
        # Directory - find all .tar files
        while IFS= read -r -d '' f; do
            files+=("$f")
        done < <(find "$arg" -name "*.tar" -print0)
    elif [ -f "$arg" ]; then
        files+=("$arg")
    fi
done

if [ ${#files[@]} -eq 0 ]; then
    echo "Usage: $0 /path/to/tars/ or $0 *.tar"
    echo "No .tar files found"
    exit 1
fi

echo "Processing ${#files[@]} tar files..."

for tarfile in "${files[@]}"; do
    ((total_tars++))
    tarname=$(basename "$tarfile")

    # Extract error-logs.txt
    errors=$(tar -xOf "$tarfile" error-logs.txt 2>/dev/null)

    if [ -n "$errors" ] && [ ${#errors} -gt 10 ]; then
        ((tars_with_errors++))

        echo "=== $tarname ===" >> "$DETAILS_FILE"
        echo "$errors" >> "$DETAILS_FILE"
        echo "" >> "$DETAILS_FILE"

        # Extract just the ERROR lines for aggregation
        echo "$errors" | grep -E "^ERROR|^FATAL" >> "$ALL_ERRORS_FILE"
    fi
done

echo "Processed: $total_tars tar files" >> "$SUMMARY_FILE"
echo "With errors: $tars_with_errors ($(echo "scale=1; $tars_with_errors * 100 / $total_tars" | bc)%)" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

if [ -s "$ALL_ERRORS_FILE" ]; then
    echo "=== ERROR FREQUENCY ===" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Group by operation name
    echo "By Operation:" >> "$SUMMARY_FILE"
    grep -oE "ERROR in [a-zA-Z]+:" "$ALL_ERRORS_FILE" | sort | uniq -c | sort -rn >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Group by exception type
    echo "By Exception Type:" >> "$SUMMARY_FILE"
    grep -oE "[a-zA-Z]+Exception|[a-zA-Z]+Error" "$ALL_ERRORS_FILE" | sort | uniq -c | sort -rn >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Full error message frequency (truncated)
    echo "By Full Message (top 20):" >> "$SUMMARY_FILE"
    sort "$ALL_ERRORS_FILE" | uniq -c | sort -rn | head -20 >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Unique error messages
    echo "=== UNIQUE ERROR MESSAGES ===" >> "$SUMMARY_FILE"
    sort -u "$ALL_ERRORS_FILE" >> "$SUMMARY_FILE"
else
    echo "No errors found in any tar files." >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    echo "This could mean:" >> "$SUMMARY_FILE"
    echo "  1. Logger is working correctly" >> "$SUMMARY_FILE"
    echo "  2. Tars are from before the defensive error logging was added" >> "$SUMMARY_FILE"
    echo "  3. Students haven't run tests yet (empty tars)" >> "$SUMMARY_FILE"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "=== Analysis Complete ==="
cat "$SUMMARY_FILE"
echo ""
echo "Files written:"
echo "  $SUMMARY_FILE"
echo "  $DETAILS_FILE"
