"""Vendor matching: groups vendor-master records that are the same company.

"Atlassian Pty Ltd" and "ATLASSIAN PTY. LIMITED" become one canonical vendor.
"""
import re

from rapidfuzz import fuzz

# Words that say nothing about which company it is.
_NOISE = {
    "ltd", "limited", "plc", "inc", "llc", "llp", "pty", "bv", "sarl", "sa", "gmbh", "co",
    "emea", "international", "operations", "uk", "kenya", "ireland", "nederland",
    "east", "central", "africa", "systems", "software", "com", "the", "group",
}

MATCH_THRESHOLD = 90  # rapidfuzz token_set_ratio, 0-100


def normalise(name: str) -> str:
    text = re.sub(r"\(.*?\)", " ", name.lower())       # drop bracketed notes
    text = re.sub(r"[^a-z0-9 ]", " ", text)              # drop punctuation
    words = [w for w in text.split() if w not in _NOISE]
    return " ".join(words)


def display_name(name: str) -> str:
    """'DocuSign International (EMEA) Ltd' -> 'DocuSign' (keeps the original casing)."""
    text = re.sub(r"\(.*?\)", " ", name)
    kept = [w for w in text.split() if re.sub(r"[^a-z0-9]", "", w.lower()) not in _NOISE]
    return " ".join(kept).strip(" ,.") or name


def canonical_groups(vendors: list[tuple[str, str]]) -> dict[str, tuple[str, str]]:
    """vendors: [(vendor_id, raw_name)] -> {vendor_id: (canonical_id, canonical_name)}.

    The first record seen in a group becomes its canonical id.
    """
    groups: list[tuple[str, str, str]] = []  # (canonical_id, canonical_name, normalised key)
    result: dict[str, tuple[str, str]] = {}
    for vendor_id, raw in vendors:
        key = normalise(raw)
        match = next((g for g in groups if fuzz.token_set_ratio(key, g[2]) >= MATCH_THRESHOLD), None)
        if match is None:
            match = (vendor_id, display_name(raw), key)
            groups.append(match)
        result[vendor_id] = (match[0], match[1])
    return result
