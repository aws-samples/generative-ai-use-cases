# Use ARM64 base image for Bedrock AgentCore compatibility.
# Amazon Linux 2023 provides a snapshot-safe OpenSSL, which AgentCore Runtime
# platform version V2 needs: it starts every session from a snapshot of the
# running agent, and this OpenSSL reseeds its random state after a restore.
FROM --platform=linux/arm64 public.ecr.aws/amazonlinux/amazonlinux:2023

WORKDIR /var/task

# Environment variables for UV package manager
ENV UV_NO_CACHE=1
ENV UV_NO_MANAGED_PYTHON=1
ENV UV_PYTHON=/usr/bin/python3.13
ENV UV_INSTALL_DIR=/usr/local/bin
ENV UV_PROJECT_ENVIRONMENT=/tmp/.venv

# Install system dependencies
# Python and Node.js from Amazon Linux use the system OpenSSL
# (uv must not download its own Python, which bundles another OpenSSL)
RUN dnf swap -y openssl-libs openssl-snapsafe-libs \
    && dnf install -y python3.13 nodejs22 nodejs22-npm graphviz tar gzip \
    && dnf clean all
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Pre-install mcp-remote for faster startup
RUN npm install -g mcp-remote

# Pre-install mcp-proxy-for-aws so it works without runtime PyPI access
# (required for closed network mode where the runtime VPC has no internet egress).
# The binary is placed on PATH (/usr/local/bin) and mcp.json calls it directly.
# `uvx` would not find it: the runtime starts MCP servers with its own UV_TOOL_DIR
# (see get_uv_environment), so uvx would download the package again.
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
