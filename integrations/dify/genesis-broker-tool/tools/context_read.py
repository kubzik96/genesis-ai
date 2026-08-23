"""Read one server-allowlisted repository context file through Genesis Broker."""

from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from genesis_broker.client import BrokerClientError, CredentialValidationError, GenesisBrokerClient


class GenesisBrokerContextReadTool(Tool):
    def _variable_messages(
        self, values: dict[str, Any]
    ) -> Generator[ToolInvokeMessage]:
        for name, value in values.items():
            if value is not None:
                yield self.create_variable_message(name, value)

    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage]:
        try:
            client = GenesisBrokerClient(
                self.runtime.credentials.get("broker_service_token", "")
            )
            result = client.context_read(tool_parameters.get("path", ""))
        except CredentialValidationError:
            yield from self._variable_messages(
                {"ok": False, "error": "INVALID_PROVIDER_CREDENTIAL"}
            )
            return
        except BrokerClientError as exc:
            safe_error = {"ok": False, "error": exc.code, "status": exc.status}
            if exc.content_type is not None:
                safe_error["content_type"] = exc.content_type
            yield from self._variable_messages(safe_error)
            return

        yield from self._variable_messages(
            {
                "ok": True,
                "path": result.get("path"),
                "sha": result.get("sha"),
                "content": result.get("content"),
                "repository": result.get("repository"),
                "ref": result.get("ref"),
            }
        )
