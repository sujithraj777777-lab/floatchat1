from __future__ import annotations


QC_FLAG_DESCRIPTIONS = {
    "0": {
        "meaning": "No QC was performed",
        "description": "The measurement has not been quality checked.",
        "action": "Do not use without manual verification.",
    },
    "1": {
        "meaning": "Good data",
        "description": "The measurement passed all quality checks and is considered reliable.",
        "action": "Safe to use for analysis.",
    },
    "2": {
        "meaning": "Probably good data",
        "description": "The measurement likely passed QC but has some minor concerns.",
        "action": "Use with caution; verify if critical.",
    },
    "3": {
        "meaning": "Bad data, probably correctable",
        "description": "The measurement failed QC but may be recoverable with corrections.",
        "action": "Do not use without applying corrections.",
    },
    "4": {
        "meaning": "Bad data",
        "description": "The measurement failed QC and is unreliable.",
        "action": "Do not use.",
    },
    "5": {
        "meaning": "Value modified by expert",
        "description": "An expert has manually corrected this measurement.",
        "action": "Safe to use; note the manual modification.",
    },
    "6": {
        "meaning": "Value interpolated",
        "description": "This value was interpolated from nearby observations.",
        "action": "Use with awareness that it is not a direct measurement.",
    },
    "7": {
        "meaning": "Missing value",
        "description": "No data is available for this level.",
        "action": "Cannot be used.",
    },
    "8": {
        "meaning": "Unused value",
        "description": "This value exists but is not used in the current analysis.",
        "action": "Not applicable for standard analysis.",
    },
    "9": {
        "meaning": "Missing value",
        "description": "No data is available (alternate code for 7).",
        "action": "Cannot be used.",
    },
    "A": {
        "meaning": "Estimated",
        "description": "The value was estimated rather than measured.",
        "action": "Use with awareness of estimation uncertainty.",
    },
    "B": {
        "meaning": "Sea ice",
        "description": "Measurement taken in sea ice conditions.",
        "action": "Use only for ice-related analysis.",
    },
    "C": {
        "meaning": "Residual after sea ice removal",
        "description": "Value remaining after sea ice contribution was removed.",
        "action": "Specialized use only.",
    },
    "D": {
        "meaning": "Reserved for future use",
        "description": "This flag value is reserved and should not appear in current data.",
        "action": "Report if encountered.",
    },
}


def explain_qc_flags(flag_value: str) -> dict:
    """Explain ARGO QC flag values."""
    flag_str = str(flag_value).strip().upper()

    if flag_str in QC_FLAG_DESCRIPTIONS:
        info = QC_FLAG_DESCRIPTIONS[flag_str]
        return {
            "flag_value": flag_str,
            "meaning": info["meaning"],
            "description": info["description"],
            "action": info["action"],
            "reference": "ARGO Quality Control Manual, Version 2.9.1",
        }

    return {
        "flag_value": flag_str,
        "meaning": "Unknown flag",
        "description": f"No description available for QC flag '{flag_str}'.",
        "action": "Consult the ARGO QC manual for this specific flag value.",
        "reference": "ARGO Quality Control Manual, Version 2.9.1",
    }
