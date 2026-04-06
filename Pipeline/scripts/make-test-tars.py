#!/usr/bin/env python3
"""
Generate synthetic run.tar files for edge-case testing of the ingest pipeline.

Each scenario exercises a specific variation in student submission format.
Output goes to Pipeline/testInputs/synthetic/<scenario>/run.tar.

Usage:
    python3 Pipeline/scripts/make-test-tars.py

Run from repo root.
"""

import io
import json
import os
import sys
import tarfile
import zipfile
from pathlib import Path


OUTPUT_DIR = Path(__file__).parent.parent / "testInputs" / "synthetic"


def make_diff_tar_zip(tar_entries: dict) -> bytes:
    """
    Build a diffs_N_.tar.zip: a ZIP with a single entry 'diffs' whose bytes
    are a TAR containing the given entries {tar_path: str_content}.
    """
    tar_buf = io.BytesIO()
    with tarfile.open(fileobj=tar_buf, mode="w") as t:
        for name, content in tar_entries.items():
            data = content.encode("utf-8")
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    tar_bytes = tar_buf.getvalue()

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("diffs", tar_bytes)
    return zip_buf.getvalue()


def delta_patch(*changes) -> str:
    """
    Build a patch string in DiffReplayer format.
    Each change is (type, src_pos, tgt_pos, src_lines, tgt_lines) where:
      type      - "CHANGE", "INSERT", or "DELETE"
      src_pos   - 0-based source position
      tgt_pos   - 0-based target position
      src_lines - list of strings (source lines)
      tgt_lines - list of strings (target lines)
    """
    parts = [f"{len(changes)};"]
    for delta_type, src_pos, tgt_pos, src_lines, tgt_lines in changes:
        parts.append(delta_type)
        parts.append(f"{src_pos},{tgt_pos}")
        parts.append(f"{len(src_lines)},")
        parts.extend(src_lines)
        parts.append(f"{len(tgt_lines)},")
        parts.extend(tgt_lines)
    return "\n".join(parts) + "\n"


def make_run_tar(scenario_name: str, test_run_info: dict, diff_archives: dict = None):
    """
    Write Pipeline/testInputs/synthetic/<scenario_name>/run.tar with the given
    testRunInfo.json content and optional diff archives {filename: bytes}.
    """
    out_dir = OUTPUT_DIR / scenario_name
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "run.tar"

    with tarfile.open(str(out_path), "w") as t:
        data = json.dumps(test_run_info, indent=2).encode("utf-8")
        info = tarfile.TarInfo("testRunInfo.json")
        info.size = len(data)
        t.addfile(info, io.BytesIO(data))

        if diff_archives:
            for archive_name, archive_bytes in diff_archives.items():
                info = tarfile.TarInfo(archive_name)
                info.size = len(archive_bytes)
                t.addfile(info, io.BytesIO(archive_bytes))

    size = out_path.stat().st_size
    print(f"  ✓  {scenario_name}/run.tar  ({size} bytes)")
    return out_path


# ── Baseline Java content used across scenarios ──────────────────────────────

BST_BASELINE = """\
public class BST {
    public void insert(int val) {
        // TODO: implement
    }
    public boolean contains(int val) {
        return false;
    }
}
"""

BST_PATCH_RUN1 = delta_patch(
    ("CHANGE", 2, 2,
     ["        // TODO: implement"],
     ["        root = insertRec(root, val);"]),
)

BST_PATCH_RUN3 = delta_patch(
    ("CHANGE", 4, 4,
     ["        return false;"],
     ["        return containsRec(root, val);"]),
)


# ── Scenarios ────────────────────────────────────────────────────────────────

def scenario_01_all_pass():
    """All tests SUCCESSFUL. Has a diff archive with two delta patches."""
    diff_zip = make_diff_tar_zip({
        "baselines/edu.rosehulman.BST": BST_BASELINE,
        "patches/edu.rosehulman.BST_1": BST_PATCH_RUN1,
        "patches/edu.rosehulman.BST_3": BST_PATCH_RUN3,
    })
    info = {
        "runTimes": {
            "1": "2026-01-15 09:00:00.000",
            "2": "2026-01-15 09:05:00.000",
            "3": "2026-01-15 09:10:00.000",
        },
        "BSTTest": {
            "testInsert": {"1": "SUCCESSFUL", "2": "SUCCESSFUL", "3": "SUCCESSFUL"},
            "testContains": {"1": "SUCCESSFUL", "2": "SUCCESSFUL", "3": "SUCCESSFUL"},
        },
    }
    make_run_tar("01-all-pass", info, {"diffs_0_.tar.zip": diff_zip})


def scenario_02_all_fail():
    """All tests FAILED with causes — exercises failure message parsing."""
    info = {
        "runTimes": {
            "1": "2026-01-15 09:00:00.000",
            "2": "2026-01-15 09:05:00.000",
        },
        "BSTTest": {
            "testInsert": {
                "1": "FAILED: AssertionError: expected:<5> but was:<null>",
                "2": "FAILED: NullPointerException",
            },
            "testContains": {
                "1": "FAILED: AssertionError: expected:<true> but was:<false>",
                "2": "FAILED: AssertionError: expected:<true> but was:<false>",
            },
        },
    }
    make_run_tar("02-all-fail", info)


