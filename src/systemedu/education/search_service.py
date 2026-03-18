"""Resource search service using Tavily API."""

from datetime import datetime

from systemedu.core.config import get_config
from systemedu.storage.db import NodeResource, NodeSearchStatus, get_session


def _upsert_search_status(session, project_name: str, knode_id: int, status: str, error: str = "") -> NodeSearchStatus:
    row = session.query(NodeSearchStatus).filter_by(
        project_name=project_name, knode_id=knode_id
    ).first()
    if row is None:
        row = NodeSearchStatus(project_name=project_name, knode_id=knode_id)
        session.add(row)
    row.status = status
    row.error = error
    if status == "done":
        row.searched_at = datetime.now()
    session.commit()
    return row


def search_resources(project_name: str, knode_id: int, query: str) -> None:
    """Run Tavily search and persist results. Designed to run in a background thread."""
    config = get_config()
    api_key = config.search.tavily_api_key
    max_results = config.search.max_results_per_source

    session = get_session()
    try:
        _upsert_search_status(session, project_name, knode_id, "searching")

        try:
            from tavily import TavilyClient  # type: ignore

            client = TavilyClient(api_key=api_key)

            # Delete old unsaved resources for this node
            session.query(NodeResource).filter_by(
                project_name=project_name, knode_id=knode_id, saved=0
            ).delete()
            session.commit()

            now = datetime.now()

            # Web search
            web_result = client.search(query, max_results=max_results)
            web_resources = []
            for item in web_result.get("results", []):
                web_resources.append(NodeResource(
                    project_name=project_name,
                    knode_id=knode_id,
                    source_type="web",
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    snippet=item.get("content", ""),
                    score=float(item.get("score", 0.0)),
                    saved=0,
                    searched_at=now,
                ))

            # YouTube search
            yt_result = client.search(
                query,
                max_results=max_results,
                include_domains=["youtube.com"],
            )
            yt_resources = []
            for item in yt_result.get("results", []):
                yt_resources.append(NodeResource(
                    project_name=project_name,
                    knode_id=knode_id,
                    source_type="youtube",
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    snippet=item.get("content", ""),
                    score=float(item.get("score", 0.0)),
                    saved=0,
                    searched_at=now,
                ))

            session.add_all(web_resources + yt_resources)
            session.commit()

            _upsert_search_status(session, project_name, knode_id, "done")

        except Exception as exc:
            _upsert_search_status(session, project_name, knode_id, "failed", error=str(exc))
    finally:
        session.close()


def get_resources(project_name: str, knode_id: int) -> dict:
    """Return current search status + all resources for a node."""
    session = get_session()
    try:
        status_row = session.query(NodeSearchStatus).filter_by(
            project_name=project_name, knode_id=knode_id
        ).first()

        resources = (
            session.query(NodeResource)
            .filter_by(project_name=project_name, knode_id=knode_id)
            .order_by(NodeResource.score.desc())
            .all()
        )

        return {
            "status": status_row.status if status_row else "idle",
            "searched_at": status_row.searched_at.isoformat() if status_row and status_row.searched_at else None,
            "error": status_row.error if status_row else "",
            "resources": [
                {
                    "id": r.id,
                    "source_type": r.source_type,
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "score": r.score,
                    "saved": bool(r.saved),
                    "saved_at": r.saved_at.isoformat() if r.saved_at else None,
                }
                for r in resources
            ],
        }
    finally:
        session.close()


def toggle_resource_saved(resource_id: int, saved: bool) -> dict | None:
    """Toggle the saved flag on a resource. Returns updated dict or None if not found."""
    session = get_session()
    try:
        row = session.query(NodeResource).filter_by(id=resource_id).first()
        if row is None:
            return None
        row.saved = 1 if saved else 0
        row.saved_at = datetime.now() if saved else None
        session.commit()
        return {"id": row.id, "saved": bool(row.saved)}
    finally:
        session.close()
