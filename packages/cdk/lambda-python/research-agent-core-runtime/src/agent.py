"""Agent management for the research agent core runtime."""

import json
import logging
import os
from collections.abc import AsyncGenerator
from typing import Any

from src.config import extract_model_info, get_max_iterations
from src.converters import ContentBlockConverter
from src.tools import ToolManager
from src.types import Message, ModelInfo
from src.utils import process_messages, process_prompt

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

DEFAULT_MODE = "technical-research"

# Supported research modes and their prompt files under prompts/
MODE_PROMPT_FILES = {
    "technical-research": "technical-research.md",
    "mini-research": "mini-research.md",
    "general-research": "general-research.md",
}


class IterationLimitExceededError(Exception):
    """Exception raised when iteration limit is exceeded"""
    pass


class AgentManager:
    """Manages Claude Agent SDK agent creation and execution."""

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
                raise IterationLimitExceededError(
                    f"Event loop reached maximum iteration count ({self.max_iterations})."
                )

    def load_mode_prompt(self, mode: str) -> str:
        """Load system prompt for specified mode"""
        prompt_file = MODE_PROMPT_FILES.get(mode)
        if prompt_file is None:
            logger.warning(f"Unknown mode {mode!r}, falling back to {DEFAULT_MODE}")
            mode = DEFAULT_MODE
            prompt_file = MODE_PROMPT_FILES[DEFAULT_MODE]
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", prompt_file)
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                content = f.read()
                logger.info(f"Loaded {mode} prompt: {len(content)} chars")
                return content
        except Exception as e:
            logger.error(f"Failed to load {mode} prompt: {e}")
            return "You are a helpful AWS technical assistant."

    async def process_request_streaming(
        self,
        messages: list[Message] | list[dict[str, Any]],
        system_prompt: str | None,
        mode: str | None,
        prompt: str | list[dict[str, Any]],
        model_info: ModelInfo,
        user_id: str | None = None,
        mcp_servers: list[str] | None = None,
        session_id: str | None = None,
        agent_id: str | None = None,
    ) -> AsyncGenerator[str]:
        """Process a request and yield streaming responses"""
        try:
            from claude_agent_sdk import ClaudeAgentOptions, query

            if session_id:
                self.set_session_info(session_id, session_id)

            model_id, region = extract_model_info(model_info)
            mcp_config = self.tool_manager.get_mcp_config(mcp_servers=mcp_servers)
            logger.info(f"Loaded {len(mcp_config)} MCP servers")

            # Process messages and prompt
            processed_messages = process_messages(messages)
            processed_prompt = process_prompt(prompt)
            
            # Combine conversation history
            if processed_messages:
                full_prompt = f"{processed_messages}\n\nHuman: {processed_prompt}\nAssistant:"
            else:
                full_prompt = processed_prompt
            
            logger.info(f"Initial prompt: {len(full_prompt)} chars, {len(messages)} previous messages")

            # Load mode-specific system prompt
            effective_mode = mode or DEFAULT_MODE
            mode_system_prompt = self.load_mode_prompt(effective_mode)
            logger.info(f"Using mode: {effective_mode}")

            # Create options
            options = ClaudeAgentOptions(
                model=model_id,
                system_prompt=mode_system_prompt,
                max_turns=200,
                permission_mode="default",  # Use default mode - allows tool execution
                mcp_servers=mcp_config,
                allowed_tools=[
                    # Brave Search MCP server (single instance)
                    "mcp__brave-search__brave_web_search",
                    "mcp__brave-search__brave_local_search",
                    "mcp__brave-search__brave_video_search",
                    "mcp__brave-search__brave_image_search",
                    "mcp__brave-search__brave_news_search",
                    "mcp__brave-search__brave_summarizer",
                    # AWS Knowledge and Documentation servers
                    "mcp__aws-knowledge-mcp-server__aws___search_documentation",
                    "mcp__aws-knowledge-mcp-server__aws___read_documentation",
                    "mcp__aws-knowledge-mcp-server__aws___recommend",
                    "mcp__aws-knowledge-mcp-server__aws___get_regional_availability",
                    "mcp__aws-knowledge-mcp-server__aws___list_regions",
                    "mcp__awslabs.aws-documentation-mcp-server__search_documentation",
                    "mcp__awslabs.aws-documentation-mcp-server__get_documentation",
                    # Time server
                    "mcp__time-mcp-server__get_current_time",
                    "mcp__time-mcp-server__get_datetime",
                    "mcp__time-mcp-server__convert_time",
                    "mcp__time-mcp-server__get_current_unix_timestamp",
                    # Tavily search - correct tool names
                    "mcp__tavily-remote-mcp__tavily_search",
                    "mcp__tavily-remote-mcp__tavily_extract",
                    "mcp__tavily-remote-mcp__tavily_crawl",
                    # Built-in tools
                    "Task",
                    "TodoWrite",
                    "WebFetch",
                ],
            )

            converter = ContentBlockConverter()

            # Send message start
            yield json.dumps(
                {"event": {"messageStart": {"role": "assistant"}}}, ensure_ascii=False
            ) + "\n"

            # Stream from Claude Agent SDK
            async for message in query(prompt=full_prompt, options=options):
                for event in converter.convert_message_to_events(message):
                    yield json.dumps({"event": event}, ensure_ascii=False) + "\n"

            # Send message stop
            yield json.dumps(
                {"event": {"contentBlockStop": {"contentBlockIndex": converter.current_block_index}}},
                ensure_ascii=False,
            ) + "\n"

            yield json.dumps(
                {"event": {"messageStop": {"stopReason": "end_turn"}}}, ensure_ascii=False
            ) + "\n"

            yield json.dumps(
                {"event": {"metadata": {"usage": {
                    "inputTokens": converter.total_input_tokens,
                    "outputTokens": converter.total_output_tokens,
                    "totalTokens": converter.total_input_tokens + converter.total_output_tokens,
                }}}},
                ensure_ascii=False,
            ) + "\n"

        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)
            yield json.dumps(
                {"event": {"internalServerException": {"message": str(e)}}}, ensure_ascii=False
            ) + "\n"
