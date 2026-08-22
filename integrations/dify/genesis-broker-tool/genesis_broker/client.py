"""Fail-closed Genesis Broker client with a non-exportable auth header."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol
from urllib import error, request

BROKER_BASE_URL = "https://genesis-broker.genesis-ai-kubzik96.workers.dev"
CONTEXT_ALLOWLIST = frozenset(
    {
        "bridge/QUEUE.md",
        "bridge/HANDOFF.md",
        "governance/Constitution.md",
        "governance/DevelopmentWorkflow.md",
        "specifications/INDEX.md",
        "specifications/S-0001-Genesis-One-Window-Execution-Spike.md",
        "specifications/S-0002-Genesis-Secure-GitHub-Broker-MVP.md",
    }
)
_RAW_TOKEN = re.compile(r"[A-Za-z0-9_-]{64}\Z")
_SENSITIVE_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "set-cookie",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "api_key",
        "xai_api_key",
        "github_pat",
    }
)


class CredentialValidationError(ValueError):
    """A credential failed local shape validation."""


class BrokerClientError(RuntimeError):
    """A safe client error whose message never includes request details."""

    def __init__(self, code: str, *, status: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status = status


class BrokerResponseError(BrokerClientError):
    """A non-success Broker response represented by safe code and status only."""


def validate_raw_token(value: Any) -> str:
    """Validate the provider credential without network or external side effects."""

    if not isinstance(value, str) or not _RAW_TOKEN.fullmatch(value):
        raise CredentialValidationError(
            "Broker credential must be a 64-character URL-safe raw token."
        )
    return value


def _sanitize(value: Any, secret: str) -> Any:
    """Remove credential-bearing fields and redact the exact credential in strings."""

    if isinstance(value, Mapping):
        clean: dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            if key_text.lower() in _SENSITIVE_KEYS:
                continue
            clean[key_text] = _sanitize(item, secret)
        return clean
    if isinstance(value, list):
        return [_sanitize(item, secret) for item in value]
    if isinstance(value, str):
        return value.replace(f"Bearer {secret}", "[REDACTED]").replace(secret, "[REDACTED]")
    return value


@dataclass(frozen=True)
class TransportResponse:
    status: int
    payload: Any


class Transport(Protocol):
    def request_json(
        self,
        *,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Mapping[str, Any] | None,
        timeout: float,
    ) -> TransportResponse: ...


class _NoRedirectHandler(request.HTTPRedirectHandler):
    """Convert every redirect into a handled HTTP response; never forward auth."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


class UrllibTransport:
    """Small runtime transport. It deliberately emits no logs or request objects."""

    def __init__(self) -> None:
        self.__opener = request.build_opener(_NoRedirectHandler())

    def request_json(
        self,
        *,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Mapping[str, Any] | None,
        timeout: float,
    ) -> TransportResponse:
        data = None if body is None else json.dumps(body).encode("utf-8")
        outbound = request.Request(url=url, data=data, headers=dict(headers), method=method)
        try:
            with self.__opener.open(outbound, timeout=timeout) as response:
                raw = response.read()
                status = int(response.status)
        except error.HTTPError as exc:
            raw = exc.read()
            status = int(exc.code)
        except (error.URLError, TimeoutError, OSError) as exc:
            raise BrokerClientError("BROKER_REQUEST_FAILED") from exc

        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BrokerClientError("BROKER_INVALID_RESPONSE", status=status) from exc
        return TransportResponse(status=status, payload=payload)


class GenesisBrokerClient:
    """Read-only client for the first private Dify plugin slice."""

    def __init__(
        self,
        raw_token: str,
        *,
        transport: Transport | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.__raw_token = validate_raw_token(raw_token)
        self.__transport = transport or UrllibTransport()
        self.__timeout = timeout

    def context_read(self, path: str) -> dict[str, Any]:
        normalized = path.lstrip("/") if isinstance(path, str) else ""
        if normalized not in CONTEXT_ALLOWLIST:
            raise BrokerClientError("PATH_NOT_ALLOWED", status=403)

        response = self.__transport.request_json(
            method="POST",
            url=f"{BROKER_BASE_URL}/v1/context/read",
            headers={
                "Authorization": f"Bearer {self.__raw_token}",
                "Content-Type": "application/json",
            },
            body={"path": normalized},
            timeout=self.__timeout,
        )
        safe_payload = _sanitize(response.payload, self.__raw_token)
        if not 200 <= response.status < 300:
            safe_code = (
                safe_payload.get("error")
                if isinstance(safe_payload, Mapping)
                and isinstance(safe_payload.get("error"), str)
                else "BROKER_REJECTED"
            )
            raise BrokerResponseError(safe_code, status=response.status)
        if not isinstance(safe_payload, dict):
            raise BrokerClientError("BROKER_INVALID_RESPONSE", status=response.status)
        return safe_payload
