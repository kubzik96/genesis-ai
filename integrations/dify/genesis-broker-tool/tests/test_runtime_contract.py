from pathlib import Path
import runpy
import sys
import types
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_VERSION = "0.1.4"
EXPECTED_SDK_VERSION = "0.9.0"
EXPECTED_REQUIREMENT = f"dify-plugin=={EXPECTED_SDK_VERSION}"


class RuntimeContractTests(unittest.TestCase):
    def test_runtime_dependency_and_versions_are_synchronized(self) -> None:
        requirements = [
            line.strip()
            for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        manifest = (ROOT / "manifest.yaml").read_text(encoding="utf-8")
        pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")

        self.assertEqual(requirements, [EXPECTED_REQUIREMENT])
        self.assertTrue(EXPECTED_REQUIREMENT.startswith("dify-plugin=="))
        self.assertTrue(manifest.startswith(f"version: {EXPECTED_VERSION}\n"))
        self.assertIn(f'version = "{EXPECTED_VERSION}"', pyproject)
        self.assertIn(f'"{EXPECTED_REQUIREMENT}"', pyproject)

    def test_entrypoint_starts_with_the_declared_sdk_contract(self) -> None:
        calls: list[object] = []
        fake_sdk = types.ModuleType("dify_plugin")

        class FakeEnv:
            def __init__(self) -> None:
                calls.append("env")

        class FakePlugin:
            def __init__(self, env: object) -> None:
                calls.append(("plugin", env.__class__.__name__))

            def run(self) -> None:
                calls.append("run")

        fake_sdk.DifyPluginEnv = FakeEnv
        fake_sdk.Plugin = FakePlugin

        with patch.dict(sys.modules, {"dify_plugin": fake_sdk}):
            runpy.run_path(str(ROOT / "main.py"), run_name="__main__")

        self.assertEqual(calls, ["env", ("plugin", "FakeEnv"), "run"])


if __name__ == "__main__":
    unittest.main()
