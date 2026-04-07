#!/usr/bin/env bash
# stage-tars.sh <zip-file> <assignment-slug>
#
# Unpacks a zip of run-<githubUsername>.tar files into data/<assignment>/tars/<student_id>/run.tar.
# - Skips 0-byte tars (those students get the missing_tar email path automatically)
# - Skips students already staged (safe to re-run when a new zip arrives with more tars)
# - Reports NEW / SKIP(empty) / SKIP(exists) for each entry
#
# Usage (from Frontend/):
#   bash scripts/stage-tars.sh /path/to/allTar-BST-Sp2026.zip bst
#   bash scripts/stage-tars.sh /path/to/allTar-BST-Sp2026-v2.zip bst   # incremental

set -euo pipefail

ZIPFILE="${1:-}"
ASSIGNMENT="${2:-}"

if [[ -z "$ZIPFILE" || -z "$ASSIGNMENT" ]]; then
  echo "Usage: bash scripts/stage-tars.sh <zip-file> <assignment-slug>"
  exit 1
fi

if [[ ! -f "$ZIPFILE" ]]; then
  echo "ERROR: zip file not found: $ZIPFILE"
  exit 1
fi

TARS_DIR="data/$ASSIGNMENT/tars"
mkdir -p "$TARS_DIR"

NEW=0; UPDATED=0; SKIPPED_EMPTY=0; SKIPPED_SAME=0
UPDATED_IDS=()

while IFS= read -r line; do
  size=$(echo "$line" | awk '{print $1}')
  name=$(echo "$line" | awk '{print $NF}')
  [[ "$name" != run-*.tar ]] && continue

  student_id="${name%.tar}"
  student_id="${student_id#run-}"
  dest="$TARS_DIR/$student_id"

  if [[ "$size" -eq 0 ]]; then
    printf "  SKIP(empty)   %s\n" "$student_id"
    ((SKIPPED_EMPTY++))
    continue
  fi

  if [[ -f "$dest/run.tar" ]]; then
    existing_size=$(stat -c%s "$dest/run.tar" 2>/dev/null || stat -f%z "$dest/run.tar")
    if [[ "$existing_size" -eq "$size" ]]; then
      printf "  SKIP(same)    %s (%sB)\n" "$student_id" "$size"
      ((SKIPPED_SAME++))
      continue
    fi
    # Different size — student resubmitted
    unzip -p "$ZIPFILE" "$name" > "$dest/run.tar"
    printf "  UPDATED       %s (%sB → %sB)\n" "$student_id" "$existing_size" "$size"
    UPDATED_IDS+=("$student_id")
    ((UPDATED++))
    continue
  fi

  mkdir -p "$dest"
  unzip -p "$ZIPFILE" "$name" > "$dest/run.tar"
  printf "  NEW           %s (%sB)\n" "$student_id" "$size"
  ((NEW++))

done < <(unzip -l "$ZIPFILE" | awk 'NR>3 && NF==4')

echo ""
echo "── Summary ───────────────────────────────"
echo "  $NEW new"
echo "  $UPDATED updated (size changed — resubmission)"
echo "  $SKIPPED_SAME unchanged (same size — skipped)"
echo "  $SKIPPED_EMPTY empty tars (→ missing_tar email)"

if [[ "${#UPDATED_IDS[@]}" -gt 0 ]]; then
  echo ""
  echo "⚠  Updated students need reprocessing and email queue reset:"
  for id in "${UPDATED_IDS[@]}"; do
    echo "     $id"
  done
  echo ""
  echo "To reprocess updated students only, run:"
  echo "  node scripts/reprocess-students.js $ASSIGNMENT ${UPDATED_IDS[*]}"
fi

if [[ "$NEW" -gt 0 ]]; then
  echo ""
  echo "To process new students only:"
  echo "  node scripts/process-batch.js $ASSIGNMENT --skip-existing"
fi
