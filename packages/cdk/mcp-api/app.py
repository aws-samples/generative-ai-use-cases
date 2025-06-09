import boto3
import json
import uvicorn
from strands.models import BedrockModel
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters
from fastapi import FastAPI, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List

UV_ENV = {
    'UV_NO_CACHE': '1',
    'UV_TOOL_DIR': '/tmp/tool',
    'HOME': '/tmp',
    'TMPDIR': '/tmp',
    'npm_config_cache': '/tmp/.npm',
    'XDG_CONFIG_HOME': '/tmp/.config',
    'XDG_CACHE_HOME': '/tmp/.cache',
    'XDG_DATA_HOME': '/tmp/.local/share',
}

def stream_chunk(text, trace):
    return json.dumps({ 'text': text, 'trace': trace}, ensure_ascii=False) + '\n'

def is_message(event):
    return 'message' in event

def is_assistant(event):
    return event['message']['role'] == 'assistant'

def extract_text(event):
    contents = event['message']['content']

    for c in contents:
        if 'text' in c:
            return c['text']
    return None

def extract_tool_use(event):
    contents = event['message']['content']

    for c in contents:
        if 'toolUse' in c:
            tool_use = c['toolUse']
            return {
                'name': tool_use['name'],
                'input': tool_use['input']
            }
    return None

def extract_tool_result(event):
    res = ''

    contents = event['message']['content']

    for c in contents:
        if 'toolResult' in c:
            res_contents = c['toolResult']['content']

            for t in res_contents:
                if 'text' in t:
                    res += t['text']
    return res

app = FastAPI()

# Shared MCP clients
app.mcp_tools = None

@app.get('/')
async def healthcheck():
    return Response(status_code=status.HTTP_200_OK)

class UnrecordedMessage(BaseModel):
    role: str
    content: str

class Model(BaseModel):
    modelId: str
    region: str

class StreamingRequest(BaseModel):
    systemPrompt: str
    userPrompt: str
    messages: List[UnrecordedMessage]
    model: Model

def convert_unrecorded_message_to_strands_messages(messages: List[UnrecordedMessage]):
    return list(map(lambda m: { 'role': m.role, 'content': [{ 'text': m.content }] }, messages))

def safe_parse_mcp_json():
    res = []

    with open('mcp.json', 'r') as f:
        mcp_json = json.loads(f.read())

        if 'mcpServers' not in mcp_json:
            raise Exception('mcpServers not defined in mcp.json')

        mcp_servers = mcp_json['mcpServers']
        mcp_server_names = mcp_servers.keys()

        for server_name in mcp_server_names:
            server = mcp_servers[server_name]
            res.append({
                'command': server['command'],
                'args': server['args'] if 'args' in server else [],
                'env': server['env'] if 'env' in server else {},
            })

    return res

def make_mcp_client(server):
    def spawn():
        return stdio_client(
            StdioServerParameters(
                command=server['command'],
                args=server['args'],
                env={
                    **server['env'],
                    **UV_ENV,
                },
            )
        )
    return MCPClient(spawn)

def load_mcp_tools():
    mcp_servers = safe_parse_mcp_json()
    mcp_clients = [make_mcp_client(s) for s in mcp_servers]

    for c in mcp_clients:
        c.start()

    # Flatten the tools
    mcp_tools = sum([c.list_tools_sync() for c in mcp_clients], [])

    app.mcp_tools = mcp_tools

@app.post('/streaming')
async def streaming(request: StreamingRequest):
    if app.mcp_tools is None:
        load_mcp_tools()

    async def generate():
        session = boto3.Session(
            region_name=request.model.region,
        )

        bedrock_model = BedrockModel(
            model_id=request.model.modelId,
            boto_session=session
        )

        agent = Agent(
            system_prompt=request.systemPrompt,
            messages=convert_unrecorded_message_to_strands_messages(request.messages),
            model=bedrock_model,
            tools=app.mcp_tools,
            callback_handler=None,
        )

        async for event in agent.stream_async(request.userPrompt):
            if is_message(event):
                if is_assistant(event):
                    text = extract_text(event)
                    tool_use = extract_tool_use(event)

                    if text is not None and tool_use is not None:
                        yield stream_chunk('', f'{text}\n')
                        yield stream_chunk('', f'```\n{tool_use["name"]}: {tool_use["input"]}\n```\n')
                    elif text is not None:
                        yield stream_chunk(text, None)
                    else:
                        yield stream_chunk('', f'```\n{tool_use["name"]}: {tool_use["input"]}\n```\n')
                else:
                    tool_result = extract_tool_result(event)
                    if len(tool_result) > 200:
                        tool_result = tool_result[:200] + '...'
                    yield stream_chunk('', f'```\n{tool_result}\n```\n')

    return StreamingResponse(
        generate(),
        media_type='text/event-stream',
    )

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8080)