def scenario_03_no_run_times():
    """
    Missing 'runTimes' key. The parser should emit a warning and infer run numbers
    from the test result keys.
    """
    info = {
        "BSTTest": {
            "testInsert": {"1": "SUCCESSFUL", "2": "SUCCESSFUL"},
            "testContains": {"1": "FAILED: AssertionError"},
        },
    }
    make_run_tar("03-no-run-times", info)


def scenario_04_non_integer_key():
    """
    runTimes contains a non-integer key ("run1"). Parser should warn and skip it,
    but still process the valid integer keys.
    """
    info = {
        "runTimes": {
            "run1": "2026-01-15 09:00:00.000",  # invalid — will be warned and skipped
            "2": "2026-01-15 09:05:00.000",
        },
        "BSTTest": {
            "testInsert": {"2": "SUCCESSFUL"},
        },
    }
    make_run_tar("04-non-integer-key", info)


def scenario_05_no_diffs():
    """
    No diff archives — only testRunInfo.json. Exercises the case where the logger
    produced no diffs_*.tar.zip entries (e.g., skipLogging was set, or no code changes).
    """
    info = {
        "runTimes": {
            "1": "2026-01-15 09:00:00.000",
        },
        "BSTTest": {
            "testInsert": {"1": "SUCCESSFUL"},
        },
    }
    make_run_tar("05-no-diffs", info)


def scenario_06_file_too_large():
    """
    Diff archive where a patch entry contains the 'File too large!' sentinel.
    Ingest should index the entry normally (just a text payload);
    the error surfaces only during rerun.
    """
    diff_zip = make_diff_tar_zip({
        "baselines/edu.rosehulman.BST": BST_BASELINE,
        "patches/edu.rosehulman.BST_1": "File too large!\n",
    })
    info = {
        "runTimes": {"1": "2026-01-15 09:00:00.000"},
        "BSTTest": {"testInsert": {"1": "SUCCESSFUL"}},
    }
    make_run_tar("06-file-too-large", info, {"diffs_0_.tar.zip": diff_zip})


def scenario_07_file_created():
    """
    Diff archive where a patch entry contains the 'File created!' sentinel.
    DiffReplayer treats this as 'return baseline as-is'.
    """
    diff_zip = make_diff_tar_zip({
        "baselines/edu.rosehulman.NewHelper": "public class NewHelper {}\n",
        "patches/edu.rosehulman.NewHelper_2": "File created!\n",
    })
    info = {
        "runTimes": {
            "1": "2026-01-15 09:00:00.000",
            "2": "2026-01-15 09:05:00.000",
        },
        "BSTTest": {
            "testInsert": {"1": "FAILED: AssertionError", "2": "SUCCESSFUL"},
        },
    }
    make_run_tar("07-file-created", info, {"diffs_0_.tar.zip": diff_zip})


def scenario_08_default_package():
    """
    Student code has no package declaration. The logger uses file key format
    'ClassName.java.ClassName' instead of 'com.package.ClassName'.
    The indexer should parse this without warnings.
    """
    baseline = "public class BSTImpl {\n    public void insert(int v) {}\n}\n"
    patch = delta_patch(
        ("CHANGE", 1, 1,
         ["    public void insert(int v) {}"],
         ["    public void insert(int v) { root = v; }"]),
    )
    diff_zip = make_diff_tar_zip({
        "baselines/BSTImpl.java.BSTImpl": baseline,
        "patches/BSTImpl.java.BSTImpl_1": patch,
    })
    info = {
        "runTimes": {"1": "2026-01-15 09:00:00.000"},
        "BSTImplTest": {"testInsert": {"1": "SUCCESSFUL"}},
    }
    make_run_tar("08-default-package", info, {"diffs_0_.tar.zip": diff_zip})


def scenario_09_single_run():
    """Minimal valid input: exactly 1 run, 1 test. Tests the floor case."""
    info = {
        "runTimes": {"1": "2026-01-15 09:00:00.000"},
        "BSTTest": {"testInsert": {"1": "SUCCESSFUL"}},
    }
    make_run_tar("09-single-run", info)


def scenario_10_empty_tests():
    """
    runTimes has entries but no test file sections. Parser should produce RunRecords
    with empty test lists — valid input representing runs with no tracked tests.
    """
    info = {
        "runTimes": {
            "1": "2026-01-15 09:00:00.000",
            "2": "2026-01-15 09:05:00.000",
            "3": "2026-01-15 09:10:00.000",
        },
    }
    make_run_tar("10-empty-tests", info)


# ── Main ─────────────────────────────────────────────────────────────────────

SCENARIOS = [
    scenario_01_all_pass,
    scenario_02_all_fail,
    scenario_03_no_run_times,
    scenario_04_non_integer_key,
    scenario_05_no_diffs,
    scenario_06_file_too_large,
    scenario_07_file_created,
    scenario_08_default_package,
    scenario_09_single_run,
    scenario_10_empty_tests,
]


def main():
    print(f"Generating {len(SCENARIOS)} synthetic run.tar files → {OUTPUT_DIR}/")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    errors = []
    for fn in SCENARIOS:
        try:
            fn()
        except Exception as e:
            print(f"  ✗  {fn.__name__}: {e}", file=sys.stderr)
            errors.append(fn.__name__)

    print()
    if errors:
        print(f"ERROR: {len(errors)} scenario(s) failed: {errors}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"All {len(SCENARIOS)} scenarios generated successfully.")


if __name__ == "__main__":
    main()
