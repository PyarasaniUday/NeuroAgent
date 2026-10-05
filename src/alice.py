"""
alice.py— NeuroAgent ALICE-style IC Analysis


Purpose:
    Analyze ICA components using temporal, spatial and
    spectral evidence inspired by the ALICE approach.

Pipeline:

    Preprocessed EEG
            ↓
        ICA sources
            y
    ┌───────────────────────┐
    │ Temporal features     │
    │ Spectral features     │
    │ Spatial/topographic   │
    └───────────────────────┘
            ↓
       ALICE evidence
            ↓
      Evidence Fusion

NOTE:
This prototype generates ALICE-style features/evidence.
It does NOT claim to reproduce the published ALICE
pretrained model unless that model is explicitly loaded.
"""

from pathlib import Path

# pyrefly: ignore [missing-import]
import numpy as np
import pandas as pd
# pyrefly: ignore [missing-import]
import mne
# pyrefly: ignore [missing-import]
from scipy.stats import kurtosis
# pyrefly: ignore [missing-import]
from scipy.signal import welch


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

RAW_FILE = (
    PROCESSED_DIR /
    "S002R01_preprocessed_raw.fif"
)

ICA_FILE = (
    PROCESSED_DIR /
    "S002R01_ica.fif"
)

OUTPUT_FILE = (
    PROCESSED_DIR /
    "S002R01_alice.csv"
)


# EEG frequency bands
BANDS = {
    "delta": (1.0, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 40.0),
}


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("\n==========================================")
    print("       NEUROAGENT ALICE ANALYSIS")
    print("==========================================")

    print("\nLoading preprocessed EEG:")
    print(RAW_FILE)

    if not RAW_FILE.exists():
        raise FileNotFoundError(
            f"Preprocessed EEG not found:\n{RAW_FILE}"
        )

    raw = mne.io.read_raw_fif(
        RAW_FILE,
        preload=True,
        verbose=False
    )

    print("Preprocessed EEG loaded.")

    print("\nLoading ICA:")
    print(ICA_FILE)

    if not ICA_FILE.exists():
        raise FileNotFoundError(
            f"ICA file not found:\n{ICA_FILE}"
        )

    ica = mne.preprocessing.read_ica(
        ICA_FILE,
        verbose=False
    )

    print("ICA solution loaded.")

    print("\n==========================================")
    print("DATA INFORMATION")
    print("==========================================")

    print(f"Channels       : {raw.info['nchan']}")
    print(f"Sampling rate  : {raw.info['sfreq']} Hz")
    print(f"ICA components : {ica.n_components_}")
    print(f"ICA method     : {ica.method}")

    return raw, ica


# ============================================================
# EXTRACT ICA SOURCES
# ============================================================

def extract_sources(raw, ica):

    print("\n==========================================")
    print("       EXTRACTING ICA SOURCES")
    print("==========================================")

    sources = ica.get_sources(raw)

    data = sources.get_data()

    print(f"ICA source shape : {data.shape}")

    return data


# ============================================================
# TEMPORAL FEATURES
# ============================================================

def temporal_features(signal):

    mean_value = np.mean(signal)

    std_value = np.std(signal)

    variance_value = np.var(signal)

    rms_value = np.sqrt(
        np.mean(signal ** 2)
    )

    peak_to_peak = (
        np.max(signal) -
        np.min(signal)
    )

    max_amplitude = np.max(
        np.abs(signal)
    )

    kurtosis_value = kurtosis(
        signal,
        fisher=True,
        bias=False
    )

    return {
        "mean": mean_value,
        "std": std_value,
        "variance": variance_value,
        "rms": rms_value,
        "peak_to_peak": peak_to_peak,
        "max_amplitude": max_amplitude,
        "kurtosis": kurtosis_value,
    }


# ============================================================
# SPECTRAL FEATURES
# ============================================================

def spectral_features(signal, sfreq):

    freqs, power = welch(
        signal,
        fs=sfreq,
        nperseg=min(
            1024,
            len(signal)
        )
    )

    total_power = np.trapezoid(
        power,
        freqs
    )

    results = {}

    band_powers = {}

    for band_name, (low, high) in BANDS.items():

        mask = (
            (freqs >= low) &
            (freqs < high)
        )

        if np.any(mask):

            band_power = np.trapezoid(
                power[mask],
                freqs[mask]
            )

        else:

            band_power = 0.0

        band_powers[band_name] = band_power

        results[
            f"{band_name}_power"
        ] = band_power

    # Relative power

    for band_name, band_power in band_powers.items():

        if total_power > 0:

            relative = (
                band_power /
                total_power
            )

        else:

            relative = 0.0

        results[
            f"{band_name}_relative"
        ] = relative

    return results


