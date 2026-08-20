"""Tool management for the agent core runtime."""

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import boto3
from mcp import StdioServerParameters, stdio_client
from strands import tool
from strands.tools.mcp import MCPClient

from .config import WORKSPACE_DIR, get_aws_credentials, get_uv_environment

# Import strands-agents code interpreter tool
try:
    from strands_tools.code_interpreter import AgentCoreCodeInterpreter

    CODE_INTERPRETER_AVAILABLE = True
except ImportError as e:
    CODE_INTERPRETER_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"Strands code interpreter tool not available: {e}")
    AgentCoreCodeInterpreter = None

logger = logging.getLogger(__name__)

# Pinned for reproducible behavior. Check PyPI regularly for new stable versions.
MCP_PROXY_FOR_AWS_VERSION = "1.6.4"


def _create_mcp_client(server_name: str, server_config: dict, uv_env: dict) -> tuple[str, MCPClient | None]:
    """Create and start an MCP client (for parallel execution)"""
    try:
        client = MCPClient(
            lambda: stdio_client(
                StdioServerParameters(
                    command=server_config["command"],
                    args=server_config.get("args", []),
                    env={**uv_env, **server_config.get("env", {})},
                )
            )
        )
        client.start()
        return server_name, client
    except Exception as e:
        logger.error(f"Error creating MCP client for {server_name}: {e}")
        return server_name, None


