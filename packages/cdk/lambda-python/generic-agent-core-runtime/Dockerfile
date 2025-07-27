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

# Copy dependency files
COPY pyproject.toml .python-version uv.lock ./

# Install Python dependencies
RUN uv sync

# Copy application files
COPY app.py mcp.json ./

# Expose port 8080 as required by AgentCore
EXPOSE 8080

# Start the application with OpenTelemetry instrumentation
CMD ["uv", "run", "opentelemetry-instrument", "python", "app.py"]
