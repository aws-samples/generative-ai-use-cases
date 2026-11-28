"""What an agent remembers about a user, and who can reach it.

The tests that matter are the ones about whose memory a request touches: one
user's memory must not be read or deleted by another, nor carried from one
agent to another. AgentCore itself is replaced by a fake that keeps what it is
given.
"""

import asyncio
import threading
from datetime import UTC, datetime, timedelta

import pytest
from starlette.testclient import TestClient

import app as app_module
from src import memory

ME = "5704ea68-5021-70a5-cf9b-d6008ea5cbe1"
SOMEONE_ELSE = "11111111-2222-3333-4444-555555555555"
AGENT = "agent-1"
OTHER_AGENT = "agent-2"


class FakeAgentCore:
    """Keeps records by namespace, and events by actor and session."""

    def __init__(self):
        self.records = {}  # id -> record
        self.events = []  # (actor, session, payload)
        self.deleted = []

    def add(self, rid, namespace, text, created_at=None):
        self.records[rid] = {
            "memoryRecordId": rid,
            "content": {"text": text},
            "namespaces": [namespace],
            "createdAt": created_at or datetime(2026, 11, 1, tzinfo=UTC),
        }

    def _match(self, r, namespace=None, namespacePath=None):
        return any(ns == namespace or (namespacePath and ns.startswith(namespacePath)) for ns in r["namespaces"])

    def retrieve_memory_records(self, memoryId, searchCriteria, namespace=None, namespacePath=None):
        found = [r for r in self.records.values() if self._match(r, namespace, namespacePath)]
        return {"memoryRecordSummaries": found[: searchCriteria["topK"]]}

    def list_memory_records(self, memoryId, maxResults, namespace=None, namespacePath=None, nextToken=None):
        # Pages of maxResults, as AgentCore returns them
        found = [r for r in self.records.values() if self._match(r, namespace, namespacePath)]
        start = int(nextToken or 0)
        page = {"memoryRecordSummaries": found[start : start + maxResults]}
        if start + maxResults < len(found):
            page["nextToken"] = str(start + maxResults)
        return page

    def create_event(self, memoryId, actorId, sessionId, eventTimestamp, payload):
        self.events.append((actorId, sessionId, payload))

    def get_memory_record(self, memoryId, memoryRecordId):
        return {"memoryRecord": self.records[memoryRecordId]}

    def delete_memory_record(self, memoryId, memoryRecordId):
        self.deleted.append(memoryRecordId)
        self.records.pop(memoryRecordId)

    def batch_delete_memory_records(self, memoryId, records):
        for r in records:
            self.delete_memory_record(memoryId, r["memoryRecordId"])

    def list_sessions(self, memoryId, actorId, maxResults, nextToken=None):
        sessions = sorted({s for a, s, _ in self.events if a == actorId})
        return {"sessionSummaries": [{"sessionId": s, "actorId": actorId} for s in sessions]}

    def list_events(self, memoryId, actorId, sessionId, maxResults, nextToken=None):
        return {"events": [{"eventId": f"{i}#ab"} for i, (a, s, _) in enumerate(self.events) if a == actorId and s == sessionId]}

    def delete_event(self, memoryId, actorId, sessionId, eventId):
        index = int(eventId.split("#")[0])
        self.events[index] = (None, None, None)


@pytest.fixture
def agentcore(monkeypatch):
    fake = FakeAgentCore()
    monkeypatch.setattr(memory, "MEMORY_ID", "GenUAgentBuilderMemory-abcdefghij")
    monkeypatch.setattr(memory, "_client", fake)
    return fake


def facts_of(user, agent):
    return memory.namespace("facts", memory.actor_id(user, agent))


# ---------- whose memory ----------


def test_users_and_agents_get_actors_of_their_own():
    actors = {memory.actor_id(u, a) for u in (ME, SOMEONE_ELSE) for a in (AGENT, OTHER_AGENT)}
    assert len(actors) == 4


def test_an_actor_id_keeps_to_the_characters_agentcore_allows():
    actor = memory.actor_id("user@example.com", "agent:1/../x")
    assert all(c.isalnum() or c in "-_" for c in actor)


def test_a_session_id_is_cut_to_what_agentcore_allows():
    assert len(memory.session_id("x" * 300)) == 100


