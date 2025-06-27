FROM public.ecr.aws/docker/library/python:3.13

WORKDIR /var/task

RUN mkdir -p /opt/extensions
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

ENV UV_NO_CACHE=1
ENV UV_NO_MANAGED_PYTHON=1
ENV UV_PYTHON=/usr/local/bin/python
ENV UV_INSTALL_DIR=/usr/local/bin
ENV UV_PROJECT_ENVIRONMENT=/tmp/.venv

RUN apt-get update -y && apt-get install curl nodejs npm graphviz -y
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

COPY pyproject.toml .python-version uv.lock ./

RUN uv sync

COPY app.py mcp.json ./

CMD ["uv", "run", "app.py"]
