"""
Reproducible training pipeline for the real ML disease-prediction model.

USAGE (never run automatically — always an explicit, manual developer step,
same convention as backend/seed/seed_data.py):

    python -m app.ml.train --data /path/to/dataset.csv --target disease \
        --dataset-source "Kaggle: <exact dataset name/URL>, license: <verified license>"

BEFORE YOU RUN THIS:
  1. The CSV needs a column for every entry in app/ml/schema.py:FEATURE_COLUMNS
     (binary symptom_<name> columns, the numeric columns, and one-hot
     species_/severity_/vaccination_status_ columns) plus a target label
     column. This script will refuse to run rather than guess a mapping.
  2. You must have verified you have the legal right to train on this
     dataset. As of this repository's last audit, no dataset with
     independently verifiable licensing was found from the tools available
     in that environment — see docs/ml-disease-prediction.md for the
     specific candidates checked and why each was rejected. Do not skip
     this check just because a file is convenient.

This script never invents data and never fabricates a metric it did not
actually compute — every number in the saved metadata.json comes directly
from scikit-learn's evaluation on a real held-out test split.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

RANDOM_SEED = 42
ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


def main():
    parser = argparse.ArgumentParser(description="Train the PASHU-RAKSHAK disease-prediction model")
    parser.add_argument("--data", required=True, help="Path to a CSV with FEATURE_COLUMNS + target column")
    parser.add_argument("--target", default="disease", help="Name of the target/label column")
    parser.add_argument("--dataset-source", required=True,
                         help="Human-readable dataset provenance + license for the model card, e.g. "
                              "'Kaggle shijo96john/animal-disease-prediction, license: <verified>'")
    args = parser.parse_args()

    if not os.path.exists(args.data):
        sys.exit(f"Dataset not found: {args.data}")

    try:
        import pandas as pd
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import (
            accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report,
        )
        import joblib
    except ImportError as e:
        sys.exit(
            f"Missing ML dependency: {e}. Install with:\n"
            f"  pip install -r requirements.txt --break-system-packages\n"
            f"(pandas / scikit-learn / joblib are only required for training, "
            f"not for normal API operation.)"
        )

    from app.ml.schema import FEATURE_COLUMNS, SCHEMA_VERSION

    df = pd.read_csv(args.data)

    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        sys.exit(
            "Dataset is missing required feature columns — training features "
            "and inference features must match exactly (see app/ml/schema.py). "
            f"Missing {len(missing)} column(s): {missing}\n"
            "Map or engineer your dataset's columns onto FEATURE_COLUMNS before "
            "training; this script will not guess or silently reindex."
        )
    if args.target not in df.columns:
        sys.exit(f"Target column '{args.target}' not found in dataset columns: {list(df.columns)}")

    df = df.dropna(subset=[args.target])
    class_counts = df[args.target].value_counts()
    too_rare = class_counts[class_counts < 2]
    if len(too_rare) > 0:
        print(f"WARNING: dropping {len(too_rare)} class(es) with <2 examples "
              f"(can't stratify a train/test split on them): {too_rare.to_dict()}")
        df = df[df[args.target].isin(class_counts[class_counts >= 2].index)]

    X = df[FEATURE_COLUMNS].fillna(0.0)
    y = df[args.target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=300, random_state=RANDOM_SEED, class_weight="balanced", n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, average="macro", zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred, labels=model.classes_).tolist()
    report = classification_report(y_test, y_pred, zero_division=0, output_dict=True)

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    model_version = datetime.now(timezone.utc).strftime("v%Y%m%d-%H%M%S")
    joblib.dump(model, os.path.join(ARTIFACT_DIR, "model.joblib"))

    metadata = {
        "model_version": model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "RandomForestClassifier (scikit-learn), n_estimators=300, class_weight=balanced",
        "feature_schema_version": SCHEMA_VERSION,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": args.target,
        "classes": sorted(y.unique().tolist()),
        "dataset_source": args.dataset_source,
        "dataset_path": os.path.abspath(args.data),
        "n_rows_total": int(len(df)),
        "n_rows_train": int(len(X_train)),
        "n_rows_test": int(len(X_test)),
        "random_seed": RANDOM_SEED,
        "metrics": {
            "accuracy": round(float(accuracy), 4),
            "macro_precision": round(float(precision), 4),
            "macro_recall": round(float(recall), 4),
            "macro_f1": round(float(f1), 4),
            "confusion_matrix": cm,
            "confusion_matrix_labels": list(model.classes_),
            "per_class_report": report,
        },
    }
    with open(os.path.join(ARTIFACT_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Trained model {model_version} on {len(df)} rows ({len(model.classes_)} classes)")
    print(f"Accuracy={accuracy:.3f}  Macro-F1={f1:.3f}  Macro-Precision={precision:.3f}  Macro-Recall={recall:.3f}")
    print(f"Saved to {ARTIFACT_DIR}/model.joblib + metadata.json")


if __name__ == "__main__":
    main()
