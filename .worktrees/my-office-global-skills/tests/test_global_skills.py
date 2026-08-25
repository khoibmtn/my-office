import importlib.util
import json
from pathlib import Path
import sys

import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "global-skills.py"
spec = importlib.util.spec_from_file_location("global_skills", SCRIPT)
global_skills = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = global_skills
spec.loader.exec_module(global_skills)


def write_config(path: Path, source: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "skills": [
                    {
                        "id": "demo-skill",
                        "source": str(source),
                        "destination": "demo-skill",
                        "owner": "test",
                        "activation": "automatic",
                        "dependencies": [],
                        "include": ["SKILL.md", "references/**"],
                        "exclude": ["hooks/**", ".git/**"],
                    }
                ],
            }
        )
    )


def make_source_tree(tmp_path: Path) -> Path:
    source = tmp_path / "source"
    (source / "references").mkdir(parents=True)
    (source / "SKILL.md").write_text(
        "---\nname: demo-skill\ndescription: Use for demo tasks.\n---\n\n# Demo\n"
    )
    (source / "references" / "guide.md").write_text("relative guide")
    (source / "hooks").mkdir()
    (source / "hooks" / "unsafe.sh").write_text("git push")
    return source


class GlobalSkillsTests(unittest.TestCase):
    def test_validate_rejects_missing_reference_and_forbidden_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            root = tmp_path / "stage"
            skill = root / "demo-skill"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: demo-skill\ndescription: Demo.\n---\n\nSee [missing](missing.md)\n"
            )
            (skill / "unsafe.md").write_text("git add -A\n")

            result = global_skills.validate_tree(root)

            self.assertFalse(result.ok)
            self.assertTrue(any("missing.md" in issue for issue in result.issues))
            self.assertTrue(any("git add -A" in issue for issue in result.issues))

    def test_stage_excludes_unsafe_paths_and_install_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            source_tree = make_source_tree(tmp_path)
            config = tmp_path / "config.json"
            write_config(config, source_tree)
            stage = tmp_path / "stage"
            global_skills.stage_tree(config, stage)

            self.assertTrue((stage / "demo-skill" / "SKILL.md").exists())
            self.assertTrue((stage / "demo-skill" / "references" / "guide.md").exists())
            self.assertFalse((stage / "demo-skill" / "hooks" / "unsafe.sh").exists())

            home = tmp_path / "home"
            first = global_skills.install_tree(stage, home, apply=True)
            second = global_skills.install_tree(stage, home, apply=True)

            self.assertEqual(first.version, second.version)
            self.assertTrue((home / "skill-packs" / "current" / "demo-skill" / "SKILL.md").exists())
            self.assertTrue((home / "agents" / "skills" / "demo-skill").is_symlink())

    def test_rollback_and_uninstall_preserve_unrelated_skill(self):
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            source_tree = make_source_tree(tmp_path)
            config = tmp_path / "config.json"
            write_config(config, source_tree)
            stage = tmp_path / "stage"
            global_skills.stage_tree(config, stage)
            home = tmp_path / "home"
            unrelated = home / "agents" / "skills" / "keep-me"
            unrelated.mkdir(parents=True)
            (unrelated / "SKILL.md").write_text("keep")

            global_skills.install_tree(stage, home, apply=True)
            global_skills.uninstall_tree(home, apply=True)

            self.assertTrue(unrelated.exists())
            self.assertFalse((home / "agents" / "skills" / "demo-skill").exists())

    def test_rollback_restores_previous_version(self):
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            source_tree = make_source_tree(tmp_path)
            config = tmp_path / "config.json"
            write_config(config, source_tree)
            stage_one = tmp_path / "stage-one"
            global_skills.stage_tree(config, stage_one)
            home = tmp_path / "home"
            global_skills.install_tree(stage_one, home, apply=True)
            (source_tree / "references" / "guide.md").write_text("changed")
            stage_two = tmp_path / "stage-two"
            global_skills.stage_tree(config, stage_two)
            global_skills.install_tree(stage_two, home, apply=True)

            global_skills.rollback_tree(home, apply=True)

            restored = home / "skill-packs" / "current" / "demo-skill" / "references" / "guide.md"
            self.assertEqual(restored.read_text(), "relative guide")


if __name__ == "__main__":
    unittest.main()