class ToolManager:
    """Manages tools including MCP tools and built-in tools."""

    def __init__(self):
        self.mcp_tools = None
        self.session_id = None
        self.trace_id = None

    def set_session_info(self, session_id: str, trace_id: str):
        """Set session and trace IDs for tool operations"""
        self.session_id = session_id
        self.trace_id = trace_id

    def load_mcp_tools(self) -> list[Any]:
        """Load MCP tools from environment variable or mcp.json file"""
        if self.mcp_tools is not None:
            return self.mcp_tools

        try:
            # Log UV environment configuration
            uv_env = get_uv_environment()

            # Load from MCP_CONFIG_PATH
            mcp_config_path = os.environ.get("MCP_CONFIG_PATH")
            if mcp_config_path and os.path.exists(mcp_config_path):
                logger.info(f"Loading MCP configuration from {mcp_config_path}")
                with open(mcp_config_path) as f:
                    mcp_config = json.load(f)
                mcp_servers = mcp_config.get("mcpServers", {})
            else:
                return []

            mcp_clients = []

            with ThreadPoolExecutor() as executor:
                futures = [executor.submit(_create_mcp_client, name, config, uv_env) for name, config in mcp_servers.items()]
                for future in futures:
                    name, client = future.result()
                    if client:
                        mcp_clients.append(client)

            # Flatten the tools
            self.mcp_tools = sum([c.list_tools_sync() for c in mcp_clients], [])
            logger.info(f"Loaded {len(self.mcp_tools)} MCP tools")
            return self.mcp_tools

        except Exception as e:
            logger.error(f"Error loading MCP tools: {e}")
            self.mcp_tools = []
            return self.mcp_tools

    def load_mcp_tools_by_names(self, server_names: list[str]) -> list[Any]:
        """Load MCP tools from environment variable or mcp.json by server names"""
        if not server_names:
            return []

        try:
            # Log UV environment configuration
            uv_env = get_uv_environment()

            # Load from MCP_CONFIG_PATH
            mcp_config_path = os.environ.get("MCP_CONFIG_PATH")
            if mcp_config_path and os.path.exists(mcp_config_path):
                logger.info(f"Loading MCP configuration from {mcp_config_path}")
                with open(mcp_config_path) as f:
                    mcp_config = json.load(f)
                available_servers = mcp_config.get("mcpServers", {})
            else:
                return []

            logger.info(f"Found {len(available_servers)} available MCP servers")
            mcp_clients = []

            servers_to_load = {name: available_servers[name] for name in server_names if name in available_servers}

            with ThreadPoolExecutor() as executor:
                futures = [executor.submit(_create_mcp_client, name, config, uv_env) for name, config in servers_to_load.items()]
                for future in futures:
                    name, client = future.result()
                    if client:
                        mcp_clients.append(client)
                        logger.info(f"Successfully loaded MCP server: {name}")

            # Flatten the tools
            dynamic_tools = sum([c.list_tools_sync() for c in mcp_clients], [])
            logger.info(f"Loaded {len(dynamic_tools)} MCP tools from {len(mcp_clients)} servers")
            return dynamic_tools

        except Exception as e:
            logger.error(f"Error loading MCP tools by names: {e}")
            return []

    def get_upload_tool(self):
        """Get the S3 upload tool with session context"""
        trace_id = self.trace_id

        @tool
        def upload_file_to_s3_and_retrieve_s3_url(filepath: str) -> str:
            """Upload the file at /tmp/ws/* and retrieve the s3 path

            Args:
                filepath: The path to the uploading file
            """
            bucket = os.environ.get("FILE_BUCKET")
            if not bucket:
                # For local testing, provide a fallback message
                logger.warning("FILE_BUCKET environment variable not set. Using local file path for testing.")
                return f"Local file path (S3 upload skipped): {filepath}"

            aws_creds = get_aws_credentials()
            region = aws_creds.get("AWS_REGION", "us-east-1")

            if not filepath.startswith(WORKSPACE_DIR):
                raise ValueError(f"{filepath} does not appear to be a file under the {WORKSPACE_DIR} directory. Files to be uploaded must exist under {WORKSPACE_DIR}.")

            try:
                filename = os.path.basename(filepath)
                key = f"agentcore/{trace_id}/{filename}"

                s3 = boto3.client("s3", region_name=region)
                s3.upload_file(filepath, bucket, key)

                return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
            except Exception as e:
                logger.error(f"Error uploading file to S3: {e}")
                # For local testing, provide a fallback
                return f"Error uploading to S3: {str(e)}. Local file path: {filepath}"

        return upload_file_to_s3_and_retrieve_s3_url

    def get_code_interpreter_tool(self) -> list[Any]:
        """Get code interpreter tool if available"""
        code_interpreter_tools = []

        if CODE_INTERPRETER_AVAILABLE and AgentCoreCodeInterpreter:
            try:
                aws_creds = get_aws_credentials()
                region = aws_creds.get("AWS_REGION", "us-east-1")
                code_interpreter = AgentCoreCodeInterpreter(region=region)
                code_interpreter_tools.append(code_interpreter.code_interpreter)
                logger.info("Added code_interpreter tool (AgentCoreCodeInterpreter)")
            except Exception as e:
                logger.warning(f"Failed to initialize AgentCoreCodeInterpreter: {e}")

        return code_interpreter_tools

    def get_web_search_tools(self) -> list[Any]:
        """Get AgentCore Web Search tools through the Gateway connector.

        The Gateway URL is provided by the WEB_SEARCH_GATEWAY_URL environment
        variable. Requests are signed with SigV4 by mcp-proxy-for-aws using the
        credentials already present in the runtime environment.
        """
        gateway_url = os.environ.get("WEB_SEARCH_GATEWAY_URL", "").strip()
        if not gateway_url:
            logger.warning("WEB_SEARCH_GATEWAY_URL is not set, skipping web search tools")
            return []

        server_config = {
            "command": "uvx",
            "args": [f"mcp-proxy-for-aws@{MCP_PROXY_FOR_AWS_VERSION}", gateway_url],
        }

        _, client = _create_mcp_client("agentcore-web-search", server_config, get_uv_environment())
        if client is None:
            logger.warning("Failed to create MCP client for web search")
            return []

        try:
            web_search_tools = client.list_tools_sync()
            logger.info(f"Added {len(web_search_tools)} web search tools (AgentCore Web Search)")
            return web_search_tools
        except Exception as e:
            logger.warning(f"Failed to list web search tools: {e}")
            return []

    def get_tools_with_options(self, code_execution_enabled: bool = False, web_search_enabled: bool = False, mcp_servers=None) -> list[Any]:
        """
        Get tools with optional code execution and MCP servers.

        Args:
            code_execution_enabled: Whether to include code interpreter tools
            web_search_enabled: Whether to include AgentCore Web Search tools
            mcp_servers: MCP server configurations
                - None: Load default MCP servers from mcp.json
                - []: Empty list, no MCP servers (File Upload only)
                - [...]: Load specified MCP servers

        Returns:
            List of all available tools
        """
        logger.info(f"get_tools_with_options called with code_execution_enabled={code_execution_enabled}, web_search_enabled={web_search_enabled}")
        logger.info(f"mcp_servers parameter: {mcp_servers} (type: {type(mcp_servers)})")

        all_tools = []

        # Handle MCP servers based on parameter
        if mcp_servers is None:
            # Load default MCP servers from mcp.json
            logger.info("Loading default MCP servers from mcp.json")
            mcp_tools = self.load_mcp_tools()
        elif isinstance(mcp_servers, list) and len(mcp_servers) == 0:
            # Empty list: no MCP servers
            logger.info("Empty MCP servers list provided, skipping MCP tools")
            mcp_tools = []
        elif isinstance(mcp_servers, list):
            # Load specified MCP servers by name
            logger.info(f"Loading {len(mcp_servers)} user-specified MCP servers by name")
            mcp_tools = self.load_mcp_tools_by_names(mcp_servers)
        else:
            # Fallback to default
            logger.warning(f"Unexpected mcp_servers type: {type(mcp_servers)}, using default")
            mcp_tools = self.load_mcp_tools()

        all_tools.extend(mcp_tools)

        # Add built-in tools (always included)
        upload_tool = self.get_upload_tool()
        all_tools.append(upload_tool)

        # Add code interpreter tools if enabled
        code_interpreter_tools = []
        if code_execution_enabled:
            code_interpreter_tools = self.get_code_interpreter_tool()
            all_tools.extend(code_interpreter_tools)

        # Add web search tools if enabled
        web_search_tools = []
        if web_search_enabled:
            web_search_tools = self.get_web_search_tools()
            all_tools.extend(web_search_tools)

        # Log final tool count
        logger.info(
            f"Total tools loaded: {len(all_tools)} (MCP: {len(mcp_tools)}, Built-in: 1, "
            f"Code Interpreter: {len(code_interpreter_tools)} - {'enabled' if code_execution_enabled else 'disabled'}, "
            f"Web Search: {len(web_search_tools)} - {'enabled' if web_search_enabled else 'disabled'})"
        )

        return all_tools
