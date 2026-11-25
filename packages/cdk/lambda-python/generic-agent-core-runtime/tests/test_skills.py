"""Skills sent with a request become Strands skills of the agent."""

import boto3
from strands import Agent
from strands.models import BedrockModel

from src.skills import skills_plugins, to_skills


def skill(name, description="Use it.", instructions="Do it."):
    return {"name": name, "description": description, "instructions": instructions}


def test_builds_a_skill_for_each_item():
    skills = to_skills([skill("weekly-report", "Write the weekly report.", "1. Collect\n2. Write")])

    assert len(skills) == 1
    assert skills[0].name == "weekly-report"
    assert skills[0].description == "Write the weekly report."
    assert skills[0].instructions == "1. Collect\n2. Write"
    assert skills[0].path is None


def test_leaves_out_malformed_items():
    items = [
        "./skills/weekly-report",  # a path or a URL must not be read
        "https://example.com/SKILL.md",
        {"name": "no-instructions", "description": "Use it."},
        {"name": "", "description": "Use it.", "instructions": "Do it."},
        {"name": "not-text", "description": "Use it.", "instructions": 1},
        skill("kept"),
    ]

    assert [s.name for s in to_skills(items)] == ["kept"]


def test_keeps_the_first_of_two_skills_with_the_same_name():
    skills = to_skills([skill("report", instructions="first"), skill("report", instructions="second")])

    assert [s.instructions for s in skills] == ["first"]


def test_no_skills_without_a_list():
    assert to_skills(None) == []
    assert to_skills({"name": "report"}) == []
    assert skills_plugins([]) == []


def test_the_agent_gets_the_tool_that_loads_a_skill():
    model = BedrockModel(model_id="model", boto_session=boto3.Session(region_name="us-east-1"))

    with_skills = Agent(model=model, plugins=skills_plugins([skill("report")]))
    without = Agent(model=model, plugins=skills_plugins([]))

    assert "skills" in with_skills.tool_names
    assert "skills" not in without.tool_names
