import boto3
import json
import uvicorn
import os
import logging
import shutil
import pathlib
import traceback
from strands.models import BedrockModel
from strands import Agent, tool
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters
from fastapi import FastAPI, Response, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from uuid import uuid4

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# AWS credentials handling
def get_aws_credentials():
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


# UV environment with AWS credentials
aws_creds = get_aws_credentials()
UV_ENV = {
    "UV_NO_CACHE": "1",
    "UV_PYTHON": "/usr/local/bin/python",
    "UV_TOOL_DIR": "/tmp/.uv/tool",
    "UV_TOOL_BIN_DIR": "/tmp/.uv/tool/bin",
    "UV_PROJECT_ENVIRONMENT": "/tmp/.venv",
    "npm_config_cache": "/tmp/.npm",
    **aws_creds,
}

WORKSPACE_DIR = "/tmp/ws"

FIXED_SYSTEM_PROMPT = f"""## About File Output
- You are running on AWS Bedrock AgentCore. Therefore, when writing files, always write them under `{WORKSPACE_DIR}`.
- Similarly, if you need a workspace, please use the `{WORKSPACE_DIR}` directory. Do not ask the user about their current workspace. It's always `{WORKSPACE_DIR}`.
- Also, users cannot directly access files written under `{WORKSPACE_DIR}`. So when submitting these files to users, *always upload them to S3 using the `upload_file_to_s3_and_retrieve_s3_url` tool and provide the S3 URL*. The S3 URL must be included in the final output.
- If the output file is an image file, the S3 URL output must be in Markdown format.
"""


class ModelInfo(BaseModel):
    modelId: str
    region: str = "us-east-1"


# Global session ID
session_id = None


def create_session_id():
    """Generate a unique session ID"""
    return str(uuid4())


def create_ws_directory():
    """Create workspace directory if it doesn't exist"""
    logger.info("Create ws directory")
    pathlib.Path(WORKSPACE_DIR).mkdir(exist_ok=True)


def clean_ws_directory():
    """Clean up workspace directory"""
    logger.info("Clean ws directory...")
    if os.path.exists(WORKSPACE_DIR):
        shutil.rmtree(WORKSPACE_DIR)

