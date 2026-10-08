"""
pipeline_runner.py — NeuroAgent Single-EDF Pipeline Runner
==========================================================

Executes the complete NeuroAgent assistive EEG processing pipeline on an
arbitrary recording without modifying existing module code or hardcoded paths.

Pipeline Stages:
1. RAW EEG Loading
2. PREPROCESSING (Montage, Filtering, Re-reference, Bad Channel Interp)
3. ICA DECOMPOSITION (Extended Infomax)
4. ICLabel CLASSIFICATION
5. PSD FREQUENCY ANALYSIS
6. ALICE ARTIFACT EVIDENCE ANALYSIS
7. FEATURE EXTRACTION (Time & Frequency Domain)
8. EVIDENCE FUSION
9. NEUROAGENT DECISION ENGINE
10. EEG RECONSTRUCTION
11. QUALITY CHECK
"""

import sys
import os
import gc
import time
from datetime import datetime
from pathlib import Path
import numpy as np
import pandas as pd
import mne

# Add backend/src to sys.path so imports work regardless of working dir
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Import existing functions from backend/src modules
from load_data import load_eeg
from preprocess import (
    clean_channel_names,
    set_eeg_montage,
    bandpass_filter,
    rereference,
    detect_bad_channels,
    interpolate_bad_channels,
    DEFAULT_CONFIG,
)
from iclabel import label_components, process_results
from psd import calculate_psd, calculate_band_power
from alice import analyze_components
from features import extract_features
from evidence_fusion import validate_components, fuse_evidence
from neuroagent import run_neuroagent
from reconstruction import find_remove_components, reconstruct_eeg
from quality_check import (
    validate_data,
    compare_signals,
    compare_frequency_content,
    determine_quality,
)

BASE_DIR = CURRENT_DIR.parent if CURRENT_DIR.name == "src" else CURRENT_DIR
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"


def log_stage(subject_id, recording_id, stage, status, error="", duration=0.0):
    """Append a log entry to data/metadata/processing_log.csv."""
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    log_file = METADATA_DIR / "processing_log.csv"
    
    row = {
        "subject": subject_id,
        "recording": recording_id,
        "stage": stage,
        "status": status,
        "error": error,
        "timestamp": datetime.now().isoformat(),
        "duration": round(duration, 3),
    }
    
    header = not log_file.exists()
    pd.DataFrame([row]).to_csv(log_file, mode="a", index=False, header=header)


