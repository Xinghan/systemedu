"""LangGraph state machine for the learning agent system."""

from langgraph.graph import END, StateGraph

from .state import LearningState
from .tutor import tutor_node


def build_learning_graph() -> StateGraph:
    """Build and compile the learning agent graph.

    Current flow: user message → tutor → response
    Future: router → tutor/assessor/planner/motivator → gap_detector → response
    """
    graph = StateGraph(LearningState)

    graph.add_node("tutor", tutor_node)

    graph.set_entry_point("tutor")
    graph.add_edge("tutor", END)

    return graph.compile()


# Singleton compiled graph
learning_graph = build_learning_graph()
