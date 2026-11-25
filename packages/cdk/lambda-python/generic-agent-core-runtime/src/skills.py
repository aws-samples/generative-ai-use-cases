"""Skills of an Agent Builder agent.

The web client reads the skills of the agent through the API and sends their
contents with each request. The agent sees the name and the description of
each skill in its system prompt, and loads the instructions of a skill with
the ``skills`` tool when a task needs them.
"""

import logging
from typing import Any

from strands.vended_plugins.skills import AgentSkills, Skill

logger = logging.getLogger(__name__)


def to_skills(items: Any) -> list[Skill]:
    """Build skills from the request, leaving out malformed ones.

    Only ``Skill`` objects are built: AgentSkills reads a string as a path or
    a URL, which a request must not be able to make it do.
    """
    if not isinstance(items, list):
        return []

    skills: dict[str, Skill] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        description = item.get("description")
        instructions = item.get("instructions")
        if not all(isinstance(v, str) and v for v in (name, description, instructions)):
            logger.warning("Skipping a malformed skill")
            continue
        if name in skills:
            logger.warning(f"Skipping a second skill named {name}")
            continue
        skills[name] = Skill(name=name, description=description, instructions=instructions)
    return list(skills.values())


def skills_plugins(items: Any) -> list[AgentSkills]:
    """The plugins giving the agent its skills, none when it has no skills."""
    skills = to_skills(items)
    if not skills:
        return []
    logger.info(f"Loaded {len(skills)} skills")
    return [AgentSkills(skills=skills)]
