"""What an Agent Builder agent remembers about a user, past one conversation.

Each conversation turn is recorded as an event in AgentCore Memory. From those
events AgentCore draws, in the background, three kinds of long-term memory:
facts the user stated, the user's preferences, and a summary of each
conversation. At the start of each turn they are read back for the model.

Where they go depends on whether they change with the request. Preferences do
not, so they are listed rather than searched and go into the system prompt,
which then stays the same from one turn to the next and keeps its prompt
cache. Facts and summaries are searched with the request, so they differ every
turn; they go with the user's message instead, after the cached part.

Memory belongs to one user of one agent. The actor is built from the subject
of the caller's verified token and the agent id, so a request can neither read
nor delete another user's memory, nor carry what a user told one agent into
another. A caller the runtime could not identify has no memory at all, rather
than sharing one with everybody else.

The namespaces match AGENT_MEMORY_NAMESPACES in generic-agent-core.ts, where
the strategies are created.
"""

from __future__ import annotations

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import boto3

logger = logging.getLogger(__name__)

MEMORY_ID = os.environ.get("AGENT_MEMORY_ID", "")
KINDS = ("facts", "preferences", "summaries")
RECALL_TOP_K = {"facts": 5, "summaries": 3}
# The newest preferences that go into the system prompt.
STANDING_PREFERENCES = 10
# An event's text is cut to this length: a long answer is still remembered by
# its opening, and a pasted document does not fill the memory.
MAX_EVENT_TEXT = 8000
LIST_LIMIT = 200

_client = None


def enabled() -> bool:
    return bool(MEMORY_ID)


def _agentcore():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-agentcore", region_name=os.environ.get("AWS_REGION"))
    return _client


def _safe(value: str, limit: int) -> str:
    """Letters, digits, hyphens and underscores: what actor and session ids allow."""
    return re.sub(r"[^a-zA-Z0-9_-]", "-", value)[:limit].strip("-") or "unknown"


def actor_id(user_sub: str, agent_id: str) -> str:
    """One user of one agent."""
    return _safe(f"u-{user_sub}_a-{agent_id}", 255)


def session_id(value: str | None) -> str:
    return _safe(value or "default", 100)


def namespace(kind: str, actor: str, session: str | None = None) -> str:
    if kind == "summaries":
        return f"/genu/summaries/{actor}/{session}" if session else f"/genu/summaries/{actor}/"
    return f"/genu/{kind}/{actor}"


def _text(record: dict) -> str:
    content = record.get("content") or {}
    return content.get("text", "") if isinstance(content, dict) else str(content)


def _readable(kind: str, text: str) -> str:
    """A record as the memory screen shows it.

    AgentCore stores a preference as JSON and a summary with XML-like topic
    tags; the screen shows the preference itself and the summary without
    the tags. What the agent recalls is left as stored.
    """
    if kind == "preferences":
        try:
            parsed = json.loads(text)
        except ValueError:
            return text
        if isinstance(parsed, dict) and isinstance(parsed.get("preference"), str):
            return parsed["preference"]
        return text
    if kind == "summaries":
        without_tags = re.sub(r"</?[A-Za-z][^>]*>", "", text)
        return re.sub(r"\n\s*\n+", "\n\n", without_tags).strip()
    return text


def _owns(record: dict, actor: str) -> bool:
    """Whether a record is filed under this actor (checked before deleting it).

    The actor has to be a whole part of the namespace: as a substring,
    u-x_a-agent-1 would also own the records of u-x_a-agent-10.
    """
    return any(actor in ns.split("/") for ns in record.get("namespaces", []))


# ---------- during a conversation ----------


@dataclass(frozen=True)
class Recalled:
    """What to hand the model: for the system prompt, and for this request."""

    standing: str = ""
    for_request: str = ""


