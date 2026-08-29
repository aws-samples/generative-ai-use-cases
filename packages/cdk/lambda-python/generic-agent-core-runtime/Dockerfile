# Use ARM64 base image for Bedrock AgentCore compatibility
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13

WORKDIR /var/task

# Environment variables for UV package manager
ENV UV_NO_CACHE=1
ENV UV_NO_MANAGED_PYTHON=1
ENV UV_PYTHON=/usr/local/bin/python
ENV UV_INSTALL_DIR=/usr/local/bin
ENV UV_PROJECT_ENVIRONMENT=/tmp/.venv

# Install system dependencies
RUN apt-get update -y && apt-get install curl nodejs npm graphviz -y
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Pre-install mcp-remote for faster startup
RUN npm install -g mcp-remote

# Pre-install mcp-proxy-for-aws so it works without runtime PyPI access
# (required for closed network mode where the runtime VPC has no internet egress).
# UV_TOOL_BIN_DIR=/usr/local/bin places the binary on PATH so mcp.json can call
# `mcp-proxy-for-aws` directly without going through `uvx` (which would re-fetch
# from PyPI at every invocation due to UV_NO_CACHE=1).
RUN UV_TOOL_BIN_DIR=/usr/local/bin UV_TOOL_DIR=/usr/local/uv-tools uv tool install mcp-proxy-for-aws

# Copy dependency files
COPY pyproject.toml .python-version uv.lock ./
# Install Python dependencies
RUN uv sync

# Copy application files
COPY app.py ./
COPY src/ ./src/
COPY mcp-configs ./mcp-configs


# Expose port 8080 as required by AgentCore
EXPOSE 8080

# Start the application with OpenTelemetry instrumentation
CMD ["uv", "run", "opentelemetry-instrument", "python", "app.py"]
