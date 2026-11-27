"""Main FastAPI application for Generic AgentCore Runtime."""

import asyncio
import json
import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

from src.agent import AgentManager
from src.user_files import RuntimeConfigUnavailable, runtime_config, verified_user_sub
from src.utils import clean_ws_directory, create_error_response, create_ws_directory

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Initialize FastAPI app
app = FastAPI(
    title="Generic AgentCore Runtime",
    description="AWS Bedrock AgentCore Runtime with Strands Agent and MCP support",
    version="1.0.0",
)

# Initialize agent manager
agent_manager = AgentManager()


@app.get("/ping")
async def ping():
    """Health check endpoint required by AgentCore"""
    return {"status": "healthy", "service": "generic-agent-core-runtime"}


@app.post("/invocations")
async def invocations(request: Request):
    """Main invocation endpoint required by AgentCore

    Expects request with messages, system_prompt, prompt, and model
    """
    # Setup session and workspace
    headers = dict(request.headers)
    session_id = headers.get("x-amzn-bedrock-agentcore-runtime-session-id")
    trace_id = headers.get("x-amzn-trace-id")
    agent_manager.set_session_info(session_id, trace_id)
    create_ws_directory()

    try:
        # Parse request body
        body = await request.body()
        try:
            request_data = json.loads(body.decode())
            # Handle AWS Lambda integration format
            if "input" in request_data and isinstance(request_data["input"], dict):
                request_data = request_data["input"]
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {e}")
            return create_error_response("Invalid JSON in request body")

        # Extract fields
        messages = request_data.get("messages", [])
        system_prompt = request_data.get("system_prompt")
        prompt = request_data.get("prompt", [])
        model_info = request_data.get("model", {})
        user_id = request_data.get("user_id")
        mcp_servers = request_data.get("mcp_servers")
        agent_session_id = request_data.get("session_id")
        agent_id = request_data.get("agent_id")
        code_execution_enabled = request_data.get("code_execution_enabled", False)
        web_search_enabled = request_data.get("web_search_enabled", False)

        # Validate required fields
        if not model_info:
            return create_error_response("Model information is required")
        if not prompt and not messages:
            return create_error_response("Either prompt or messages is required")

        # The caller, from their id token. Output files are stored under it.
        # Without a runtime config (local testing) uploads are skipped instead.
        # The shared workspace is left alone on these early returns: other
        # requests in this container may be using it.
        try:
            # SSM and JWKS reads are blocking calls; keep them off the event loop
            # so other requests in this container are not stalled.
            config = await asyncio.to_thread(runtime_config)
        except RuntimeConfigUnavailable:
            return create_error_response("The runtime is not configured yet. Please try again later.")
        user_sub = None
        if config:
            user_sub = await asyncio.to_thread(verified_user_sub, request_data.get("id_token"), config.get("userPoolId"), config.get("userPoolClientId"))
            if user_sub is None:
                return create_error_response("Unauthorized")

        # Stream response
        async def generate():
            try:
                async for chunk in agent_manager.process_request_streaming(
                    messages=messages,
                    system_prompt=system_prompt,
                    prompt=prompt,
                    model_info=model_info,
                    user_id=user_id,
                    mcp_servers=mcp_servers,
                    session_id=agent_session_id or session_id,
                    agent_id=agent_id,
                    code_execution_enabled=code_execution_enabled,
                    web_search_enabled=web_search_enabled,
                    user_sub=user_sub,
                    file_config=config,
                ):
                    yield chunk
            finally:
                clean_ws_directory()

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        logger.error(traceback.format_exc())
        clean_ws_directory()
        return create_error_response(str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="warning", access_log=False)
