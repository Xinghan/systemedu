"""ObjectFactory: offline pipeline for extending the ObjectRegistry.

Public API:
    factory = ObjectFactory(llm=my_llm)
    staging_path, report = await factory.run_pipeline(
        object_key="submarine.basic",
        description="侧视图潜水艇，包含舰桥、艇身、螺旋桨、鱼雷管",
        base_family="",
        auto_promote=False,  # True: auto-promote if score > 0.8
    )

Architecture:
    Unknown object
      -> CandidateGenerator (LLM, two-step: semantic + geometry)
      -> CandidateValidator (pure Python, three-phase check)
      -> SnapshotRenderer (pure Python, SVG preview)
      -> staging/*.json (written with validation results)
      -> RegistryPromoter (staging -> objects/{key}.py + __init__.py update)

Runtime main chain is NOT affected by this module.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from .candidate_generator import CandidateGenerator, CandidateResult
from .candidate_validator import CandidateValidator, ValidationReport
from .registry_promoter import RegistryPromoter
from .snapshot_renderer import SnapshotRenderer

logger = logging.getLogger(__name__)

__all__ = [
    "ObjectFactory",
    "CandidateGenerator",
    "CandidateResult",
    "CandidateValidator",
    "ValidationReport",
    "SnapshotRenderer",
    "RegistryPromoter",
]


class ObjectFactory:
    """Offline factory pipeline for extending the ObjectRegistry.

    Separates staging from production: runtime Planner/Compiler never touches this.
    """

    def __init__(self, llm=None, gameagent_dir: Path | None = None):
        self._generator = CandidateGenerator(llm=llm)
        self._validator = CandidateValidator()
        self._renderer = SnapshotRenderer()
        self._promoter = RegistryPromoter(gameagent_dir=gameagent_dir)
        self._staging_dir = self._promoter._staging_dir

    async def generate_candidate(
        self,
        object_key: str,
        description: str,
        base_family: str = "",
    ) -> CandidateResult | None:
        """Step 1: Generate a candidate via LLM (two-step: semantic + geometry)."""
        return await self._generator.generate(object_key, description, base_family)

    def validate_candidate(self, candidate: CandidateResult) -> ValidationReport:
        """Step 2: Validate geometry, semantics, and style."""
        staging_dict = candidate.to_staging_dict()
        return self._validator.validate(staging_dict)

    def stage_candidate(
        self,
        candidate: CandidateResult,
        report: ValidationReport,
    ) -> Path:
        """Step 3: Write candidate + validation results to staging/*.json."""
        self._staging_dir.mkdir(parents=True, exist_ok=True)

        staging_dict = candidate.to_staging_dict()
        staging_dict["validation_score"] = report.score
        staging_dict["validation_errors"] = report.errors
        staging_dict["validation_warnings"] = report.warnings if hasattr(report, "warnings") else []

        if report.passed and report.score >= 0.8:
            staging_dict["status"] = "approved"
        elif report.passed:
            staging_dict["status"] = "candidate"
        else:
            staging_dict["status"] = "rejected"

        safe_key = candidate.object_key.replace(".", "_").replace("-", "_")
        staging_path = self._staging_dir / f"{safe_key}.json"
        staging_path.write_text(
            json.dumps(staging_dict, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info(
            f"Staged {candidate.object_key!r}: status={staging_dict['status']}, "
            f"score={report.score}"
        )
        return staging_path

    def promote_candidate(self, staging_path: Path) -> Path:
        """Step 4 (manual): Promote approved staging file to production objects/."""
        return self._promoter.promote(staging_path)

    async def run_pipeline(
        self,
        object_key: str,
        description: str,
        base_family: str = "",
        auto_promote: bool = False,
    ) -> tuple[Path | None, ValidationReport]:
        """Run the full pipeline.

        Args:
            object_key: e.g. "submarine.basic"
            description: natural language description
            base_family: optional family key to base on
            auto_promote: if True and score > 0.8, automatically promote to production

        Returns:
            (staging_path_or_production_path, ValidationReport)
            staging_path is None if generation failed.
        """
        # Generate
        candidate = await self.generate_candidate(object_key, description, base_family)
        if candidate is None:
            dummy_report = ValidationReport(
                passed=False,
                score=0.0,
                errors=["CandidateGenerator failed to produce a result"],
            )
            return None, dummy_report

        # Validate
        report = self.validate_candidate(candidate)

        # Stage
        staging_path = self.stage_candidate(candidate, report)

        # Auto-promote if requested and score sufficient
        if auto_promote and report.score >= 0.8:
            try:
                production_path = self.promote_candidate(staging_path)
                logger.info(f"Auto-promoted {object_key!r} -> {production_path}")
                return production_path, report
            except Exception:
                logger.exception(f"Auto-promote failed for {object_key!r}, returning staging path")

        return staging_path, report