def test_recall_reads_only_the_callers_memory_of_this_agent(agentcore):
    for kind in ("facts", "preferences"):
        agentcore.add(f"mine-{kind}", memory.namespace(kind, memory.actor_id(ME, AGENT)), f"My {kind} for the billing system")
        agentcore.add(f"other-user-{kind}", memory.namespace(kind, memory.actor_id(SOMEONE_ELSE, AGENT)), f"Someone else's {kind}")
        agentcore.add(f"other-agent-{kind}", memory.namespace(kind, memory.actor_id(ME, OTHER_AGENT)), f"{kind} told to another agent")
    recalled = memory.recall(ME, AGENT, "billing")
    everything = recalled.standing + recalled.for_request
    assert "My facts" in everything and "My preferences" in everything
    assert "Someone else" not in everything
    assert "another agent" not in everything


def test_an_unidentified_caller_has_no_memory(agentcore):
    agentcore.add("mine", facts_of(ME, AGENT), "A fact")
    assert memory.recall(None, AGENT, "anything") == memory.Recalled()
    memory.remember(None, AGENT, "s1", "hello", "hi")
    assert agentcore.events == []
    assert "error" in memory.handle_action("list", None, AGENT)


def test_memory_off_does_nothing(monkeypatch):
    monkeypatch.setattr(memory, "MEMORY_ID", "")
    assert memory.recall(ME, AGENT, "anything") == memory.Recalled()
    assert "error" in memory.handle_action("list", ME, AGENT)


# ---------- during a conversation ----------


def add_one_of_each(agentcore):
    actor = memory.actor_id(ME, AGENT)
    agentcore.add("f", memory.namespace("facts", actor), "Works in the settlement team")
    agentcore.add("p", memory.namespace("preferences", actor), "Prefers answers as tables")
    agentcore.add("s", memory.namespace("summaries", actor, "s1"), "Discussed the start-up cost settlement")


def test_preferences_go_to_the_system_prompt_and_the_rest_with_the_request(agentcore):
    add_one_of_each(agentcore)
    recalled = memory.recall(ME, AGENT, "settlement")
    assert "Prefers answers as tables" in recalled.standing
    assert "settlement team" not in recalled.standing
    assert "Works in the settlement team" in recalled.for_request
    assert "start-up cost settlement" in recalled.for_request
    assert "Prefers answers as tables" not in recalled.for_request


def test_the_system_prompt_part_is_the_same_whatever_is_asked(agentcore):
    # The system prompt is cached. If what goes into it followed the request,
    # every turn would write the cache again instead of reading it.
    add_one_of_each(agentcore)
    actor = memory.actor_id(ME, AGENT)
    agentcore.add("p2", memory.namespace("preferences", actor), "Wants the conclusion first")
    first = memory.recall(ME, AGENT, "settlement")
    second = memory.recall(ME, AGENT, "how do I reverse a list in Python")
    assert first.standing == second.standing
    assert "Wants the conclusion first" in first.standing


def test_what_was_recalled_for_the_request_goes_in_front_of_the_message():
    assert memory.with_recalled("What is due?", "<remembered>x</remembered>") == "<remembered>x</remembered>\n\nWhat is due?"
    blocks = [{"text": "What is due?"}, {"image": {"format": "png"}}]
    assert memory.with_recalled(blocks, "<remembered>x</remembered>") == [{"text": "<remembered>x</remembered>"}, *blocks]
    assert memory.with_recalled("What is due?", "") == "What is due?"


def test_the_kinds_are_read_at_the_same_time(agentcore, monkeypatch):
    # Each call waits until all three have started. Made one after another,
    # the first would time out and nothing would be recalled.
    barrier = threading.Barrier(len(memory.KINDS), timeout=2)

    def waiting(call):
        def wrapped(**kwargs):
            barrier.wait()
            return call(**kwargs)

        return wrapped

    monkeypatch.setattr(agentcore, "retrieve_memory_records", waiting(agentcore.retrieve_memory_records))
    monkeypatch.setattr(agentcore, "list_memory_records", waiting(agentcore.list_memory_records))
    add_one_of_each(agentcore)
    recalled = memory.recall(ME, AGENT, "settlement")
    assert "settlement team" in recalled.for_request
    assert "Prefers answers as tables" in recalled.standing


def test_one_kind_failing_still_recalls_the_others(agentcore, monkeypatch):
    search = agentcore.retrieve_memory_records

    def facts_broken(**kwargs):
        if kwargs.get("namespace", "").startswith("/genu/facts/"):
            raise RuntimeError("throttled")
        return search(**kwargs)

    monkeypatch.setattr(agentcore, "retrieve_memory_records", facts_broken)
    add_one_of_each(agentcore)
    recalled = memory.recall(ME, AGENT, "anything")
    assert "Prefers answers as tables" in recalled.standing
    assert "start-up cost settlement" in recalled.for_request


