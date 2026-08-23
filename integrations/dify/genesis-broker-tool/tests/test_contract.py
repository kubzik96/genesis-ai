from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PluginContractTests(unittest.TestCase):
    def test_provider_credential_is_secret_input_and_not_a_tool_parameter(self) -> None:
        provider = (ROOT / "provider/genesis_broker.yaml").read_text(encoding="utf-8")
        tool = (ROOT / "tools/context_read.yaml").read_text(encoding="utf-8")
        self.assertIn("broker_service_token:", provider)
        self.assertIn("type: secret-input", provider)
        self.assertNotIn("broker_service_token", tool)
        self.assertNotIn("Authorization", tool)

    def test_provider_validation_has_no_network_primitive(self) -> None:
        source = (ROOT / "provider/genesis_broker.py").read_text(encoding="utf-8")
        for forbidden in ("requests", "urllib", "httpx", "urlopen", "socket"):
            self.assertNotIn(forbidden, source)

    def test_runtime_sources_contain_no_logging_calls(self) -> None:
        runtime_files = [
            ROOT / "provider/genesis_broker.py",
            ROOT / "tools/context_read.py",
            ROOT / "genesis_broker/client.py",
        ]
        for path in runtime_files:
            source = path.read_text(encoding="utf-8")
            for forbidden in ("logging.", "logger.", "print("):
                self.assertNotIn(forbidden, source, path.as_posix())

    def test_broker_url_is_fixed_and_not_a_provider_field(self) -> None:
        provider = (ROOT / "provider/genesis_broker.yaml").read_text(encoding="utf-8")
        client = (ROOT / "genesis_broker/client.py").read_text(encoding="utf-8")
        self.assertNotIn("base_url:", provider)
        self.assertIn(
            'BROKER_BASE_URL = "https://genesis-broker.genesis-ai-kubzik96.workers.dev"',
            client,
        )

    def test_tool_exports_only_safe_non_json_diagnostics(self) -> None:
        source = (ROOT / "tools/context_read.py").read_text(encoding="utf-8")
        self.assertIn('safe_error["content_type"] = exc.content_type', source)
        for forbidden in ("response.body", "response.headers", "request.headers"):
            self.assertNotIn(forbidden, source)

    def test_tool_declares_named_workflow_outputs(self) -> None:
        tool = (ROOT / "tools/context_read.yaml").read_text(encoding="utf-8")
        self.assertIn("output_schema:", tool)
        for name in ("ok", "path", "sha", "content", "repository", "ref", "error"):
            self.assertIn(f"    {name}:\n", tool)


if __name__ == "__main__":
    unittest.main()
