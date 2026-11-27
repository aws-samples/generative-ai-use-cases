"""Per-user output files.

Files an agent writes for its answer are stored in the file bucket under the
caller's prefix, `users/<sub>/agent-outputs/<uuid>/<fileName>`, the same layout
`agentOutputKey` in `packages/common/src/storage/file-keys.ts` produces.
`<sub>` is the Cognito `sub` of the caller's id token, verified here against
the user pool, so the key always belongs to who asked for the file.
"""

import json
import logging
import os
import re
import uuid
from functools import lru_cache
from urllib.parse import quote

import boto3
import jwt

logger = logging.getLogger(__name__)

MAX_FILE_NAME_LENGTH = 200
JWKS_TIMEOUT_SECONDS = 5

# encodeURIComponent leaves these unescaped (letters, digits and `-_.~` are
# always safe for quote()).
_URI_COMPONENT_SAFE = "!*'()"


@lru_cache(maxsize=4)
def _jwks_client(issuer: str) -> jwt.PyJWKClient:
    # A short timeout: a closed network that cannot reach Cognito fails fast.
    return jwt.PyJWKClient(f"{issuer}/.well-known/jwks.json", cache_keys=True, timeout=JWKS_TIMEOUT_SECONDS)


def verified_user_sub(id_token: str | None, user_pool_id: str | None, client_id: str | None) -> str | None:
    """`sub` of a valid id token for this user pool and client, else None."""
    if not id_token or not user_pool_id or not client_id:
        return None
    region = user_pool_id.split("_", 1)[0]
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
    try:
        signing_key = _jwks_client(issuer).get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer,
            options={"require": ["exp", "iss", "aud", "token_use"]},
        )
    except Exception as e:  # invalid token, or JWKS unreachable: deny either way
        logger.warning(f"id token rejected: {type(e).__name__}")
        return None
    if claims.get("token_use") != "id":
        return None
    sub = claims.get("sub")
    return sub if isinstance(sub, str) and sub else None


def sanitize_file_name(name: str) -> str:
    """One path segment, without control characters (mirrors `sanitizeFileName`)."""
    base = re.split(r"[/\\]", name or "")[-1]
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    limited = cleaned[-MAX_FILE_NAME_LENGTH:]
    return "file" if limited == "" or re.fullmatch(r"\.+", limited) else limited


def agent_output_key(user_sub: str, file_name: str) -> str:
    owner = quote(user_sub, safe=_URI_COMPONENT_SAFE)
    return f"users/{owner}/agent-outputs/{uuid.uuid4()}/{sanitize_file_name(file_name)}"


def workspace_file(filepath: str, workspace_dir: str) -> str:
    """The real path of a regular file inside the workspace, else ValueError.

    Resolves `..` and symbolic links first, so a path such as
    `/tmp/ws/../../etc/passwd` or a link out of the workspace is refused.
    """
    root = os.path.realpath(workspace_dir)
    real = os.path.realpath(filepath)
    if os.path.commonpath([root, real]) != root or real == root or not os.path.isfile(real):
        raise ValueError(f"{filepath} is not a file under the {workspace_dir} directory. Files to be uploaded must exist under {workspace_dir}.")
    return real


def upload_new_object(s3_client, filepath: str, bucket: str, key: str) -> None:
    """Create the object; never overwrite one (the bucket grant requires If-None-Match)."""
    with open(filepath, "rb") as body:
        put_new_object(s3_client, body, bucket, key)


def put_new_object(s3_client, body, bucket: str, key: str) -> None:
    """Create the object from bytes or a file object; never overwrite one."""
    s3_client.put_object(Bucket=bucket, Key=key, Body=body, IfNoneMatch="*")


def object_url(bucket: str, region: str, key: str) -> str:
    """HTTPS URL of an object. The key is percent-encoded so the API reads it back exactly."""
    return f"https://{bucket}.s3.{region}.amazonaws.com/{quote(key, safe='/')}"


@lru_cache(maxsize=1)
def _runtime_config(parameter_name: str, region: str) -> dict:
    value = boto3.client("ssm", region_name=region).get_parameter(Name=parameter_name)["Parameter"]["Value"]
    return json.loads(value)


class RuntimeConfigUnavailable(Exception):
    """The runtime is deployed with a config parameter that cannot be read."""


def runtime_config() -> dict | None:
    """User pool and file bucket of the GenU deployment this runtime serves.

    The main stack is deployed after this runtime's stack, so it publishes them
    in an SSM parameter (`RUNTIME_CONFIG_PARAMETER` in `RUNTIME_CONFIG_REGION`)
    instead of an environment variable. Keys: userPoolId, userPoolClientId,
    fileBucket, fileBucketRegion.

    Returns None only when no parameter is configured (local testing). A
    configured parameter that cannot be read (main stack not deployed yet,
    unreachable region, access denied) raises RuntimeConfigUnavailable, so a
    deployed runtime never silently skips verifying the caller.
    """
    name = os.environ.get("RUNTIME_CONFIG_PARAMETER")
    region = os.environ.get("RUNTIME_CONFIG_REGION")
    if not name or not region:
        return None
    try:
        config = _runtime_config(name, region)
    except Exception as e:
        logger.error(f"Cannot read runtime config {name}: {type(e).__name__}")
        raise RuntimeConfigUnavailable(name) from e
    if not all(config.get(k) for k in ("userPoolId", "userPoolClientId", "fileBucket", "fileBucketRegion")):
        _runtime_config.cache_clear()
        raise RuntimeConfigUnavailable(name)
    return config