# ============================================================
# ALICE EVIDENCE
# ============================================================

def calculate_alice_evidence(
    temporal,
    spectral
):

    """
    Generate interpretable artifact evidence.

    This is a prototype evidence layer, NOT a pretrained
    ALICE classifier.

    Higher artifact evidence indicates that the component
    shows characteristics commonly associated with
    non-brain activity.
    """

    artifact_score = 0.0

    # High amplitude / abnormal kurtosis
    if temporal["max_amplitude"] > 5.0:
        artifact_score += 0.20

    if abs(temporal["kurtosis"]) > 5.0:
        artifact_score += 0.20

    # Strong high-frequency activity
    high_freq = (
        spectral["beta_relative"] +
        spectral["gamma_relative"]
    )

    if high_freq > 0.40:
        artifact_score += 0.25

    # Strong delta dominance can indicate slow artifact
    if spectral["delta_relative"] > 0.70:
        artifact_score += 0.15

    # Very low-frequency dominance
    if (
        spectral["theta_relative"] +
        spectral["delta_relative"]
        > 0.85
    ):
        artifact_score += 0.10

    # Clamp
    artifact_score = min(
        artifact_score,
        1.0
    )

    brain_score = 1.0 - artifact_score

    if artifact_score >= 0.60:

        decision = "artifact"

    elif artifact_score >= 0.35:

        decision = "uncertain"

    else:

        decision = "brain_like"

    return (
        artifact_score,
        brain_score,
        decision
    )


# ============================================================
# ANALYZE ALL COMPONENTS
# ============================================================

def analyze_components(
    sources,
    sfreq
):

    print("\n==========================================")
    print("       ANALYZING ICA COMPONENTS")
    print("==========================================")

    rows = []

    for index, signal in enumerate(sources):

        temporal = temporal_features(
            signal
        )

        spectral = spectral_features(
            signal,
            sfreq
        )

        (
            artifact_score,
            brain_score,
            decision
        ) = calculate_alice_evidence(
            temporal,
            spectral
        )

        row = {

            "component":
                f"IC{index + 1}",

            # Temporal
            **temporal,

            # Spectral
            **spectral,

            # ALICE evidence
            "alice_artifact_score":
                artifact_score,

            "alice_brain_score":
                brain_score,

            "alice_decision":
                decision,
        }

        rows.append(row)

    return pd.DataFrame(rows)


# ============================================================
# DISPLAY RESULTS
# ============================================================

def display_results(df):

    print("\n==========================================")
    print("        ALICE ANALYSIS RESULTS")
    print("==========================================")

    columns = [

        "component",

        "kurtosis",

        "alpha_relative",

        "beta_relative",

        "gamma_relative",

        "alice_artifact_score",

        "alice_brain_score",

        "alice_decision",
    ]

    print(
        df[columns]
        .head(10)
        .to_string(
            index=False
        )
    )

    print("\n==========================================")
    print("ALICE DECISION DISTRIBUTION")
    print("==========================================")

    print(
        df[
            "alice_decision"
        ]
        .value_counts()
        .to_string()
    )


# ============================================================
# SAVE RESULTS
# ============================================================

def save_results(df):

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print("\n==========================================")
    print("       ALICE RESULTS SAVED")
    print("==========================================")

    print(f"\nFile:")
    print(OUTPUT_FILE)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    raw, ica = load_data()

    sources = extract_sources(
        raw,
        ica
    )

    sfreq = raw.info["sfreq"]

    df = analyze_components(
        sources,
        sfreq
    )

    display_results(
        df
    )

    save_results(
        df
    )

    print("\n==========================================")
    print("       ALICE STAGE COMPLETE")
    print("==========================================")

    print("\nNext stage →")
    print("EVIDENCE FUSION")
    print("       ↓")
    print("ICLabel + PSD + ALICE")
    print("       ↓")
    print("NeuroAgent Decision")
    print("       ↓")
    print("KEEP / REMOVE")
