import unittest

from genesis_broker.client import CredentialValidationError, validate_raw_token


class CredentialValidationTests(unittest.TestCase):
    def test_accepts_exact_urlsafe_raw_token(self) -> None:
        token = "Ab_9-" + "x" * 59
        self.assertEqual(validate_raw_token(token), token)

    def test_rejects_bearer_prefix_without_echoing_value(self) -> None:
        secret = "s" * 64
        with self.assertRaises(CredentialValidationError) as caught:
            validate_raw_token(f"Bearer {secret}")
        self.assertNotIn(secret, str(caught.exception))

    def test_rejects_wrong_length_whitespace_and_non_string(self) -> None:
        invalid = ["x" * 63, "x" * 65, "x" * 63 + " ", None, 123]
        for value in invalid:
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(CredentialValidationError):
                    validate_raw_token(value)


if __name__ == "__main__":
    unittest.main()
