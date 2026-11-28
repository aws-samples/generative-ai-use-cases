"""Agent management for the agent core runtime."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import boto3
from strands import Agent as StrandsAgent
from strands.models import BedrockModel

from . import memory, sandbox
from .config import extract_model_info, get_code_interpreter_prompt, get_max_iterations, get_max_tokens, get_system_prompt, supports_prompt_cache, supports_tools_cache
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
        user_sub: str | None = None,
        file_config: dict | None = None,
        memory_enabled: bool | None = False,
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
                user_sub=user_sub,
                file_config=file_config,
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

            # Without this Bedrock applies its default of 4,096 output tokens, which
            # a long answer or a tool call with a large argument runs into.
            max_tokens = get_max_tokens(model_id)
            if max_tokens:
                bedrock_model_params["max_tokens"] = max_tokens

            # Only enable caching for officially supported models
            if supports_prompt_cache(model_id):
                bedrock_model_params["cache_prompt"] = "default"

                if supports_tools_cache(model_id):
                    bedrock_model_params["cache_tools"] = "default"

            bedrock_model = BedrockModel(**bedrock_model_params)

            # Process messages and prompt using utility functions
            processed_messages = process_messages(messages)
            processed_prompt = process_prompt(prompt)

            # The code interpreter has a sandbox of its own: put the attachments
            # there, and tell the model where they are and how to hand files back.
            code_interpreter = self.tool_manager.code_interpreter
            hooks = []
            if code_interpreter is not None:
                files = sandbox.attachments(processed_messages, processed_prompt)
                # Starts a sandbox session only when there is something to put in it
                paths = sandbox.put_attachments(code_interpreter, files)
                combined_system_prompt += "\n" + get_code_interpreter_prompt(paths)
                hooks.append(sandbox.CodeInterpreterHook(code_interpreter))

            # What this user told this agent before. Only for an agent that
            # uses memory, and only for a caller the runtime could identify.
            use_memory = bool(memory_enabled and memory.enabled() and user_sub and agent_id)
            user_text = _text_of(prompt)
            # Preferences go into the system prompt, which stays the same while
            # they do; what was found for this request goes with the message.
            if use_memory:
                recalled = await asyncio.to_thread(memory.recall, user_sub, agent_id, user_text)
                if recalled.standing:
                    combined_system_prompt = f"{combined_system_prompt}\n\n{recalled.standing}"
                processed_prompt = memory.with_recalled(processed_prompt, recalled.for_request)
                if recalled.standing or recalled.for_request:
                    logger.info("Recalled memories for this request")

            # Create Strands agent and stream response
            agent = StrandsAgent(
                system_prompt=combined_system_prompt,
                messages=processed_messages,
                model=bedrock_model,
                tools=tools,
                callback_handler=self.iteration_limit_handler,
                hooks=hooks,
            )

            answer: list[str] = []
            async for event in agent.stream_async(processed_prompt):
                if "event" in event:
                    delta = event["event"].get("contentBlockDelta", {}).get("delta", {}).get("text")
                    if delta:
                        answer.append(delta)
                    yield json.dumps(event, ensure_ascii=False) + "\n"

            # Record the turn once it is answered; the long-term memories are
            # drawn from it in the background, by AgentCore.
            if use_memory:
                await asyncio.to_thread(memory.remember, user_sub, agent_id, session_id, user_text, "".join(answer))

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
            if self.tool_manager.code_interpreter is not None:
                await asyncio.to_thread(sandbox.stop_sessions, self.tool_manager.code_interpreter)
            # Cleanup is handled automatically by the dynamic MCP client
            if user_id:
                logger.debug(f"Session cleanup for user {user_id} handled automatically")


def _text_of(prompt: str | list[dict[str, Any]] | None) -> str:
    """The text the user typed this turn (attachments are left out)."""
    if isinstance(prompt, str):
        return prompt
    return "\n".join(b["text"] for b in prompt or [] if isinstance(b, dict) and isinstance(b.get("text"), str))
