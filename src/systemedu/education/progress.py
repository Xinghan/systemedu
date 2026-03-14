"""Learning progress tracking (migrated from backend/apps/progress/)."""

from .models import KnowledgeTree, NodeStatus, UserNodeProgress


def initialize_progress(tree: KnowledgeTree) -> list[UserNodeProgress]:
    """Create initial progress records for all nodes in a knowledge tree.

    Unlocks nodes in the first milestone that have no prerequisites.
    """
    progresses = []
    first_milestone = tree.milestones[0] if tree.milestones else None

    global_idx = 0
    for ms in tree.milestones:
        for knode in ms.knodes:
            status = NodeStatus.LOCKED
            if (
                ms == first_milestone
                and not knode.prerequisite_indices
            ):
                status = NodeStatus.AVAILABLE

            progresses.append(
                UserNodeProgress(
                    knode_id=global_idx,
                    status=status,
                )
            )
            global_idx += 1

    return progresses


def unlock_next_nodes(
    tree: KnowledgeTree,
    progresses: list[UserNodeProgress],
    completed_node_id: int,
) -> list[int]:
    """Unlock nodes whose prerequisites are all completed.

    Returns list of newly unlocked node indices.
    """
    # Flatten all nodes
    all_nodes = []
    for ms in tree.milestones:
        all_nodes.extend(ms.knodes)

    # Build progress lookup
    status_map = {p.knode_id: p.status for p in progresses}
    status_map[completed_node_id] = NodeStatus.PASSED

    unlocked = []
    for idx, node in enumerate(all_nodes):
        if status_map.get(idx) != NodeStatus.LOCKED:
            continue

        # Check if all prerequisites are passed
        if all(
            status_map.get(pi) == NodeStatus.PASSED
            for pi in node.prerequisite_indices
        ):
            # Find the progress record and unlock it
            for p in progresses:
                if p.knode_id == idx:
                    p.status = NodeStatus.AVAILABLE
                    unlocked.append(idx)
                    break

    return unlocked