def process_recording(
    edf_path,
    subject_id,
    recording_id,
    output_dir=None,
    force=False,
    verbose=False,
    stage_callback=None,
):
    """
    Run the entire 11-stage pipeline on one EDF file.

    Parameters
    ----------
    edf_path : str or Path
        Path to raw EDF file.
    subject_id : str
        e.g. 'S002'
    recording_id : str
        e.g. 'R01'
    output_dir : Path, optional
        Target directory for subject artifacts. Defaults to data/processed/{subject_id}/
    force : bool
        If False, skip if already fully processed.
    verbose : bool
        Print step-by-step progress to stdout.
    stage_callback : callable, optional
        Function callback(stage_name, status, duration) for UI / CLI progress bars.

    Returns
    -------
    dict
        Execution summary with status, stages, timings, and error (if any).
    """
    edf_path = Path(edf_path)
    prefix = f"{subject_id}{recording_id}"

    if output_dir is None:
        output_dir = PROCESSED_DIR / subject_id
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Output file paths
    prep_fif = output_dir / f"{prefix}_preprocessed_raw.fif"
    ica_fif = output_dir / f"{prefix}_ica.fif"
    iclabel_csv = output_dir / f"{prefix}_iclabel.csv"
    psd_csv = output_dir / f"{prefix}_psd.csv"
    alice_csv = output_dir / f"{prefix}_alice.csv"
    features_csv = output_dir / f"{prefix}_features.csv"
    fusion_csv = output_dir / f"{prefix}_fusion.csv"
    neuroagent_csv = output_dir / f"{prefix}_neuroagent.csv"
    recon_fif = output_dir / f"{prefix}_reconstructed_raw.fif"
    quality_csv = output_dir / f"{prefix}_quality_report.csv"

    # Check resume / completion
    if not force and recon_fif.exists() and quality_csv.exists() and neuroagent_csv.exists():
        if verbose:
            print(f"[{prefix}] Already fully processed. Skipping.")
        if stage_callback:
            stage_callback("ALL", "SKIPPED", 0.0)
        return {
            "subject_id": subject_id,
            "recording_id": recording_id,
            "status": "SKIPPED",
            "error": None,
            "duration": 0.0,
        }

    total_start = time.time()
    stages_timing = {}
    current_stage = "INIT"

    # Helper for progress reporting
    def report_stage(name, status, dur):
        stages_timing[name] = dur
        log_stage(subject_id, recording_id, name, status, duration=dur)
        if stage_callback:
            stage_callback(name, status, dur)

    # MNE references for safe cleanup
    raw = None
    clean_raw = None
    ica = None
    sources = None

    try:
        # ====================================================
        # 1. LOAD RAW EEG
        # ====================================================
        current_stage = "LOAD"
        t0 = time.time()
        if not edf_path.exists():
            raise FileNotFoundError(f"Raw EDF not found: {edf_path}")
        raw = load_eeg(edf_path, preload=True)
        report_stage("LOAD", "SUCCESS", time.time() - t0)

        # ====================================================
        # 2. PREPROCESSING
        # ====================================================
        current_stage = "PREPROCESSING"
        t0 = time.time()
        raw = clean_channel_names(raw)
        raw = set_eeg_montage(raw)
        raw = bandpass_filter(raw, l_freq=1.0, h_freq=40.0, notch_freq=50.0)
        raw = rereference(raw, reference="average")
        bad_channels = detect_bad_channels(raw, threshold=5.0)
        if bad_channels:
            raw = interpolate_bad_channels(raw, bad_channels)
        
        # Save preprocessed FIF
        raw.save(str(prep_fif), overwrite=True, verbose=False)
        report_stage("PREPROCESSING", "SUCCESS", time.time() - t0)

        # ====================================================
        # 3. ICA DECOMPOSITION
        # ====================================================
        current_stage = "ICA"
        t0 = time.time()
        ica = mne.preprocessing.ICA(
            n_components=None,
            method="infomax",
            fit_params=dict(extended=True),
            random_state=97,
            max_iter="auto",
        )
        ica.fit(raw, picks="eeg", verbose=False)
        ica.save(str(ica_fif), overwrite=True, verbose=False)
        report_stage("ICA", "SUCCESS", time.time() - t0)

        # ====================================================
        # 4. ICLABEL
        # ====================================================
        current_stage = "ICLabel"
        t0 = time.time()
        iclabel_raw_res = label_components(raw, ica, method="iclabel")
        iclabel_df = process_results(iclabel_raw_res)
        iclabel_df.to_csv(iclabel_csv, index=False)
        report_stage("ICLabel", "SUCCESS", time.time() - t0)

        # Extract ICA sources once for PSD, ALICE, Features
        sources = ica.get_sources(raw)
        sources_data = sources.get_data()
        sfreq = float(raw.info["sfreq"])

        # ====================================================
        # 5. PSD ANALYSIS
        # ====================================================
        current_stage = "PSD"
        t0 = time.time()
        psd, freqs = calculate_psd(sources_data, sfreq)
        psd_df = calculate_band_power(psd, freqs)
        psd_df.to_csv(psd_csv, index=False)
        report_stage("PSD", "SUCCESS", time.time() - t0)

        # ====================================================
        # 6. ALICE ANALYSIS
        # ====================================================
        current_stage = "ALICE"
        t0 = time.time()
        alice_df = analyze_components(sources_data, sfreq)
        alice_df.to_csv(alice_csv, index=False)
        report_stage("ALICE", "SUCCESS", time.time() - t0)

        # ====================================================
        # 7. FEATURE EXTRACTION
        # ====================================================
        current_stage = "FEATURES"
        t0 = time.time()
        features_df = extract_features(sources_data, sfreq)
        features_df.to_csv(features_csv, index=False)
        report_stage("FEATURES", "SUCCESS", time.time() - t0)

        # ====================================================
        # 7b. CNN MODEL INFERENCE (Phase 18 Integration)
        # ====================================================
        cnn_df = None
        try:
            from cnn_inference import predict_component_signals
            cnn_df = predict_component_signals(sources_data, sfreq)
            if cnn_df is not None:
                cnn_csv = output_dir / f"{prefix}_cnn.csv"
                cnn_df.to_csv(cnn_csv, index=False)
        except Exception:
            pass

        # ====================================================
        # 8. EVIDENCE FUSION
        # ====================================================
        current_stage = "FUSION"
        t0 = time.time()
        common_comps = validate_components(iclabel_df, psd_df, alice_df)
        fused_df = fuse_evidence(iclabel_df, psd_df, alice_df, common_comps)
        fused_df.to_csv(fusion_csv, index=False)
        report_stage("FUSION", "SUCCESS", time.time() - t0)

        # ====================================================
        # 9. NEUROAGENT DECISION ENGINE
        # ====================================================
        current_stage = "NEUROAGENT"
        t0 = time.time()
        neuroagent_df = run_neuroagent(fused_df)
        if cnn_df is not None:
            cnn_map = cnn_df.set_index("component")
            for c_col in ["cnn_label", "cnn_confidence", "cnn_artifact_score"]:
                if c_col in cnn_map.columns:
                    neuroagent_df[c_col] = neuroagent_df["component"].map(cnn_map[c_col])
        neuroagent_df.to_csv(neuroagent_csv, index=False)
        report_stage("NEUROAGENT", "SUCCESS", time.time() - t0)

        # ====================================================
        # 10. EEG RECONSTRUCTION
        # ====================================================
        current_stage = "RECONSTRUCTION"
        t0 = time.time()
        remove_components = find_remove_components(neuroagent_df)
        clean_raw = reconstruct_eeg(raw, ica, remove_components)
        clean_raw.save(str(recon_fif), overwrite=True, verbose=False)
        report_stage("RECONSTRUCTION", "SUCCESS", time.time() - t0)

        # ====================================================
        # 11. QUALITY CHECK
        # ====================================================
        current_stage = "QUALITY"
        t0 = time.time()
        structure_valid = validate_data(raw, clean_raw)
        orig_stats, clean_stats = compare_signals(raw, clean_raw)
        freq_df = compare_frequency_content(raw, clean_raw)
        overall_quality = determine_quality(structure_valid, orig_stats, clean_stats)

        # Build quality report rows
        q_rows = [
            {"metric": "structure_valid", "value": structure_valid},
            {"metric": "overall_quality", "value": overall_quality},
            {"metric": "components_removed", "value": len(remove_components)},
            {
                "metric": "components_kept",
                "value": (neuroagent_df["neuroagent_decision"].str.upper() == "KEEP").sum(),
            },
            {
                "metric": "components_review",
                "value": (neuroagent_df["neuroagent_decision"].str.upper() == "REVIEW").sum(),
            },
        ]
        for k, v in orig_stats.items():
            q_rows.append({"metric": f"original_{k}", "value": v})
        for k, v in clean_stats.items():
            q_rows.append({"metric": f"clean_{k}", "value": v})
        for _, r in freq_df.iterrows():
            b = r["band"]
            q_rows.append({"metric": f"{b}_original_power", "value": r["original_power"]})
            q_rows.append({"metric": f"{b}_clean_power", "value": r["clean_power"]})
            q_rows.append({"metric": f"{b}_change_percent", "value": r["change_percent"]})

        quality_report_df = pd.DataFrame(q_rows)
        quality_report_df.to_csv(quality_csv, index=False)
        report_stage("QUALITY", "SUCCESS", time.time() - t0)

        total_duration = time.time() - total_start
        log_stage(subject_id, recording_id, "TOTAL", "SUCCESS", duration=total_duration)

        return {
            "subject_id": subject_id,
            "recording_id": recording_id,
            "status": "SUCCESS",
            "error": None,
            "duration": total_duration,
            "components": ica.n_components_,
            "removed": len(remove_components),
            "kept": (neuroagent_df["neuroagent_decision"].str.upper() == "KEEP").sum(),
            "review": (neuroagent_df["neuroagent_decision"].str.upper() == "REVIEW").sum(),
            "quality": overall_quality,
            "stages": stages_timing,
        }

    except Exception as e:
        dur = time.time() - total_start
        err_msg = f"Failed at {current_stage}: {str(e)}"
        log_stage(subject_id, recording_id, current_stage, "FAILED", error=str(e), duration=dur)
        if stage_callback:
            stage_callback(current_stage, "FAILED", dur)
        return {
            "subject_id": subject_id,
            "recording_id": recording_id,
            "status": "FAILED",
            "failed_stage": current_stage,
            "error": str(e),
            "duration": dur,
            "stages": stages_timing,
        }

    finally:
        # Strict memory cleanup
        try:
            if raw is not None:
                raw.close()
            if clean_raw is not None:
                clean_raw.close()
        except Exception:
            pass
        del raw, clean_raw, ica, sources
        gc.collect()


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="NeuroAgent EEG Pipeline Runner")
    parser.add_argument("--edf", default=None, help="Path to EDF file")
    parser.add_argument("--subject", default="S002", help="Subject ID")
    parser.add_argument("--recording", default="R01", help="Recording ID")
    parser.add_argument("--force", action="store_true", help="Force re-processing")
    parser.add_argument("--quiet", action="store_true", help="Suppress verbose stdout")
    args = parser.parse_args()

    if args.edf:
        target_edf = Path(args.edf).resolve()
    else:
        target_edf = DATA_DIR / "raw" / "EEGc" / args.subject / f"{args.subject}{args.recording}.edf"

    res = process_recording(
        target_edf,
        args.subject,
        args.recording,
        force=args.force,
        verbose=not args.quiet,
    )
    print(json.dumps(res, default=str))