def test_nothing_to_recall_adds_nothing(agentcore):
    assert memory.recall(ME, AGENT, "anything") == memory.Recalled()


def test_a_turn_is_recorded_as_the_users_and_the_agents_words(agentcore):
    memory.remember(ME, AGENT, "chat-1", "Please answer in tables", "Understood")
    actor, session, payload = agentcore.events[0]
    assert actor == memory.actor_id(ME, AGENT)
    assert session == "chat-1"
    assert [p["conversational"]["role"] for p in payload] == ["USER", "ASSISTANT"]


def test_a_long_turn_is_cut(agentcore):
    memory.remember(ME, AGENT, "chat-1", "x" * 20000, "")
    text = agentcore.events[0][2][0]["conversational"]["content"]["text"]
    assert len(text) == memory.MAX_EVENT_TEXT


def test_a_failure_to_recall_does_not_stop_the_answer(agentcore, monkeypatch):
    def broken(**kwargs):
        raise RuntimeError("throttled")

    monkeypatch.setattr(agentcore, "retrieve_memory_records", broken)
    monkeypatch.setattr(agentcore, "list_memory_records", broken)
    assert memory.recall(ME, AGENT, "anything") == memory.Recalled()


# ---------- the memory screen ----------


def test_list_shows_only_the_callers_memory(agentcore):
    agentcore.add("mine", facts_of(ME, AGENT), "Mine")
    agentcore.add("theirs", facts_of(SOMEONE_ELSE, AGENT), "Theirs")
    listed = memory.handle_action("list", ME, AGENT)["memories"]
    assert [x["text"] for x in listed["facts"]] == ["Mine"]


def test_a_user_cannot_delete_someone_elses_memory(agentcore):
    agentcore.add("theirs", facts_of(SOMEONE_ELSE, AGENT), "Theirs")
    assert memory.handle_action("delete", ME, AGENT, "theirs") == {"deleted": False}
    assert "theirs" in agentcore.records


def test_a_user_cannot_delete_their_memory_of_another_agent_through_this_one(agentcore):
    agentcore.add("other-agent", facts_of(ME, OTHER_AGENT), "Told to another agent")
    assert memory.handle_action("delete", ME, AGENT, "other-agent") == {"deleted": False}


def test_an_agent_whose_id_starts_like_another_does_not_reach_its_memory(agentcore):
    agentcore.add("agent-10", facts_of(ME, "agent-10"), "Told to agent-10")
    agentcore.add("agent-10-summary", memory.namespace("summaries", memory.actor_id(ME, "agent-10"), "s1"), "A summary for agent-10")
    assert memory.handle_action("delete", ME, "agent-1", "agent-10") == {"deleted": False}
    assert memory.handle_action("delete", ME, "agent-1", "agent-10-summary") == {"deleted": False}
    assert "agent-10" in agentcore.records


def test_a_user_can_delete_their_own_memory(agentcore):
    agentcore.add("mine", facts_of(ME, AGENT), "Mine")
    assert memory.handle_action("delete", ME, AGENT, "mine") == {"deleted": True}
    assert "mine" not in agentcore.records


def test_delete_all_forgets_memories_and_recorded_turns_of_this_agent_only(agentcore):
    agentcore.add("mine", facts_of(ME, AGENT), "Mine")
    agentcore.add("other-agent", facts_of(ME, OTHER_AGENT), "Other agent")
    memory.remember(ME, AGENT, "chat-1", "hello", "hi")
    memory.remember(ME, OTHER_AGENT, "chat-2", "hello", "hi")
    result = memory.handle_action("delete_all", ME, AGENT)["deleted"]
    assert result == {"records": 1, "events": 1}
    assert "other-agent" in agentcore.records
    assert agentcore.events[1][0] == memory.actor_id(ME, OTHER_AGENT)


# ---------- through the endpoint ----------


def test_the_endpoint_answers_memory_requests_for_the_verified_caller(agentcore, monkeypatch):
    agentcore.add("mine", facts_of(ME, AGENT), "Mine")
    agentcore.add("theirs", facts_of(SOMEONE_ELSE, AGENT), "Theirs")
    monkeypatch.setattr(app_module, "runtime_config", lambda: {"userPoolId": "pool", "userPoolClientId": "client"})
    monkeypatch.setattr(app_module, "verified_user_sub", lambda token, pool, client: ME if token == "my-id-token" else None)
    # The browser may claim to be someone else; the verified id token decides.
    r = TestClient(app_module.app).post(
        "/invocations",
        json={"memory_action": "list", "agent_id": AGENT, "user_id": SOMEONE_ELSE, "id_token": "my-id-token"},
    )
    assert [x["text"] for x in r.json()["memories"]["facts"]] == ["Mine"]