def recall(user_sub: str | None, agent_id: str | None, query: str) -> Recalled:
    """The user's preferences, and the facts and summaries that bear on this request.

    Empty when there is nothing to recall or memory cannot be used. Never raises:
    an answer without memory is better than no answer.
    """
    if not (enabled() and user_sub and agent_id and query.strip()):
        return Recalled()
    actor = actor_id(user_sub, agent_id)

    def preferences() -> list[str]:
        # Listed, oldest first, so that the same preferences give the same text
        # every turn. A search would rank them differently for each request.
        try:
            r = _agentcore().list_memory_records(memoryId=MEMORY_ID, namespace=namespace("preferences", actor), maxResults=100)
            records = sorted((x for x in r.get("memoryRecordSummaries", []) if _owns(x, actor)), key=lambda x: str(x.get("createdAt", "")))
            return [t for t in (_text(x) for x in records[-STANDING_PREFERENCES:]) if t]
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Could not recall preferences: {e}")
            return []

    def search(kind: str) -> list[str]:
        try:
            params: dict[str, Any] = {
                "memoryId": MEMORY_ID,
                "searchCriteria": {"searchQuery": query[:10000], "topK": RECALL_TOP_K[kind]},
            }
            if kind == "summaries":
                params["namespacePath"] = namespace(kind, actor)
            else:
                params["namespace"] = namespace(kind, actor)
            records = _agentcore().retrieve_memory_records(**params).get("memoryRecordSummaries", [])
            return [t for t in (_text(r) for r in records) if t]
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Could not recall {kind}: {e}")
            return []

    # The answer waits for this, and each call takes about 0.3 s, so the
    # three are made at the same time rather than one after another.
    with ThreadPoolExecutor(max_workers=len(KINDS)) as pool:
        prefs = pool.submit(preferences)
        facts = pool.submit(search, "facts")
        summaries = pool.submit(search, "summaries")
        found = {"preferences": prefs.result(), "facts": facts.result(), "summaries": summaries.result()}

    standing = ""
    if found["preferences"]:
        standing = "\n".join(
            [
                "## The user's preferences",
                "Learned from earlier conversations with this user, in this agent only. Follow them unless the user asks otherwise in this conversation.",
                *[f"- {t}" for t in found["preferences"]],
            ]
        )
    for_request = ""
    if found["facts"] or found["summaries"]:
        lines = [
            "<remembered>",
            "Added by the system, not written by the user: what you remember from earlier conversations with this user, in this agent only, that may bear on the message below. Use it when it helps; do not mention that you remember unless it is relevant. If the user corrects any of it, follow the correction.",
        ]
        if found["facts"]:
            lines += ["Facts the user told you:", *[f"- {t}" for t in found["facts"]]]
        if found["summaries"]:
            lines += ["Earlier conversations with this user:", *[f"- {t}" for t in found["summaries"]]]
        lines.append("</remembered>")
        for_request = "\n".join(lines)
    return Recalled(standing, for_request)


def with_recalled(prompt: str | list[Any], for_request: str) -> str | list[Any]:
    """The user's message with what was recalled for it put in front."""
    if not for_request:
        return prompt
    if isinstance(prompt, str):
        return f"{for_request}\n\n{prompt}"
    return [{"text": for_request}, *prompt]


