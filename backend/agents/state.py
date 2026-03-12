"""Shared state definition for the LangGraph agent system."""

from typing import TypedDict

from langchain_core.messages import BaseMessage


class LearningState(TypedDict):
    """State shared across all agents in the learning graph."""

    user_id: int
    project_id: int
    knode_id: int
    user_age: int
    knode_title: str
    knode_summary: str
    messages: list[BaseMessage]
    response: str  # final response text