def test_the_endpoint_refuses_memory_requests_it_cannot_verify(agentcore, monkeypatch):
    agentcore.add("mine", facts_of(ME, AGENT), "Mine")
    monkeypatch.setattr(app_module, "runtime_config", lambda: {"userPoolId": "pool", "userPoolClientId": "client"})
    monkeypatch.setattr(app_module, "verified_user_sub", lambda token, pool, client: None)
    r = TestClient(app_module.app).post(
        "/invocations",
        json={"memory_action": "list", "agent_id": AGENT, "user_id": ME, "id_token": "forged"},
    )
    assert "memories" not in r.json()
    assert "Unauthorized" in r.text


def test_memory_enabled_reaches_the_agent(monkeypatch):
    seen = {}

    async def capture(**kwargs):
        seen.update(kwargs)
        yield '{"event": {}}\n'

    monkeypatch.setattr(app_module.agent_manager, "process_request_streaming", capture)
    TestClient(app_module.app).post(
        "/invocations",
        json={"model": {"modelId": "m"}, "prompt": [{"text": "hi"}], "memory_enabled": True},
    )
    assert seen["memory_enabled"] is True


# ---------- in the agent ----------


def test_the_agent_puts_each_part_where_it_belongs_and_remembers_only_what_the_user_wrote(agentcore, monkeypatch):
    from src import agent as agent_module

    seen = {}

    class FakeStrandsAgent:
        def __init__(self, system_prompt, messages, model, tools, callback_handler, hooks=None):
            seen["system_prompt"] = system_prompt

        async def stream_async(self, prompt):
            seen["prompt"] = prompt
            yield {"event": {"contentBlockDelta": {"delta": {"text": "Due on the 5th."}}}}

    monkeypatch.setattr(agent_module, "StrandsAgent", FakeStrandsAgent)
    monkeypatch.setattr(agent_module, "BedrockModel", lambda **kwargs: None)
    monkeypatch.setattr(memory, "recall", lambda *a: memory.Recalled("## The user's preferences\n- Tables", "<remembered>Works in accounting</remembered>"))
    remembered = []
    monkeypatch.setattr(memory, "remember", lambda *a: remembered.append(a))

    manager = agent_module.AgentManager()
    monkeypatch.setattr(manager.tool_manager, "get_tools_with_options", lambda **kwargs: [])

    async def run():
        async for _ in manager.process_request_streaming(
            messages=[],
            system_prompt="You help with expenses.",
            prompt="When is the deadline?",
            model_info={"modelId": "m", "region": "ap-northeast-1"},
            user_sub=ME,
            session_id="s1",
            agent_id=AGENT,
            memory_enabled=True,
        ):
            pass

    asyncio.run(run())
    assert seen["system_prompt"].endswith("## The user's preferences\n- Tables")
    assert "Works in accounting" not in seen["system_prompt"]
    assert seen["prompt"] == "<remembered>Works in accounting</remembered>\n\nWhen is the deadline?"
    assert remembered[0][3] == "When is the deadline?"


def test_the_memory_screen_shows_a_preference_and_a_summary_as_text():
    preference = '{"context":"questions","preference":"Answer in bullet points","categories":["format"]}'
    assert memory._readable("preferences", preference) == "Answer in bullet points"
    summary = '<topic name="Profile">\n- Name is Yamada\n</topic>\n\n\n<topic name="Format">\n- Bullets\n</topic>'
    assert memory._readable("summaries", summary) == "- Name is Yamada\n\n- Bullets"
    assert memory._readable("facts", "<b>kept</b>") == "<b>kept</b>"
    assert memory._readable("preferences", "not json") == "not json"


def test_the_screen_lists_the_newest_and_delete_all_removes_every_record(agentcore):
    # More than one page, and more than the screen lists
    for i in range(250):
        agentcore.add(f"f{i}", facts_of(ME, AGENT), f"fact {i}", datetime(2026, 1, 1, tzinfo=UTC) + timedelta(minutes=i))
    listed = memory.list_memories(ME, AGENT)["facts"]
    assert len(listed) == memory.LIST_LIMIT
    assert listed[0]["text"] == "fact 249"
    assert listed[-1]["text"] == f"fact {250 - memory.LIST_LIMIT}"

    result = memory.delete_all(ME, AGENT)
    assert result["records"] == 250
    assert memory.list_memories(ME, AGENT)["facts"] == []
