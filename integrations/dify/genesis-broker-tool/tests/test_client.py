from email.message import Message
from io import BytesIO
import json
import unittest
from unittest.mock import patch
from urllib import error

from genesis_broker.client import (
    BROKER_BASE_URL,
    BrokerClientError,
    BrokerResponseError,
    GenesisBrokerClient,
    TransportResponse,
    _NoRedirectHandler,
    UrllibTransport,
)


class RecordingTransport:
    def __init__(self, response: TransportResponse) -> None:
        self.response = response
        self.calls: list[dict] = []

    def request_json(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


class ExplodingTransport:
    def request_json(self, **kwargs):
        raise AssertionError("transport must not be called")


class RaisingOpener:
    def __init__(self, response_error: Exception) -> None:
        self.response_error = response_error
        self.requests = []

    def open(self, outbound, timeout):
        self.requests.append((outbound, timeout))
        raise self.response_error


def http_error(*, status: int, content_type: str, body: bytes) -> error.HTTPError:
    headers = Message()
    headers["Content-Type"] = content_type
    return error.HTTPError(
        f"{BROKER_BASE_URL}/v1/context/read",
        status,
        "rejected",
        headers,
        BytesIO(body),
    )


class ClientTests(unittest.TestCase):
    token = "A" * 64

    def test_context_read_builds_auth_internally_and_returns_sanitized_data(self) -> None:
        transport = RecordingTransport(
            TransportResponse(
                status=200,
                payload={
                    "path": "bridge/QUEUE.md",
                    "content": f"safe prefix {self.token}",
                    "Authorization": f"Bearer {self.token}",
                    "nested": {"token": self.token, "ok": True},
                },
            )
        )
        client = GenesisBrokerClient(self.token, transport=transport)

        result = client.context_read("bridge/QUEUE.md")

        self.assertEqual(len(transport.calls), 1)
        call = transport.calls[0]
        self.assertEqual(call["url"], f"{BROKER_BASE_URL}/v1/context/read")
        self.assertEqual(call["headers"]["Authorization"], f"Bearer {self.token}")
        self.assertEqual(call["headers"]["Accept"], "application/json")
        self.assertEqual(
            call["headers"]["User-Agent"], "GenesisBrokerDifyPlugin/0.1.2"
        )
        serialized = json.dumps(result)
        self.assertNotIn(self.token, serialized)
        self.assertNotIn("Authorization", serialized)
        self.assertNotIn('"token"', serialized)
        self.assertEqual(result["content"], "safe prefix [REDACTED]")

    def test_denied_path_fails_before_transport(self) -> None:
        client = GenesisBrokerClient(self.token, transport=ExplodingTransport())
        with self.assertRaises(BrokerClientError) as caught:
            client.context_read("README.md")
        self.assertEqual(caught.exception.code, "PATH_NOT_ALLOWED")
        self.assertEqual(caught.exception.status, 403)

    def test_non_success_exposes_only_safe_code_and_status(self) -> None:
        transport = RecordingTransport(
            TransportResponse(
                status=401,
                payload={
                    "error": "UNAUTHORIZED",
                    "message": f"do not leak {self.token}",
                    "authorization": f"Bearer {self.token}",
                },
            )
        )
        client = GenesisBrokerClient(self.token, transport=transport)

        with self.assertRaises(BrokerResponseError) as caught:
            client.context_read("specifications/INDEX.md")

        self.assertEqual(caught.exception.code, "UNAUTHORIZED")
        self.assertEqual(caught.exception.status, 401)
        self.assertNotIn(self.token, str(caught.exception))

    def test_json_http_error_preserves_broker_code_without_raw_details(self) -> None:
        response_error = http_error(
            status=403,
            content_type="application/json; charset=utf-8",
            body=b'{"error":"PATH_NOT_ALLOWED","detail":"private"}',
        )
        opener = RaisingOpener(response_error)
        with patch("genesis_broker.client.request.build_opener", return_value=opener):
            transport = UrllibTransport()
        client = GenesisBrokerClient(self.token, transport=transport)

        with self.assertRaises(BrokerResponseError) as caught:
            client.context_read("bridge/QUEUE.md")

        self.assertEqual(caught.exception.code, "PATH_NOT_ALLOWED")
        self.assertEqual(caught.exception.status, 403)
        self.assertIsNone(caught.exception.content_type)
        self.assertNotIn("private", str(caught.exception))

    def test_non_json_http_error_exposes_only_safe_classification(self) -> None:
        secret_body = f"<html>blocked {self.token}</html>".encode()
        response_error = http_error(
            status=403,
            content_type="text/html; charset=utf-8",
            body=secret_body,
        )
        opener = RaisingOpener(response_error)
        with patch("genesis_broker.client.request.build_opener", return_value=opener):
            transport = UrllibTransport()

        with self.assertRaises(BrokerClientError) as caught:
            transport.request_json(
                method="POST",
                url=f"{BROKER_BASE_URL}/v1/context/read",
                headers={"Authorization": f"Bearer {self.token}"},
                body={"path": "bridge/QUEUE.md"},
                timeout=10.0,
            )

        self.assertEqual(caught.exception.code, "BROKER_NON_JSON_RESPONSE")
        self.assertEqual(caught.exception.status, 403)
        self.assertEqual(caught.exception.content_type, "html")
        rendered = str(caught.exception)
        self.assertNotIn(self.token, rendered)
        self.assertNotIn("<html>", rendered)
        self.assertEqual(len(opener.requests), 1)

    def test_transport_failure_exposes_only_stable_code(self) -> None:
        opener = RaisingOpener(error.URLError("private gateway detail"))
        with patch("genesis_broker.client.request.build_opener", return_value=opener):
            transport = UrllibTransport()

        with self.assertRaises(BrokerClientError) as caught:
            transport.request_json(
                method="POST",
                url=f"{BROKER_BASE_URL}/v1/context/read",
                headers={"Authorization": f"Bearer {self.token}"},
                body={"path": "bridge/QUEUE.md"},
                timeout=10.0,
            )

        self.assertEqual(caught.exception.code, "BROKER_REQUEST_FAILED")
        self.assertIsNone(caught.exception.status)
        self.assertIsNone(caught.exception.content_type)
        self.assertNotIn("private gateway detail", str(caught.exception))
        self.assertEqual(len(opener.requests), 1)

    def test_redirect_handler_never_forwards_request(self) -> None:
        handler = _NoRedirectHandler()
        redirected = handler.redirect_request(
            req=None,
            fp=None,
            code=302,
            msg="Found",
            headers={},
            newurl="https://example.invalid/capture",
        )
        self.assertIsNone(redirected)


if __name__ == "__main__":
    unittest.main()
