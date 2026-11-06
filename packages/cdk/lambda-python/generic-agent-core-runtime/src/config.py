"""Configuration and environment setup for the agent core runtime."""

import json
import logging
import os
import re
from typing import Any

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

WORKSPACE_DIR = "/tmp/ws"

DEFAULT_MAX_ITERATIONS = 20

FIXED_SYSTEM_PROMPT = f"""## About File Output
- You are running on AWS Bedrock AgentCore. Therefore, when writing files, always write them under `{WORKSPACE_DIR}`.
- Similarly, if you need a workspace, please use the `{WORKSPACE_DIR}` directory. Do not ask the user about their current workspace. It's always `{WORKSPACE_DIR}`.
- Also, users cannot directly access files written under `{WORKSPACE_DIR}`. So when submitting these files to users, *always upload them to S3 using the `upload_file_to_s3_and_retrieve_s3_url` tool and provide the S3 URL*. The S3 URL must be included in the final output.
- If the output file is an image file, the S3 URL output must be in Markdown format.
"""

# Appended when the web search tool is enabled.
# The acceptable use of the Web Search Tool requires that source citations and
# links provided with each search result are retained and displayed to the user.
WEB_SEARCH_SYSTEM_PROMPT = """## About Web Search
- When a question depends on current information, use the web search tool before answering.
- You MUST cite the sources you used. Write each citation as a Markdown link in the form `[title](url)`, and include the publication date when it is available.
- Never present search results without their source links.
"""


def get_aws_credentials() -> dict[str, str]:
    """Get AWS credentials from environment or IAM role"""
    credentials = {}

    if "AWS_ACCESS_KEY_ID" in os.environ:
        credentials["AWS_ACCESS_KEY_ID"] = os.environ["AWS_ACCESS_KEY_ID"]
    if "AWS_SECRET_ACCESS_KEY" in os.environ:
        credentials["AWS_SECRET_ACCESS_KEY"] = os.environ["AWS_SECRET_ACCESS_KEY"]
    if "AWS_SESSION_TOKEN" in os.environ:
        credentials["AWS_SESSION_TOKEN"] = os.environ["AWS_SESSION_TOKEN"]

    credentials["AWS_REGION"] = os.environ.get("AWS_REGION", "us-east-1")

    return credentials


def get_uv_environment() -> dict[str, str]:
    """Get UV environment with AWS credentials"""
    aws_creds = get_aws_credentials()
    return {
        "UV_NO_CACHE": "1",
        "UV_PYTHON": "/usr/local/bin/python",
        "UV_TOOL_DIR": "/tmp/.uv/tool",
        "UV_TOOL_BIN_DIR": "/tmp/.uv/tool/bin",
        "UV_PROJECT_ENVIRONMENT": "/tmp/.venv",
        "npm_config_cache": "/tmp/.npm",
        **aws_creds,
    }


def get_system_prompt(user_system_prompt: str = None, web_search_enabled: bool = False) -> str:
    """Combine user system prompt with fixed system prompt"""
    prompts = []
    if user_system_prompt:
        prompts.append(user_system_prompt)
    prompts.append(FIXED_SYSTEM_PROMPT)
    if web_search_enabled:
        prompts.append(WEB_SEARCH_SYSTEM_PROMPT)
    return "\n".join(prompts)


def extract_model_info(model_info: Any) -> tuple[str, str]:
    """Extract model ID and region from model info"""
    aws_creds = get_aws_credentials()

    if isinstance(model_info, str):
        model_id = model_info
        region = aws_creds.get("AWS_REGION", "us-east-1")
    else:
        model_id = model_info.get("modelId", "us.anthropic.claude-3-5-sonnet-20241022-v2:0")
        region = model_info.get("region", aws_creds.get("AWS_REGION", "us-east-1"))

    return model_id, region


def get_max_iterations() -> int:
    """Get maximum iterations from environment or default to {DEFAULT_MAX_ITERATIONS}"""
    try:
        return int(os.environ.get("MAX_ITERATIONS", DEFAULT_MAX_ITERATIONS))
    except ValueError:
        logger.warning(f"Invalid MAX_ITERATIONS value. Defaulting to {DEFAULT_MAX_ITERATIONS}.")
        return DEFAULT_MAX_ITERATIONS


# CRI (Cross-Region Inference) prefix pattern
CRI_PREFIX_PATTERN = re.compile(r"^(global|us|eu|apac|jp)\.")

# Prompt caching configuration
# Based on: https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
# Load from environment variable (injected by CDK from TypeScript definition)
_supported_cache_fields_env = os.environ.get("SUPPORTED_CACHE_FIELDS")
if _supported_cache_fields_env:
    SUPPORTED_CACHE_FIELDS: dict[str, list[str]] = json.loads(_supported_cache_fields_env)
else:
    # Fallback if environment variable is not set (should not happen in production)
    logger.warning("SUPPORTED_CACHE_FIELDS not found in environment, using empty fallback")
    SUPPORTED_CACHE_FIELDS: dict[str, list[str]] = {}


def get_supported_cache_fields(model_id: str) -> list[str]:
    """Get supported cache fields for a model (removes CRI prefix before lookup)"""
    base_model_id = CRI_PREFIX_PATTERN.sub("", model_id)
    return SUPPORTED_CACHE_FIELDS.get(base_model_id, [])


def supports_prompt_cache(model_id: str) -> bool:
    """Check if a model supports prompt caching (system or messages)"""
    return len(get_supported_cache_fields(model_id)) > 0


def supports_tools_cache(model_id: str) -> bool:
    """Check if a model supports tools caching"""
    return "tools" in get_supported_cache_fields(model_id)
