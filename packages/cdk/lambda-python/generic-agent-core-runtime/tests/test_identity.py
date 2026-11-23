"""Who the runtime believes is calling.

The subject read here decides whose data a request may reach. It is only
sound because AgentCore validated the token before admitting the request and
forwarded it under the allowlist, so what is left to check is that the header
holds a bearer token at all, and that the token is the kind it claims to be.
"""

import base64
import json

from src.identity import verified_subject


def token(**claims):
    """A JWT carrying the given claims. The signature is never read — which is
    the point: nothing here may depend on one."""
    part = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    # The signature is still base64url-decoded on the way in, even with the
    # check switched off, so it has to look like one.
    signature = base64.urlsafe_b64encode(b"not-a-real-signature").rstrip(b"=").decode()
    return f"eyJhbGciOiJSUzI1NiJ9.{part}.{signature}"


def bearer(**claims):
    return f"Bearer {token(**claims)}"


def test_reads_the_subject_of_an_access_token():
    assert verified_subject(bearer(sub="user-1", token_use="access")) == "user-1"


def test_accepts_the_scheme_in_any_case():
    assert verified_subject(bearer(sub="u", token_use="access").replace("Bearer", "bearer")) == "u"


# Cognito writes no padding, so a claims segment whose length is not a
# multiple of four is the normal case rather than an odd one.
def test_reads_claims_that_carry_no_padding():
    assert verified_subject(bearer(sub="a", token_use="access")) == "a"


# An ID token and an access token both carry sub, and are not
# interchangeable: AWS documents token_use as the way to tell them apart.
def test_refuses_an_id_token():
    assert verified_subject(bearer(sub="user-1", token_use="id")) is None


def test_refuses_a_token_that_does_not_say_what_it_is():
    assert verified_subject(bearer(sub="user-1")) is None


# Under IAM authorization the same header carries a signature. Reading a
# subject out of one would invent an identity nobody proved.
def test_says_nothing_for_a_sigv4_signature():
    signature = "AWS4-HMAC-SHA256 Credential=AKIA/20260901/ap-northeast-1/bedrock-agentcore/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc123"
    assert verified_subject(signature) is None


def test_says_nothing_without_a_header():
    assert verified_subject(None) is None
    assert verified_subject("") is None


def test_says_nothing_for_something_that_is_not_a_token():
    assert verified_subject("Bearer not-a-jwt") is None
    assert verified_subject("Bearer a.b") is None
    assert verified_subject("Bearer ") is None


def test_says_nothing_when_the_claims_are_not_json():
    part = base64.urlsafe_b64encode(b"not json").rstrip(b"=").decode()
    assert verified_subject(f"Bearer eyJhbGciOiJSUzI1NiJ9.{part}.sig") is None


def test_says_nothing_when_there_is_no_subject():
    assert verified_subject(bearer(token_use="access")) is None
    assert verified_subject(bearer(sub="", token_use="access")) is None
