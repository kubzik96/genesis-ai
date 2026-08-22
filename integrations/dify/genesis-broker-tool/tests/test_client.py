import json
import unittest

from genesis_broker.client import (
    BROKER_BASE_URL,
    BrokerClientError,
    BrokerResponseError,
    GenesisBrokerClient,
    TransportResponse,
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


if __name__ == "__main__":
    unittest.main()
