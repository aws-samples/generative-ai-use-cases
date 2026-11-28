"""Agents search documents only through GenU's function, as the verified user (#1870)."""

import asyncio
import io
import json

from src import agent as agent_module
from src.config import DOCUMENT_SEARCH_SYSTEM_PROMPT
from src.document_search import make_document_search_tool

ARN = "arn:aws:lambda:ap-northeast-1:123456789012:function:AgentDocumentSearch"


class FakeLambda:
    def __init__(self, body, function_error=None):
        self.body = body
        self.function_error = function_error
        self.calls = []

    def invoke(self, FunctionName, Payload):
        self.calls.append((FunctionName, json.loads(Payload)))
        response = {"Payload": io.BytesIO(json.dumps(self.body).encode())}
        if self.function_error:
            response["FunctionError"] = self.function_error
        return response


def search(client, **kwargs):
    return make_document_search_tool(ARN, "the-id-token", client=client)(**kwargs)


def test_searches_as_the_user_of_the_token():
    client = FakeLambda({"results": [{"title": "Rules", "url": "https://s3.ap-northeast-1.amazonaws.com/b/docs/rules.pdf", "text": "Expenses are..."}]})
    answer = search(client, query="expense rules", max_results=50)
    assert client.calls == [(ARN, {"idToken": "the-id-token", "query": "expense rules", "numberOfResults": 10})]
    assert json.loads(answer)[0]["title"] == "Rules"
    assert json.loads(answer)[0]["cite_as"] == "[Rules](https://s3.ap-northeast-1.amazonaws.com/b/docs/rules.pdf)"


def test_reports_what_the_function_refused():
    assert search(FakeLambda({"error": "Unauthorized"}), query="q") == "Document search failed: Unauthorized"
    assert search(FakeLambda({"errorMessage": "boom"}, function_error="Unhandled"), query="q") == "Document search failed"


def run_agent(monkeypatch, **kwargs):
    seen = {}

    class FakeStrandsAgent:
        def __init__(self, system_prompt, messages, model, tools, callback_handler, hooks=None):
            seen["system_prompt"] = system_prompt
            seen["tools"] = [getattr(t, "tool_name", None) for t in tools]

        async def stream_async(self, prompt):
            yield {"event": {"contentBlockDelta": {"delta": {"text": "ok"}}}}

    monkeypatch.setattr(agent_module, "StrandsAgent", FakeStrandsAgent)
    monkeypatch.setattr(agent_module, "BedrockModel", lambda **kw: None)
    manager = agent_module.AgentManager()
    monkeypatch.setattr(manager.tool_manager, "get_tools_with_options", lambda **kw: [])

    async def run():
        async for _ in manager.process_request_streaming(messages=[], system_prompt="Help.", prompt="hi", model_info={"modelId": "m", "region": "ap-northeast-1"}, **kwargs):
            pass

    asyncio.run(run())
    return seen


def test_the_agent_gets_the_tool_and_the_prompt_when_everything_is_there(monkeypatch):
    seen = run_agent(monkeypatch, document_search_enabled=True, id_token="t", file_config={"documentSearchFunction": ARN})
    assert seen["tools"] == ["search_documents"]
    assert DOCUMENT_SEARCH_SYSTEM_PROMPT in seen["system_prompt"]


def test_no_tool_without_a_verified_token_or_a_search_function(monkeypatch):
    for kwargs in (
        {"document_search_enabled": True, "id_token": None, "file_config": {"documentSearchFunction": ARN}},
        {"document_search_enabled": True, "id_token": "t", "file_config": {}},
        {"document_search_enabled": False, "id_token": "t", "file_config": {"documentSearchFunction": ARN}},
    ):
        seen = run_agent(monkeypatch, **kwargs)
        assert seen["tools"] == []
        assert DOCUMENT_SEARCH_SYSTEM_PROMPT not in seen["system_prompt"]


def test_the_endpoint_passes_on_the_token_it_verified(monkeypatch):
    from starlette.testclient import TestClient

    import app as app_module

    seen = {}

    async def capture(**kwargs):
        seen.update(kwargs)
        yield '{"event": {}}\n'

    monkeypatch.setattr(app_module.agent_manager, "process_request_streaming", capture)
    monkeypatch.setattr(app_module, "runtime_config", lambda: {"userPoolId": "p", "userPoolClientId": "c", "documentSearchFunction": ARN})
    monkeypatch.setattr(app_module, "verified_user_sub", lambda token, pool, client: "user-1" if token == "good" else None)
    body = {"model": {"modelId": "m"}, "prompt": [{"text": "hi"}], "document_search_enabled": True}

    TestClient(app_module.app).post("/invocations", json={**body, "id_token": "good"})
    assert seen["id_token"] == "good"
    assert seen["document_search_enabled"] is True

    seen.clear()
    response = TestClient(app_module.app).post("/invocations", json={**body, "id_token": "forged"})
    assert seen == {}
    assert "Unauthorized" in response.text
