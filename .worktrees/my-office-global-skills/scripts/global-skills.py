#!/usr/bin/env python3
"""Stage, validate, install, and roll back global Codex skills safely."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


FORBIDDEN = (
    "git add -A",
    "git push origin main",
    "git checkout main",
    "firebase deploy",
    "rm -rf",
)


@dataclass
class ValidationResult:
    ok: bool
    issues: list[str]


@dataclass
class InstallResult:
    version: str
    backup_id: str | None = None


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    if path.is_file():
        digest.update(path.read_bytes())
    else:
        for child in sorted(path.rglob("*")):
            if child.is_file() and not child.is_symlink():
                digest.update(str(child.relative_to(path)).encode())
                digest.update(child.read_bytes())
    return digest.hexdigest()


def _frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    values: dict[str, str] = {}
    for line in text[3:end].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip().strip('"')
    return values


def validate_tree(root: Path) -> ValidationResult:
    issues: list[str] = []
    if not root.exists():
        return ValidationResult(False, [f"root missing: {root}"])
    skill_files = sorted(root.rglob("SKILL.md"))
    names: dict[str, Path] = {}
    for skill_file in skill_files:
        metadata = _frontmatter(skill_file.read_text(errors="replace"))
        if not metadata.get("name") or not metadata.get("description"):
            issues.append(f"{skill_file}: missing name/description frontmatter")
        elif metadata["name"] in names:
            issues.append(f"duplicate skill name {metadata['name']}: {skill_file} and {names[metadata['name']]}")
        else:
            names[metadata["name"]] = skill_file
    for file in sorted(root.rglob("*.md")):
        text = file.read_text(errors="replace")
        lowered = text.lower()
        for forbidden in FORBIDDEN:
            if forbidden.lower() in lowered:
                issues.append(f"{file}: forbidden command {forbidden}")
        # Links in fenced examples describe the consuming project, not staged files.
        link_text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
        for match in re.finditer(r"\[[^]]+\]\(([^)#]+)\)", link_text):
            target = match.group(1).strip()
            if target.startswith(("http://", "https://", "mailto:", "#", "<")):
                continue
            target_path = (file.parent / target).resolve()
            skill_root = next((parent for parent in [file.parent, *file.parents] if (parent / "SKILL.md").exists()), file.parent).resolve()
            if target.endswith("/examples/") or not str(target_path).startswith(str(skill_root)):
                continue
            if not target_path.exists():
                issues.append(f"{file}: missing reference {target}")
    return ValidationResult(not issues, issues)


def _selected_source(entry: dict) -> Path:
    selected = entry.get("selected_source") or entry.get("source")
    return Path(selected).expanduser()


def load_config(config: Path) -> dict:
    data = json.loads(config.read_text())
    if data.get("schema_version") != 1 or not isinstance(data.get("skills"), list):
        raise ValueError("unsupported or malformed config")
    destinations = [entry.get("destination") for entry in data["skills"]]
    if any(not value for value in destinations) or len(destinations) != len(set(destinations)):
        raise ValueError("destination names must be non-empty and unique")
    return data


def _copy_matches(source: Path, destination: Path, patterns: list[str], excludes: list[str]) -> None:
    copied: set[Path] = set()
    for pattern in patterns:
        matches = [source / pattern] if not any(char in pattern for char in "*?[") else source.glob(pattern)
        for match in matches:
            if not match.exists():
                continue
            relative = match.relative_to(source)
            if any(relative.match(exclude) for exclude in excludes):
                continue
            target = destination / relative
            if match in copied:
                continue
            copied.add(match)
            if match.is_dir():
                shutil.copytree(match, target, dirs_exist_ok=True, symlinks=False)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(match, target, follow_symlinks=True)


def stage_tree(config_path: Path, output: Path) -> Path:
    config = load_config(config_path)
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    installed_entries = []
    for entry in config["skills"]:
        source = _selected_source(entry)
        if not source.exists():
            raise FileNotFoundError(f"source missing for {entry['id']}: {source}")
        destination = output / entry["destination"]
        _copy_matches(source, destination, entry.get("include", ["SKILL.md"]), entry.get("exclude", []))
        installed = dict(entry)
        installed["selected_source"] = str(source)
        installed["sha256"] = sha256_path(destination)
        installed_entries.append(installed)
    installed_manifest = {"schema_version": 1, "skills": installed_entries}
    (output / "manifest.json").write_text(json.dumps(installed_manifest, indent=2) + "\n")
    return output


def _layout(home: Path) -> tuple[Path, Path, Path, Path]:
    home = home.expanduser()
    if home == Path.home():
        pack_root = home / ".codex" / "skill-packs"
        links = home / ".agents" / "skills"
    else:
        pack_root = home / "skill-packs"
        links = home / "agents" / "skills"
    versions = pack_root / "versions"
    current = pack_root / "current"
    return pack_root, versions, current, links


def _backup_current(current: Path, links: Path, manifest: dict, backups: Path) -> str | None:
    if not current.exists() and not current.is_symlink():
        return None
    backup_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backups / backup_id
    backup.mkdir(parents=True, exist_ok=True)
    if current.is_symlink():
        (backup / "current-target").write_text(os.readlink(current))
    elif current.exists():
        shutil.copytree(current, backup / "current", symlinks=True)
    (backup / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    link_targets = {}
    for entry in manifest.get("skills", []):
        link = links / entry["destination"]
        if link.is_symlink():
            link_targets[entry["destination"]] = os.readlink(link)
    (backup / "link-targets.json").write_text(json.dumps(link_targets, indent=2) + "\n")
    return backup_id


def install_tree(stage: Path, home: Path, apply: bool = False) -> InstallResult:
    if not apply:
        return InstallResult(sha256_path(stage))
    result = validate_tree(stage)
    if not result.ok:
        raise ValueError("staged tree is invalid:\n" + "\n".join(result.issues))
    pack_root, versions, current, links = _layout(home)
    versions.mkdir(parents=True, exist_ok=True)
    links.mkdir(parents=True, exist_ok=True)
    digest = sha256_path(stage)
    version = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{digest[:12]}"
    if current.is_symlink() and Path(os.readlink(current)).name.endswith(f"-{digest[:12]}"):
        return InstallResult(Path(os.readlink(current)).name)
    version_path = versions / version
    if not version_path.exists():
        shutil.copytree(stage, version_path, symlinks=True)
    manifest = json.loads((version_path / "manifest.json").read_text())
    backups = pack_root / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    previous_manifest = {}
    if (pack_root / "manifest.json").exists():
        previous_manifest = json.loads((pack_root / "manifest.json").read_text())
    backup_id = _backup_current(current, links, previous_manifest, backups)
    current_new = pack_root / "current.new"
    if current_new.exists() or current_new.is_symlink():
        current_new.unlink()
    current_new.symlink_to(version_path)
    os.replace(current_new, current)
    for entry in manifest["skills"]:
        link = links / entry["destination"]
        if link.exists() or link.is_symlink():
            if not link.is_symlink():
                raise RuntimeError(f"refusing to overwrite unmanaged path: {link}")
            link.unlink()
        link.symlink_to(current / entry["destination"])
    manifest["active_version"] = version
    manifest["backup_id"] = backup_id
    (pack_root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return InstallResult(version, backup_id)


def uninstall_tree(home: Path, apply: bool = False) -> None:
    pack_root, _, current, links = _layout(home)
    manifest_path = pack_root / "manifest.json"
    if not apply or not manifest_path.exists():
        return
    manifest = json.loads(manifest_path.read_text())
    for entry in manifest.get("skills", []):
        link = links / entry["destination"]
        if link.is_symlink():
            link.unlink()
    if current.is_symlink():
        current.unlink()
    shutil.rmtree(pack_root / "versions", ignore_errors=True)
    manifest_path.unlink(missing_ok=True)


def rollback_tree(home: Path, backup_id: str | None = None, apply: bool = False) -> str | None:
    pack_root, _, current, links = _layout(home)
    backups = pack_root / "backups"
    candidates = sorted((path for path in backups.iterdir() if path.is_dir()), reverse=True) if backups.exists() else []
    if backup_id:
        candidates = [path for path in candidates if path.name == backup_id]
    if not candidates:
        raise FileNotFoundError("no rollback backup available")
    backup = candidates[0]
    if not apply:
        return backup.name
    target_file = backup / "current-target"
    if target_file.exists():
        current_new = pack_root / "current.rollback"
        if current_new.exists() or current_new.is_symlink():
            current_new.unlink()
        current_new.symlink_to(target_file.read_text().strip())
        os.replace(current_new, current)
    elif current.is_symlink():
        current.unlink()
    targets_file = backup / "link-targets.json"
    if targets_file.exists():
        for destination, target in json.loads(targets_file.read_text()).items():
            link = links / destination
            if link.exists() or link.is_symlink():
                if link.is_symlink():
                    link.unlink()
                else:
                    continue
            link.symlink_to(target)
    manifest_file = backup / "manifest.json"
    if manifest_file.exists():
        (pack_root / "manifest.json").write_text(manifest_file.read_text())
    return backup.name


def compare_uiux(current: Path, candidate: Path, config: Path) -> dict:
    def profile(path: Path) -> dict:
        skill = path / "SKILL.md"
        text = skill.read_text(errors="replace") if skill.exists() else ""
        return {"path": str(path), "hash": sha256_path(path), "features": len(re.findall(r"\b(?:styles|palettes|guidelines|stacks|charts)\b", text.lower())), "valid": validate_tree(path).ok}

    current_profile = profile(current)
    candidate_profile = profile(candidate)
    if candidate_profile["valid"] and (not current_profile["valid"] or candidate_profile["features"] > current_profile["features"]):
        winner = candidate_profile
    else:
        winner = current_profile
    data = json.loads(config.read_text())
    for entry in data["skills"]:
        if entry["id"] == "ui-ux-pro-max":
            entry["selected_source"] = winner["path"]
            entry["comparison"] = {"current": current_profile, "candidate": candidate_profile, "winner": winner["path"]}
    config.write_text(json.dumps(data, indent=2) + "\n")
    return winner


def probe_discovery(expect: list[str], outside: Path) -> int:
    outside.mkdir(parents=True, exist_ok=True)
    skills_home = Path(os.environ.get("CODEX_SKILLS_HOME", str(Path.home() / ".agents" / "skills")))
    missing = [name for name in expect if not (skills_home / name).exists()]
    print(json.dumps({"skills_home": str(skills_home), "expected": expect, "missing": missing}, indent=2))
    return 1 if missing else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate")
    validate.add_argument("--root", type=Path, required=True)
    stage = sub.add_parser("stage")
    stage.add_argument("--config", type=Path, required=True)
    stage.add_argument("--output", type=Path, required=True)
    install = sub.add_parser("install")
    install.add_argument("--stage", type=Path, required=True)
    install.add_argument("--home", type=Path, default=Path.home())
    install.add_argument("--apply", action="store_true")
    uninstall = sub.add_parser("uninstall")
    uninstall.add_argument("--home", type=Path, default=Path.home())
    uninstall.add_argument("--apply", action="store_true")
    rollback = sub.add_parser("rollback")
    rollback.add_argument("--home", type=Path, default=Path.home())
    rollback.add_argument("--backup-id")
    rollback.add_argument("--apply", action="store_true")
    compare = sub.add_parser("compare-uiux")
    compare.add_argument("--current", type=Path, required=True)
    compare.add_argument("--candidate", type=Path, required=True)
    compare.add_argument("--config", type=Path, required=True)
    probe = sub.add_parser("probe-discovery")
    probe.add_argument("--outside", type=Path, required=True)
    probe.add_argument("--expect", nargs="+", required=True)
    args = parser.parse_args()
    if args.command == "validate":
        result = validate_tree(args.root)
        print("OK" if result.ok else "\n".join(result.issues))
        return 0 if result.ok else 1
    if args.command == "stage":
        stage_tree(args.config, args.output)
        return 0
    if args.command == "install":
        print(install_tree(args.stage, args.home, args.apply))
        return 0
    if args.command == "uninstall":
        uninstall_tree(args.home, args.apply)
        return 0
    if args.command == "rollback":
        print(rollback_tree(args.home, args.backup_id, args.apply) or "no-op")
        return 0
    if args.command == "compare-uiux":
        print(json.dumps(compare_uiux(args.current, args.candidate, args.config), indent=2))
        return 0
    if args.command == "probe-discovery":
        return probe_discovery(args.expect, args.outside)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
