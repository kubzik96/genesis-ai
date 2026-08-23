import os
from pathlib import Path, PurePosixPath
import unittest
import zipfile


EXPECTED_VERSION = "0.1.2"
EXPECTED_REQUIREMENT = "dify-plugin>=0.9.0,<1.0.0"
PACKAGE_ENV = "GENESIS_BROKER_PACKAGE"


class PackageContractTests(unittest.TestCase):
    def test_built_package_contains_runtime_contract(self) -> None:
        package_value = os.environ.get(PACKAGE_ENV)
        if not package_value:
            self.skipTest(f"{PACKAGE_ENV} is not set; run this test against a built package")

        package = Path(package_value)
        self.assertTrue(package.is_file(), package)

        with zipfile.ZipFile(package) as archive:
            names = set(archive.namelist())
            required = {
                "main.py",
                "manifest.yaml",
                "pyproject.toml",
                "requirements.txt",
                "provider/genesis_broker.yaml",
                "tools/context_read.yaml",
            }
            self.assertTrue(required.issubset(names), sorted(required - names))
            self.assertEqual(
                archive.read("requirements.txt").decode("utf-8").strip(),
                EXPECTED_REQUIREMENT,
            )
            self.assertTrue(
                archive.read("manifest.yaml")
                .decode("utf-8")
                .startswith(f"version: {EXPECTED_VERSION}\n")
            )
            self.assertIn(
                f'version = "{EXPECTED_VERSION}"',
                archive.read("pyproject.toml").decode("utf-8"),
            )

        for name in names:
            parts = PurePosixPath(name).parts
            self.assertNotIn("__pycache__", parts, name)
            self.assertNotIn(".git", parts, name)
            self.assertFalse(name.endswith((".pyc", ".pyo")), name)


if __name__ == "__main__":
    unittest.main()
