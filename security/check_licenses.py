#!/usr/bin/env python3
"""Check a syft SBOM against security/license-policy.yml.

Fails when a package carries a denied licence. Reports (but does not fail on)
packages whose licence syft could not determine, unless fail_on_unknown is set.

Usage:
    python3 security/check_licenses.py --sbom syft.json \
        --policy security/license-policy.yml --service nexus
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

# Deliberately avoids PyYAML: this runs on bare GitHub runners and in the
# pre-commit environment, and the policy file is a flat list-of-strings format.
_LIST_ITEM = re.compile(r"^\s*-\s*(?P<value>[^#]+?)\s*(?:#.*)?$")
_KEY = re.compile(r"^(?P<key>[a-z_]+):\s*(?P<inline>[^#]*?)\s*(?:#.*)?$")


def load_policy(path: pathlib.Path) -> dict:
    policy: dict = {"denied": [], "allowed": [], "fail_on_unknown": False}
    current = None
    for raw in path.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        key_match = _KEY.match(raw)
        if key_match and not raw.startswith((" ", "\t", "-")):
            key = key_match.group("key")
            inline = key_match.group("inline")
            if key == "fail_on_unknown":
                policy["fail_on_unknown"] = inline.strip().lower() == "true"
                current = None
            elif key in ("denied", "allowed"):
                current = key
            else:
                current = None
            continue
        item_match = _LIST_ITEM.match(raw)
        if item_match and current:
            policy[current].append(item_match.group("value").strip())
    return policy


def licences_for(artifact: dict) -> list[str]:
    out = []
    for entry in artifact.get("licenses") or []:
        value = entry.get("value") or entry.get("spdxExpression") or ""
        value = value.strip()
        # syft sometimes reports a layer digest in place of a licence.
        if value and not value.startswith("sha256:"):
            out.append(value)
    return out


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sbom", required=True, type=pathlib.Path)
    parser.add_argument("--policy", required=True, type=pathlib.Path)
    parser.add_argument("--service", default="image")
    args = parser.parse_args()

    policy = load_policy(args.policy)
    denied_norm = {normalise(d): d for d in policy["denied"]}

    sbom = json.loads(args.sbom.read_text())
    violations: list[tuple[str, str, str]] = []
    unknown: list[str] = []

    for artifact in sbom.get("artifacts", []):
        name = f"{artifact.get('name')}@{artifact.get('version')}"
        found = licences_for(artifact)
        if not found:
            unknown.append(name)
            continue
        for licence in found:
            key = normalise(licence)
            for denied_key, denied_label in denied_norm.items():
                # Substring match so a compound expression such as
                # "Apache-2.0 AND LicenseRef-NVIDIA-Proprietary" is still caught.
                if denied_key and denied_key in key:
                    violations.append((name, licence, denied_label))
                    break

    print(f"Licence check: {args.service}")
    print(f"  packages scanned : {len(sbom.get('artifacts', []))}")
    print(f"  undetermined     : {len(unknown)}")

    if unknown:
        preview = ", ".join(sorted(unknown)[:12])
        suffix = " ..." if len(unknown) > 12 else ""
        print(f"    e.g. {preview}{suffix}")

    if violations:
        print(f"\n  DENIED licences found ({len(violations)}):")
        for name, licence, denied_label in sorted(set(violations)):
            print(f"    {name}  ->  {licence}  (matches policy entry: {denied_label})")
        print(
            "\n  These are not open source under the project's policy and must not "
            "ship in an Actyze image."
        )
        return 1

    if unknown and policy["fail_on_unknown"]:
        print("\n  fail_on_unknown is set and undetermined licences remain.")
        return 1

    print("\n  No denied licences found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
