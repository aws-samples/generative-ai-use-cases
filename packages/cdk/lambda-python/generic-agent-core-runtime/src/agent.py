"""Agent management for the agent core runtime."""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import boto3
from strands import Agent as StrandsAgent
from strands.models import BedrockModel

from .config import extract_model_info, get_max_iterations, get_system_prompt, supports_prompt_cache, supports_tools_cache
from .tools import ToolManager
from .types import Message, ModelInfo
from .utils import (
    process_messages,
    process_prompt,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class IterationLimitExceededError(Exception):
    """Exception raised when iteration limit is exceeded"""

    pass


class AgentManager:
    """Manages Strands agent creation and execution."""

    def __init__(self):
        self.tool_manager = ToolManager()
        self.max_iterations = get_max_iterations()
        self.iteration_count = 0

    def set_session_info(self, session_id: str, trace_id: str):
        """Set session and trace IDs"""
        self.tool_manager.set_session_info(session_id, trace_id)

    def iteration_limit_handler(self, **ev):
        if ev.get("init_event_loop"):
            self.iteration_count = 0
        if ev.get("start_event_loop"):
            self.iteration_count += 1
            if self.iteration_count > self.max_iterations:
                raise IterationLimitExceededError(f"Event loop reached maximum iteration count ({self.max_iterations}). Please contact the administrator.")

    async def process_request_streaming(
        self,
        messages: list[Message] | list[dict[str, Any]],
        system_prompt: str | None,
        prompt: str | list[dict[str, Any]],
        model_info: ModelInfo,
        user_id: str | None = None,
        mcp_servers: list[str] | None = None,
        session_id: str | None = None,
        agent_id: str | None = None,
        code_execution_enabled: bool | None = False,
        web_search_enabled: bool | None = False,
    ) -> AsyncGenerator[str]:
        """Process a request and yield streaming responses as raw events"""
        try:
            # Set session info if provided
            if session_id:
                self.set_session_info(session_id, session_id)

            # Extract model info
            model_id, region = extract_model_info(model_info)

            # Combine system prompts
            combined_system_prompt = get_system_prompt(system_prompt, web_search_enabled=bool(web_search_enabled))

            # Get tools (MCP handling is done in ToolManager)
            tools = self.tool_manager.get_tools_with_options(
                code_execution_enabled=code_execution_enabled,
                web_search_enabled=web_search_enabled,
                mcp_servers=mcp_servers,
            )
            logger.info(f"Loaded {len(tools)} tools (code execution: {code_execution_enabled}, web search: {web_search_enabled})")

            # Log agent info
            if agent_id:
                logger.debug(f"Processing agent: {agent_id}")

            # Create boto3 session and Bedrock model
            session = boto3.Session(region_name=region)

            # Configure caching based on model support (loaded from environment variable)
            bedrock_model_params = {
                "model_id": model_id,
                "boto_session": session,
            }

            # Only enable caching for officially supported models
            if supports_prompt_cache(model_id):
                bedrock_model_params["cache_prompt"] = "default"

                if supports_tools_cache(model_id):
                    bedrock_model_params["cache_tools"] = "default"

            bedrock_model = BedrockModel(**bedrock_model_params)

            # Process messages and prompt using utility functions
            processed_messages = process_messages(messages)
            processed_prompt = process_prompt(prompt)

            # Create Strands agent and stream response
            agent = StrandsAgent(
                system_prompt=combined_system_prompt,
                messages=processed_messages,
                model=bedrock_model,
                tools=tools,
                callback_handler=self.iteration_limit_handler,
            )

            async for event in agent.stream_async(processed_prompt):
                if "event" in event:
                    yield json.dumps(event, ensure_ascii=False) + "\n"

        except Exception as e:
            logger.error(f"Error processing agent request: {e}", exc_info=True)
            error_event = {
                "event": {
                    "internalServerException": {
                        "message": f"An error occurred while processing your request: {str(e)}",
                    }
                }
            }
            yield json.dumps(error_event, ensure_ascii=False) + "\n"
        finally:
            # Cleanup is handled automatically by the dynamic MCP client
            if user_id:
                logger.debug(f"Session cleanup for user {user_id} handled automatically")
