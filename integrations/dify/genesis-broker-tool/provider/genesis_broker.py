"""Dify provider with local-only credential validation."""

from typing import Any

from dify_plugin import ToolProvider
from dify_plugin.errors.tool import ToolProviderCredentialValidationError

from genesis_broker.client import CredentialValidationError, validate_raw_token


class GenesisBrokerProvider(ToolProvider):
    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        try:
            validate_raw_token(credentials.get("broker_service_token"))
        except CredentialValidationError as exc:
            raise ToolProviderCredentialValidationError(
                "Invalid Genesis Broker credential format."
            ) from exc
