"""Who the caller is, according to a token the service already validated.

The user_id in the payload is written by the browser: useful in a log line,
useless for deciding whose data a request may reach.

With a JWT authorizer, AgentCore validates the caller's token — signature,
expiry, issuer, client — before the request is admitted, and forwards the
Authorization header only when the runtime's allowlist names it. So a token
read here is one that got past the authorizer, and its claims are as good as
the authorizer's own checks. AWS documents this and says the signature need
not be checked again for that reason.

What is still worth checking is that the token is the kind it claims to be:
Cognito marks an access token token_use=access and an ID token token_use=id,
and the two are not interchangeable.
"""

import logging

import jwt

logger = logging.getLogger(__name__)


def verified_subject(authorization: str | None) -> str | None:
    """The subject of the caller's bearer token.

    Returns None whenever there is no subject to be had — no header, a
    signature rather than a token, a token of the wrong kind. A caller that
    cannot be identified is not an error: it is an installation running on IAM
    authorization, where the header carries a SigV4 signature and no token
    was ever validated.
    """
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        # Verified by the authorizer before this request was admitted; see
        # the module docstring.
        claims = jwt.decode(token, options={"verify_signature": False})
    except jwt.InvalidTokenError as e:
        logger.info(f"Caller's bearer token could not be read: {e}")
        return None

    if claims.get("token_use") != "access":
        logger.info("Caller's token is not an access token; ignoring its subject")
        return None
    return claims.get("sub") or None
