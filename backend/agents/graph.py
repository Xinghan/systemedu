"""LangGraph state machine for the learning agent system."""

import logging

from langgraph.graph import END, StateGraph

from .state import LearningState
from .tutor import tutor_node

logger = logging.getLogger(__name__)


def retrieve_memory_node(state: LearningState) -> LearningState:
    """LangGraph node: Retrieve relevant memories before tutoring."""
    from .memory import retrieve_memories

    try:
        last_message = state["messages"][-1].content if state["messages"] else ""
        memories = retrieve_memories(
            user_id=state["user_id"],
            query=last_message,
            project_id=state["project_id"],
            limit=5,
        )
        memory_context = "\n".join(f"- {m}" for m in memories) if memories else ""
    except Exception:
        logger.exception("Failed to retrieve memories")
        memory_context = ""

    return {**state, "memory_context": memory_context}


def store_memory_node(state: LearningState) -> LearningState:
    """LangGraph node: Store conversation in Mem0 after tutoring."""
    from .memory import store_conversation

    try:
        # Build conversation in Mem0 format (last user msg + AI response)
        msgs = state["messages"]
        conversation = []
        if len(msgs) >= 2:
            conversation.append({"role": "user", "content": msgs[-2].content})
            conversation.append({"role": "assistant", "content": msgs[-1].content})
        elif len(msgs) == 1:
            conversation.append({"role": "assistant", "content": msgs[-1].content})

        if conversation:
            store_conversation(
                user_id=state["user_id"],
                messages=conversation,
                project_id=state["project_id"],
                knode_id=state["knode_id"] if state["knode_id"] else None,
            )
    except Exception:
        logger.exception("Failed to store memories")

    return state


def build_learning_graph() -> StateGraph:
    """Build and compile the learning agent graph.

    Flow: retrieve_memory → tutor → store_memory → END
    """
    graph = StateGraph(LearningState)

    graph.add_node("retrieve_memory", retrieve_memory_node)
    graph.add_node("tutor", tutor_node)
    graph.add_node("store_memory", store_memory_node)

    graph.set_entry_point("retrieve_memory")
    graph.add_edge("retrieve_memory", "tutor")
    graph.add_edge("tutor", "store_memory")
    graph.add_edge("store_memory", END)

    return graph.compile()


# Singleton compiled graph
learning_graph = build_learning_graph()
