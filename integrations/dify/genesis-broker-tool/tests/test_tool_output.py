import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
TOOL_PATH = ROOT / "tools/context_read.py"


class FakeTool:
    def create_json_message(self, json):
        return {"type": "json", "message": {"json_object": json}}

    def create_variable_message(self, variable_name, variable_value):
        return {
            "type": "variable",
            "message": {
                "variable_name": variable_name,
                "variable_value": variable_value,
            },
        }


def load_tool_module():
    fake_sdk = types.ModuleType("dify_plugin")
    fake_sdk.Tool = FakeTool
    fake_entities = types.ModuleType("dify_plugin.entities.tool")
    fake_entities.ToolInvokeMessage = dict
    module_name = "genesis_broker_context_read_contract_test"
    spec = importlib.util.spec_from_file_location(module_name, TOOL_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("unable to load context_read tool")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(
        sys.modules,
        {
            "dify_plugin": fake_sdk,
            "dify_plugin.entities.tool": fake_entities,
        },
    ):
        spec.loader.exec_module(module)
    return module


def output_variables(messages):
    return {
        message["message"]["variable_name"]: message["message"]["variable_value"]
        for message in messages
    }


class ToolOutputContractTests(unittest.TestCase):
    token = "A" * 64

    def invoke_with(self, client_factory, path="bridge/QUEUE.md"):
        module = load_tool_module()
        module.GenesisBrokerClient = client_factory(module)
        tool = module.GenesisBrokerContextReadTool()
        tool.runtime = types.SimpleNamespace(
            credentials={"broker_service_token": self.token}
        )
        return list(tool._invoke({"path": path}))

    def test_compatibility_candidate_uses_declared_variables_not_json(self) -> None:
        """Verify producer output only; Dify Tool-node state is a later integration gate."""

        class SuccessfulClient:
            def __init__(self, raw_token):
                self.raw_token = raw_token

            def context_read(self, path):
                return {
                    "path": path,
                    "sha": "synthetic-sha",
                    "content": "approved content",
                    "repository": "kubzik96/genesis-ai",
                    "ref": "main",
                }

        messages = self.invoke_with(lambda _module: SuccessfulClient)
        rendered = json.dumps(messages)
        variables = output_variables(messages)

        self.assertTrue(messages)
        self.assertTrue(all(message["type"] == "variable" for message in messages))
        self.assertNotIn("json_object", rendered)
        self.assertEqual(
            variables,
            {
                "ok": True,
                "path": "bridge/QUEUE.md",
                "sha": "synthetic-sha",
                "content": "approved content",
                "repository": "kubzik96/genesis-ai",
                "ref": "main",
            },
        )

    def test_broker_error_uses_safe_variables_without_secret_or_content(self) -> None:
        def rejected_client(module):
            class RejectedClient:
                def __init__(self, raw_token):
                    self.raw_token = raw_token

                def context_read(self, path):
                    raise module.BrokerClientError(
                        "BROKER_NON_JSON_RESPONSE", status=403, content_type="html"
                    )

            return RejectedClient

        messages = self.invoke_with(rejected_client)
        rendered = json.dumps(messages)
        variables = output_variables(messages)

        self.assertTrue(all(message["type"] == "variable" for message in messages))
        self.assertEqual(
            variables,
            {
                "ok": False,
                "error": "BROKER_NON_JSON_RESPONSE",
                "status": 403,
                "content_type": "html",
            },
        )
        self.assertNotIn(self.token, rendered)
        self.assertNotIn("Authorization", rendered)
        self.assertNotIn("content", variables)


if __name__ == "__main__":
    unittest.main()
