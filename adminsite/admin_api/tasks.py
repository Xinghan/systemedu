"""Background task executor for async AI generation.

Uses ThreadPoolExecutor instead of Celery — sufficient for low-traffic admin.
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

# Limit concurrent AI calls to avoid SQLite write contention and API rate limits
_executor = ThreadPoolExecutor(max_workers=2)


def run_generate_task(task_id):
    """Submit a generation task to the thread pool."""
    _executor.submit(_execute_generation, task_id)


def _execute_generation(task_id):
    """Execute the AI generation in a background thread.

    Marks task running -> calls generate_knowledge_tree -> stores result or error.
    """
    import django

    django.setup()

    from django.utils import timezone as tz

    from apps.projects.services import save_knowledge_tree

    from .models import GenerationTask
    from .services import generate_knowledge_tree

    try:
        task = GenerationTask.objects.get(pk=task_id)
    except GenerationTask.DoesNotExist:
        logger.error("GenerationTask %s not found", task_id)
        return

    # Mark running
    task.status = GenerationTask.Status.RUNNING
    task.started_at = tz.now()
    task.save(update_fields=["status", "started_at"])

    try:
        tree_data = generate_knowledge_tree(
            task.project,
            granularity=task.granularity,
            instructions=task.instructions,
        )

        # Auto-save generated tree to DB
        try:
            result = save_knowledge_tree(
                task.project, tree_data, replace=True
            )
            task.milestones_created = result["milestones_created"]
            task.knodes_created = result["knodes_created"]
        except Exception as save_err:
            logger.exception(
                "Generation task %s: tree generated but save failed", task_id
            )
            task.status = GenerationTask.Status.FAILED
            task.error_message = (
                f"Tree generated but save failed: {type(save_err).__name__}: {save_err}"
            )
            task.result_json = tree_data
            task.completed_at = tz.now()
            task.save(
                update_fields=[
                    "status",
                    "error_message",
                    "result_json",
                    "completed_at",
                ]
            )
            return

        task.status = GenerationTask.Status.COMPLETED
        task.result_json = tree_data
        task.completed_at = tz.now()
        task.save(
            update_fields=[
                "status",
                "result_json",
                "completed_at",
                "milestones_created",
                "knodes_created",
            ]
        )
    except Exception as e:
        logger.exception("Generation task %s failed", task_id)
        task.status = GenerationTask.Status.FAILED
        task.error_message = f"{type(e).__name__}: {e}"
        task.completed_at = tz.now()
        task.save(update_fields=["status", "error_message", "completed_at"])


def cleanup_stale_tasks():
    """Mark stale running tasks as failed (e.g., after server restart).

    Tasks stuck in 'running' for over 5 minutes are considered stale.
    """
    from .models import GenerationTask

    cutoff = timezone.now() - timedelta(minutes=5)
    stale = GenerationTask.objects.filter(
        status=GenerationTask.Status.RUNNING,
        started_at__lt=cutoff,
    )
    count = stale.update(
        status=GenerationTask.Status.FAILED,
        error_message="Task timed out (server may have restarted)",
        completed_at=timezone.now(),
    )
    if count:
        logger.warning("Cleaned up %d stale generation tasks", count)
    return count
