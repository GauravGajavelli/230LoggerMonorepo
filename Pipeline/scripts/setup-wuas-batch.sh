#!/usr/bin/env bash
# setup-wuas-batch.sh — Unpack allTar-WaS-Sp2026.zip into Frontend/data/wuas/tars/
#
# Uses the runNN → GitHub username mapping from cpAllTarsSpQ26.txt so that
# directories are named by real student ID (e.g. agneswang42, rhit-hans, ...).
# Zero-byte tars (no testSupport folder) and non-tar files are skipped.
#
# After this runs:
#   1. cd Frontend && node scripts/generate-tokens.js wuas roster.dev.csv
#   2. node scripts/process-batch.js wuas "Weighted and Stretching"
#   3. EMAIL_DEV_REDIRECT=you@example.com node scripts/queue-emails.js wuas
#      (verify emails arrive, then remove EMAIL_DEV_REDIRECT and re-run for live delivery)
#
# Usage (from repo root):
#   bash Pipeline/scripts/setup-wuas-batch.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZIP="$REPO_ROOT/Pipeline/testInputs/studentTars/allTar-WaS-Sp2026.zip"
TARS_DIR="$REPO_ROOT/Frontend/data/wuas/tars"

if [ ! -f "$ZIP" ]; then
    echo "ERROR: $ZIP not found." >&2
    exit 1
fi

# runNN → real GitHub username (from cpAllTarsSpQ26.txt)
student_id_for() {
    case "$1" in
        run01) echo "agneswang42" ;;
        run02) echo "barczear-rhit" ;;
        run03) echo "BlaiseBaptist" ;;
        run04) echo "cahoonlh" ;;
        run05) echo "Cole-Cary" ;;
        run06) echo "Jack-B-RHIT" ;;
        run07) echo "jose-up" ;;
        run08) echo "kangt-rose2029" ;;
        run09) echo "nirdeshadusumilli2007" ;;
        run10) echo "plant4040" ;;
        run11) echo "rhit-beloremd" ;;
        run12) echo "rhit-blocksl" ;;
        run13) echo "rhit-caminea" ;;
        run14) echo "rhit-cherukbj" ;;
        run15) echo "rhit-clutteda" ;;
        run16) echo "rhit-cravenbr" ;;
        run17) echo "rhit-culottjm" ;;
        run18) echo "rhit-gheorgg" ;;
        run19) echo "rhit-graysolt" ;;
        run20) echo "rhit-greenlrm" ;;
        run21) echo "rhit-guffeygi" ;;
        run22) echo "rhit-hans" ;;
        run23) echo "rhit-hausmabq" ;;
        run24) echo "rhit-henryct" ;;
        run25) echo "rhit-kamerhd" ;;
        run26) echo "rhit-mccordca" ;;
        run27) echo "rhit-millern" ;;
        run28) echo "rhit-mirandac" ;;
        run29) echo "rhit-neawedba" ;;
        run30) echo "rhit-osujiun" ;;
        run31) echo "rhit-parkerct" ;;
        run32) echo "rhit-pinedott" ;;
        run33) echo "rhit-riedliso" ;;
        run34) echo "rhit-robinscp" ;;
        run35) echo "rhit-theslikj" ;;
        run36) echo "rhit-tuckercm" ;;
        run37) echo "rhit-wakefib" ;;
        run38) echo "rhit-weberjm1" ;;
        run39) echo "teddyisnotme" ;;
        run40) echo "Tuomaaa" ;;
        *)     echo "" ;;
    esac
}

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "Unpacking $(basename "$ZIP") → $TARS_DIR/"
unzip -q "$ZIP" -d "$WORK"

placed=0; skipped_empty=0; skipped_other=0

for src in "$WORK"/allTar-WaS-Sp2026/*; do
    fname=$(basename "$src")

    if [[ "$fname" != *.tar ]]; then
        echo "  SKIP (not a tar): $fname"
        skipped_other=$((skipped_other + 1))
        continue
    fi

    size=$(wc -c < "$src")
    run_key="${fname%.tar}"
    student_id=$(student_id_for "$run_key")

    if [ -z "$student_id" ]; then
        echo "  SKIP (unknown mapping): $fname"
        skipped_other=$((skipped_other + 1))
        continue
    fi

    if [ "$size" -eq 0 ]; then
        echo "  SKIP (0 bytes, no testSupport): $fname → $student_id"
        skipped_empty=$((skipped_empty + 1))
        continue
    fi

    dest_dir="$TARS_DIR/$student_id"
    mkdir -p "$dest_dir"
    cp "$src" "$dest_dir/run.tar"
    echo "  ✓  $student_id/run.tar  (${size} bytes)"
    placed=$((placed + 1))
done

echo ""
echo "── Summary ──────────────────────────────────────────────────────────"
echo "  $placed tars placed,  $skipped_empty skipped (empty),  $skipped_other skipped (non-tar)"
echo ""
echo "Next steps (run from Frontend/):"
echo "  node scripts/generate-tokens.js wuas roster.dev.csv"
echo "  node scripts/process-batch.js wuas 'Weighted and Stretching'"
echo "  EMAIL_DEV_REDIRECT=you@example.com node scripts/queue-emails.js wuas"