def extract_model_info(model_info):
    """Extract model ID and region from model info"""
    if isinstance(model_info, str):
        model_id = model_info
        region = aws_creds.get("AWS_REGION", "us-east-1")
    else:
        model_id = model_info.get(
            "modelId", "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        )
        region = model_info.get("region", aws_creds.get("AWS_REGION", "us-east-1"))

    return model_id, region


def get_system_prompt(user_system_prompt):
    """Combine user system prompt with fixed system prompt"""
    if user_system_prompt:
        return f"{user_system_prompt}\n{FIXED_SYSTEM_PROMPT}"
    else:
        return FIXED_SYSTEM_PROMPT


def create_error_response(error_message):
    """Create a standardized error response"""
    return {
        "message": {
            "role": "assistant",
            "content": [
                {
                    "text": f"An error occurred while processing your request: {error_message}",
                }
            ],
        }
    }


def create_empty_response():
    """Create a response for when no message is generated"""
    return {
        "message": {
            "role": "assistant",
            "content": [
                {
                    "text": "I apologize, but I couldn't generate a response. Please try again.",
                }
            ],
        }
    }


@tool
def upload_file_to_s3_and_retrieve_s3_url(filepath: str) -> str:
    """Upload the file at /tmp/ws/* and retrieve the s3 path

    Args:
        filepath: The path to the uploading file
    """
    global session_id

    bucket = os.environ.get("FILE_BUCKET")
    if not bucket:
        # For local testing, provide a fallback message
        logger.warning(
            "FILE_BUCKET environment variable not set. Using local file path for testing."
        )
        return f"Local file path (S3 upload skipped): {filepath}"

    region = aws_creds.get("AWS_REGION", "us-east-1")

    if not filepath.startswith(WORKSPACE_DIR):
        raise ValueError(
            f"{filepath} does not appear to be a file under the {WORKSPACE_DIR} directory. Files to be uploaded must exist under {WORKSPACE_DIR}."
        )

    try:
        filename = os.path.basename(filepath)
        key = f"agentcore/{session_id}/{filename}"

        s3 = boto3.client("s3", region_name=region)
        s3.upload_file(filepath, bucket, key)

        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    except Exception as e:
        logger.error(f"Error uploading file to S3: {e}")
        # For local testing, provide a fallback
        return f"Error uploading to S3: {str(e)}. Local file path: {filepath}"


def load_mcp_tools():
    """Load MCP tools from mcp.json"""
    try:
        with open("mcp.json", "r") as f:
            mcp_json = json.loads(f.read())

            if "mcpServers" not in mcp_json:
                logger.warning("mcpServers not defined in mcp.json")
                return []

            mcp_servers = mcp_json["mcpServers"]
            mcp_clients = []

            for server_name, server in mcp_servers.items():
                try:
                    client = MCPClient(
                        lambda: stdio_client(
                            StdioServerParameters(
                                command=server["command"],
                                args=server.get("args", []),
                                env={**UV_ENV, **server.get("env", {})},
                            )
                        )
                    )
                    client.start()
                    mcp_clients.append(client)
                except Exception as e:
                    logger.error(f"Error creating MCP client for {server_name}: {e}")

            # Flatten the tools
            mcp_tools = sum([c.list_tools_sync() for c in mcp_clients], [])
            logger.info(f"Loaded {len(mcp_tools)} MCP tools")
            return mcp_tools
    except Exception as e:
        logger.error(f"Error loading MCP tools: {e}")
        return []


app = FastAPI(
    title="Generic AgentCore Runtime",
    description="AWS Bedrock AgentCore Runtime with Strands Agent and MCP support",
    version="1.0.0",
)

# Shared MCP clients
app.mcp_tools = None


# Required AgentCore endpoints
@app.get("/ping")
async def ping():
    """Health check endpoint required by AgentCore"""
    return {"status": "healthy", "service": "generic-agent-core-runtime"}


@app.post("/invocations")
async def invocations(request: Request):
    """Main invocation endpoint required by AgentCore

    Expects request with messages, system_prompt, prompt, and model
    """
    global session_id
    session_id = request.headers["x-amzn-bedrock-agentcore-runtime-session-id"]
    if session_id is None:
        session_id = create_session_id()
    logger.info(f"New invocation session: {session_id}")

    # Ensure workspace directory exists
    create_ws_directory()

    try:
        # Read request body
        body = await request.body()
        body_str = body.decode()
        request_data = json.loads(body_str)

        # Handle input field if present (AWS Lambda integration format)
        if "input" in request_data and isinstance(request_data["input"], dict):
            request_data = request_data["input"]

        # Extract required fields with exact field names
        messages = request_data.get("messages", [])
        system_prompt = request_data.get("system_prompt")
        prompt = request_data.get("prompt", "")
        model_info = request_data.get("model", {})

        # Get model info using utility function
        model_id, region = extract_model_info(model_info)

        # Combine system prompts using utility function
        system_prompt = get_system_prompt(system_prompt)

        logger.info(f"Using model: {model_id} in region: {region}")
        logger.info(f"User prompt: {prompt[:100]}...")
        logger.info(f"History messages count: {len(messages)}")

        # Load MCP tools if not already loaded
        if app.mcp_tools is None:
            app.mcp_tools = load_mcp_tools()

        # Create boto3 session
        session = boto3.Session(region_name=region)

        # Create Bedrock model
        bedrock_model = BedrockModel(model_id=model_id, boto_session=session)

        # Create Strands agent with history messages
        agent = Agent(
            system_prompt=system_prompt,
            messages=messages,
            model=bedrock_model,
            tools=app.mcp_tools + [upload_file_to_s3_and_retrieve_s3_url],
        )

        # Generate response using the user prompt
        logger.info("Starting response generation")
        final_message = None

        # Stream the response with the user prompt
        async for event in agent.stream_async(prompt):
            if "message" in event and event["message"].get("role") == "assistant":
                final_message = event

        # Return the final message in Strands format
        if final_message:
            logger.info("Successfully generated response")
            return final_message
        else:
            logger.warning("No response generated")
            return create_empty_response()

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(str(e))
    finally:
        # Clean up workspace
        clean_ws_directory()


if __name__ == "__main__":
    logger.info("Starting Generic AgentCore Runtime on port 8080")
    logger.info(f"AWS Region: {aws_creds.get('AWS_REGION', 'us-east-1')}")

    # Start on port 8080 as required by AgentCore
    uvicorn.run(app, host="0.0.0.0", port=8080)
