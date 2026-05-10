"""Resource search service - delegates to SearchAgent."""

from datetime import datetime

from systemedu.core.agents.builtin.search_agent import SearchAgent
from systemedu.core.config import get_config
from systemedu.core.llm_client import get_llm
from systemedu.core.storage.db import NodeResource, NodeSearchStatus, get_session


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


def search_resources(
    project_name: str,
    knode_id: int,
    node_title: str,
    node_summary: str = "",
    difficulty: int = 5,
) -> None:
    """Run SearchAgent and persist results. Designed to run in a background thread."""
    config = get_config()
    api_key = config.search.tavily_api_key
    max_results = config.search.max_results_per_source

    session = get_session()
    try:
        _upsert_search_status(session, project_name, knode_id, "searching")

        try:
            llm = get_llm()
            agent = SearchAgent(llm=llm, tavily_api_key=api_key, max_results=max_results)

            result = agent.search(
                node_title=node_title,
                node_summary=node_summary,
                difficulty=difficulty,
            )

            if result is None:
                raise RuntimeError("SearchAgent returned no results")

            # Delete old unsaved resources for this node
            session.query(NodeResource).filter_by(
                project_name=project_name, knode_id=knode_id, saved=0
            ).delete()
            session.commit()

            now = datetime.now()
            resources = []

            for item in result.get("web_results", []):
                resources.append(NodeResource(
                    project_name=project_name,
                    knode_id=knode_id,
                    source_type="web",
                    title=item["title"],
                    url=item["url"],
                    snippet=item["snippet"],
                    score=item["score"],
                    saved=0,
                    searched_at=now,
                ))

            for item in result.get("youtube_results", []):
                resources.append(NodeResource(
                    project_name=project_name,
                    knode_id=knode_id,
                    source_type="youtube",
                    title=item["title"],
                    url=item["url"],
                    snippet=item["snippet"],
                    score=item["score"],
                    saved=0,
                    searched_at=now,
                ))

            session.add_all(resources)
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


def get_all_resources(project_name: str) -> dict[int, dict]:
    """Return all resources for a project, keyed by knode_id."""
    session = get_session()
    try:
        resources = (
            session.query(NodeResource)
            .filter_by(project_name=project_name)
            .order_by(NodeResource.knode_id, NodeResource.score.desc())
            .all()
        )
        statuses = (
            session.query(NodeSearchStatus)
            .filter_by(project_name=project_name)
            .all()
        )
        status_map = {s.knode_id: s for s in statuses}

        result: dict[int, dict] = {}
        for r in resources:
            if r.knode_id not in result:
                s = status_map.get(r.knode_id)
                result[r.knode_id] = {
                    "status": s.status if s else "idle",
                    "searched_at": s.searched_at.isoformat() if s and s.searched_at else None,
                    "resources": [],
                }
            result[r.knode_id]["resources"].append({
                "id": r.id,
                "source_type": r.source_type,
                "title": r.title,
                "url": r.url,
                "snippet": r.snippet,
                "score": r.score,
                "saved": bool(r.saved),
                "saved_at": r.saved_at.isoformat() if r.saved_at else None,
            })
        return result
    finally:
        session.close()


def add_resource(project_name: str, knode_id: int, url: str, title: str, snippet: str = "") -> dict:
    """Manually add a resource for a node. Auto-detects source_type from URL."""
    try:
        u = __import__("urllib.parse", fromlist=["urlparse"]).urlparse(url)
        source_type = "youtube" if "youtube.com" in u.netloc or "youtu.be" in u.netloc else "web"
    except Exception:
        source_type = "web"

    session = get_session()
    try:
        row = NodeResource(
            project_name=project_name,
            knode_id=knode_id,
            source_type=source_type,
            title=title or url,
            url=url,
            snippet=snippet,
            score=0.0,
            saved=1,  # manually added resources are saved by default
            searched_at=datetime.now(),
            saved_at=datetime.now(),
        )
        session.add(row)
        session.commit()
        return {
            "id": row.id,
            "source_type": row.source_type,
            "title": row.title,
            "url": row.url,
            "snippet": row.snippet,
            "score": row.score,
            "saved": True,
            "saved_at": row.saved_at.isoformat() if row.saved_at else None,
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