def remember(user_sub: str | None, agent_id: str | None, session: str | None, user_text: str, assistant_text: str) -> None:
    """Record one turn. Long-term memories are drawn from it in the background."""
    if not (enabled() and user_sub and agent_id and user_text.strip()):
        return
    payload = [{"conversational": {"content": {"text": user_text[:MAX_EVENT_TEXT]}, "role": "USER"}}]
    if assistant_text.strip():
        payload.append({"conversational": {"content": {"text": assistant_text[:MAX_EVENT_TEXT]}, "role": "ASSISTANT"}})
    try:
        _agentcore().create_event(
            memoryId=MEMORY_ID,
            actorId=actor_id(user_sub, agent_id),
            sessionId=session_id(session),
            eventTimestamp=datetime.now(UTC),
            payload=payload,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Could not record the turn: {e}")


# ---------- the user's own view of their memory ----------


def _all_records(kind: str, actor: str) -> list[dict]:
    """Every record of one kind that this actor owns, in no particular order."""
    records, token = [], None
    while True:
        params: dict[str, Any] = {"memoryId": MEMORY_ID, "maxResults": 100}
        if kind == "summaries":
            params["namespacePath"] = namespace(kind, actor)
        else:
            params["namespace"] = namespace(kind, actor)
        if token:
            params["nextToken"] = token
        r = _agentcore().list_memory_records(**params)
        records += [x for x in r.get("memoryRecordSummaries", []) if _owns(x, actor)]
        token = r.get("nextToken")
        if not token:
            return records


def _created_at(record: dict) -> str:
    value = record.get("createdAt", "")
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def list_memories(user_sub: str, agent_id: str) -> dict[str, list[dict]]:
    """What this user's agent remembers, by kind, the newest LIST_LIMIT of each."""
    actor = actor_id(user_sub, agent_id)
    out: dict[str, list[dict]] = {}
    for kind in KINDS:
        # Sorted before it is cut, so that the newest are the ones shown
        records = sorted(_all_records(kind, actor), key=_created_at, reverse=True)[:LIST_LIMIT]
        out[kind] = [{"id": x["memoryRecordId"], "text": _readable(kind, _text(x)), "createdAt": _created_at(x)} for x in records]
    return out


def delete_memory(user_sub: str, agent_id: str, record_id: str) -> bool:
    """Delete one memory, only if it is this user's (of this agent)."""
    actor = actor_id(user_sub, agent_id)
    try:
        record = _agentcore().get_memory_record(memoryId=MEMORY_ID, memoryRecordId=record_id)["memoryRecord"]
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Memory record {record_id} not found: {e}")
        return False
    if not _owns(record, actor):
        logger.warning(f"Refused to delete memory record {record_id}: not the caller's")
        return False
    _agentcore().delete_memory_record(memoryId=MEMORY_ID, memoryRecordId=record_id)
    return True


def delete_all(user_sub: str, agent_id: str) -> dict[str, int]:
    """Forget everything about this user in this agent: long-term memories and the recorded turns."""
    actor = actor_id(user_sub, agent_id)
    # Every record, not only those the screen lists
    ids = [x["memoryRecordId"] for kind in KINDS for x in _all_records(kind, actor)]
    for i in range(0, len(ids), 100):
        _agentcore().batch_delete_memory_records(memoryId=MEMORY_ID, records=[{"memoryRecordId": rid} for rid in ids[i : i + 100]])
    events = 0
    token = None
    while True:
        params: dict[str, Any] = {"memoryId": MEMORY_ID, "actorId": actor, "maxResults": 100}
        if token:
            params["nextToken"] = token
        r = _agentcore().list_sessions(**params)
        for s in r.get("sessionSummaries", []):
            ev_token = None
            while True:
                ep: dict[str, Any] = {"memoryId": MEMORY_ID, "actorId": actor, "sessionId": s["sessionId"], "maxResults": 100}
                if ev_token:
                    ep["nextToken"] = ev_token
                er = _agentcore().list_events(**ep)
                for ev in er.get("events", []):
                    _agentcore().delete_event(memoryId=MEMORY_ID, actorId=actor, sessionId=s["sessionId"], eventId=ev["eventId"])
                    events += 1
                ev_token = er.get("nextToken")
                if not ev_token:
                    break
        token = r.get("nextToken")
        if not token:
            break
    return {"records": len(ids), "events": events}


def handle_action(action: str, user_sub: str | None, agent_id: str | None, record_id: str | None = None) -> dict:
    """The memory screen's requests: list, delete one, delete all."""
    if not enabled():
        return {"error": "Memory is not enabled"}
    if not user_sub:
        return {"error": "The caller could not be identified"}
    if not agent_id:
        return {"error": "agent_id is required"}
    if action == "list":
        return {"memories": list_memories(user_sub, agent_id)}
    if action == "delete":
        if not record_id:
            return {"error": "record_id is required"}
        return {"deleted": delete_memory(user_sub, agent_id, record_id)}
    if action == "delete_all":
        return {"deleted": delete_all(user_sub, agent_id)}
    return {"error": f"Unknown memory action: {action}"}
