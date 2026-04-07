"""Tests for education services: format conversion and validation."""

import pytest

from systemedu.education.services import (
    convert_uploaded_tree,
    extract_project_brief,
    extract_project_meta,
    validate_knowledge_tree,
    validate_v5_tree,
)
from systemedu.education.tree_adapter import v5_to_milestones_view
from systemedu.education.models import V5KnowledgeTree


# -- Sample data --

TREE_LEAF_DATA = {
    "项目名称": "树叶识别AI模型",
    "项目简介": "用AI识别树叶种类",
    "适用对象": {"年龄": "8-14岁"},
    "模块依赖图": [
        {"模块id": "M01", "模块标题": "数据收集", "前置模块": []},
        {"模块id": "M02", "模块标题": "模型训练", "前置模块": ["M01"]},
    ],
    "知识树节点": [
        {
            "id": "M01N01",
            "模块id": "M01",
            "标题": "认识树叶",
            "详细描述": "学习不同树叶的特征",
            "知识等级": "L0-启蒙",
            "预估学习时长_分钟": 10,
            "先修节点": [],
            "学习目标": ["识别常见树叶"],
            "完成标记": "quiz",
            "是否核心": True,
        },
        {
            "id": "M01N02",
            "模块id": "M01",
            "标题": "拍照采集",
            "详细描述": "用手机拍摄树叶照片",
            "知识等级": "L1-入门",
            "预估学习时长_分钟": 15,
            "先修节点": ["M01N01"],
            "学习目标": ["学会拍照采集"],
            "完成标记": "demo",
            "是否核心": True,
        },
        {
            "id": "M02N01",
            "模块id": "M02",
            "标题": "数据预处理",
            "详细描述": "图片裁剪和标注",
            "知识等级": "L2-基础",
            "预估学习时长_分钟": 20,
            "先修节点": ["M01N02"],
            "学习目标": ["掌握数据预处理"],
            "完成标记": "code_submit",
            "是否核心": True,
        },
        {
            "id": "M02N02",
            "模块id": "M02",
            "标题": "训练模型",
            "详细描述": "使用预处理数据训练分类模型",
            "知识等级": "L3-进阶",
            "预估学习时长_分钟": 30,
            "先修节点": ["M02N01"],
            "学习目标": ["训练AI模型"],
            "完成标记": "code_submit",
            "是否核心": True,
        },
    ],
}

MILESTONES_DATA = {
    "milestones": [
        {
            "title": "基础知识",
            "knodes": [
                {
                    "title": "节点A",
                    "summary": "描述A",
                    "difficulty_level": 1,
                    "estimated_minutes": 10,
                    "prerequisite_indices": [],
                }
            ],
        }
    ]
}


class TestConvertUploadedTree:
    def test_milestones_format_upgraded_to_v5(self):
        """Milestones format should be upgraded to v5 (stages/modules)."""
        result = convert_uploaded_tree(MILESTONES_DATA)
        assert "stages" in result
        assert "modules" in result

    def test_tree_leaf_conversion(self):
        """tree_leaf format should be converted to v5."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        assert "stages" in result
        assert "modules" in result
        assert len(result["stages"]) == 2
        assert result["stages"][0]["title"] == "数据收集"
        assert result["stages"][1]["title"] == "模型训练"

    def test_tree_leaf_module_count(self):
        """Converted tree should have correct module counts."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        s1_mods = [m for m in result["modules"] if m["stage_id"] == result["stages"][0]["stage_id"]]
        s2_mods = [m for m in result["modules"] if m["stage_id"] == result["stages"][1]["stage_id"]]
        assert len(s1_mods) == 2  # M01: 2 nodes
        assert len(s2_mods) == 2  # M02: 2 nodes

    def test_tree_leaf_title_mapping(self):
        """Module titles should be mapped from node titles."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        assert result["modules"][0]["title"] == "认识树叶"

    def test_tree_leaf_summary_mapping(self):
        """Module summaries should be mapped from node descriptions."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        assert result["modules"][0]["summary"] == "学习不同树叶的特征"

    def test_tree_leaf_depends_on(self):
        """String node IDs should be converted to module_id depends_on."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        mods = result["modules"]
        # First module has no deps
        assert mods[0]["depends_on"] == []
        # Second module depends on first
        assert len(mods[1]["depends_on"]) == 1

    def test_unrecognized_format_raises(self):
        """Unrecognized format should raise ValueError."""
        with pytest.raises(ValueError, match="Unrecognized format"):
            convert_uploaded_tree({"random_key": "value"})

    def test_converted_tree_validates(self):
        """Converted v5 tree should pass v5 validation."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        errors = validate_v5_tree(result)
        assert errors == []

    def test_milestones_view_roundtrip(self):
        """Converted v5 tree should produce valid milestones view."""
        result = convert_uploaded_tree(TREE_LEAF_DATA)
        v5_tree = V5KnowledgeTree.model_validate(result)
        ms_view = v5_to_milestones_view(v5_tree)
        assert len(ms_view.milestones) == 2
        assert ms_view.milestones[0].title == "数据收集"
        # Check knode count
        assert len(ms_view.milestones[0].knodes) == 2
        assert len(ms_view.milestones[1].knodes) == 2


class TestExtractProjectMeta:
    def test_extracts_title(self):
        meta = extract_project_meta(TREE_LEAF_DATA)
        assert meta["title"] == "树叶识别AI模型"

    def test_extracts_description(self):
        meta = extract_project_meta(TREE_LEAF_DATA)
        assert meta["description"] == "用AI识别树叶种类"

    def test_extracts_age_range(self):
        meta = extract_project_meta(TREE_LEAF_DATA)
        assert meta["age_range"] == [8, 14]

    def test_extracts_estimated_hours(self):
        meta = extract_project_meta(TREE_LEAF_DATA)
        assert meta["estimated_hours"] >= 1

    def test_empty_data(self):
        meta = extract_project_meta({})
        assert isinstance(meta, dict)

    def test_milestones_format_no_crash(self):
        """Should not crash on milestones format (just return minimal meta)."""
        meta = extract_project_meta(MILESTONES_DATA)
        assert isinstance(meta, dict)


# -- v4.1 format sample data --

V41_DATA = {
    "schema_version": "4.1",
    "title": "Test Project v4.1",
    "description": "A test v4.1 project",
    "project_identity": {
        "project_id": "P-TEST-01",
        "domain": "space_robotics",
    },
    "target_learner": {
        "entry_profile": "Approx 10 years old",
    },
    "project_positioning": {
        "project_summary": "Test summary",
        "why_it_is_industrial": "Industrial reason",
        "final_system_goal": "Build something",
        "real_world_scope": "Real world",
    },
    "stages": [
        {
            "stage_id": "S1",
            "title": "Stage One",
            "stage_description": "First stage description",
            "stage_goal": "Goal of S1",
            "stage_output": "Output of S1",
        },
        {
            "stage_id": "S2",
            "title": "Stage Two",
            "stage_description": "Second stage description",
            "stage_goal": "Goal of S2",
            "stage_output": "Output of S2",
        },
    ],
    "modules": [
        {
            "module_id": "P-TEST-01-M01",
            "title": "Module A",
            "stage_id": "S1",
            "sequence_order": 1,
            "module_role": "foundation",
            "summary": "Module A summary",
            "detailed_description": "Module A details",
            "core_question": "Why A?",
            "depends_on": [],
            "estimated_duration_months": "1",
            "knowledge_level": "K1",
            "acceptance_artifacts": [
                {"artifact_id": "A1", "title": "Report", "format": "report"}
            ],
            "acceptance_standard": ["Standard 1"],
            "hands_on_components": ["Hands on 1"],
            "outputs_produced": ["Output 1"],
        },
        {
            "module_id": "P-TEST-01-M02",
            "title": "Module B",
            "stage_id": "S1",
            "sequence_order": 2,
            "module_role": "integration",
            "summary": "Module B summary",
            "detailed_description": "Module B details",
            "core_question": "Why B?",
            "depends_on": ["P-TEST-01-M01"],
            "estimated_duration_months": "1-2",
            "knowledge_level": "K2",
            "acceptance_artifacts": [],
            "acceptance_standard": [],
            "hands_on_components": [],
            "outputs_produced": [],
        },
        {
            "module_id": "P-TEST-01-M03",
            "title": "Module C",
            "stage_id": "S2",
            "sequence_order": 1,
            "module_role": "capstone",
            "summary": "Module C summary",
            "detailed_description": "",
            "core_question": "Why C?",
            "depends_on": ["P-TEST-01-M01", "P-TEST-01-M02"],
            "estimated_duration_months": "2",
            "knowledge_level": "K4",
            "acceptance_artifacts": [],
            "acceptance_standard": [],
            "hands_on_components": [],
            "outputs_produced": [],
        },
    ],
}


class TestConvertV41Tree:
    def test_detects_v41_format(self):
        """v4.1 format should be detected and passed through as v5."""
        result = convert_uploaded_tree(V41_DATA)
        assert "stages" in result
        assert "modules" in result
        assert len(result["stages"]) == 2

    def test_v5_passthrough(self):
        """v4.1/v5 format (stages+modules) should pass through as-is."""
        result = convert_uploaded_tree(V41_DATA)
        assert result is V41_DATA

    def test_milestones_view_titles(self):
        """Derived milestones view should have correct stage titles."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert ms_view.milestones[0].title == "Stage One"
        assert ms_view.milestones[1].title == "Stage Two"

    def test_milestones_view_descriptions(self):
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert ms_view.milestones[0].description == "First stage description"

    def test_milestones_view_knode_count(self):
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert len(ms_view.milestones[0].knodes) == 2  # M01, M02
        assert len(ms_view.milestones[1].knodes) == 1  # M03

    def test_milestones_view_knode_titles(self):
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert ms_view.milestones[0].knodes[0].title == "Module A"
        assert ms_view.milestones[0].knodes[1].title == "Module B"

    def test_milestones_view_knode_summary(self):
        """Summary combines summary + detailed_description."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        kn = ms_view.milestones[0].knodes[0]
        assert "Module A summary" in kn.summary
        assert "Module A details" in kn.summary

    def test_milestones_view_difficulty_mapping(self):
        """knowledge_level should map to difficulty_level."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert ms_view.milestones[0].knodes[0].difficulty_level == 1  # K1
        assert ms_view.milestones[0].knodes[1].difficulty_level == 3  # K2
        assert ms_view.milestones[1].knodes[0].difficulty_level == 6  # K4

    def test_milestones_view_prerequisite_indices(self):
        """depends_on module_ids should convert to global integer indices."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        # M01 -> index 0, no deps
        assert ms_view.milestones[0].knodes[0].prerequisite_indices == []
        # M02 -> index 1, depends on M01 -> index 0
        assert ms_view.milestones[0].knodes[1].prerequisite_indices == [0]
        # M03 -> index 2, depends on M01(0) + M02(1)
        assert ms_view.milestones[1].knodes[0].prerequisite_indices == [0, 1]

    def test_milestones_view_estimated_minutes(self):
        """Duration months should convert to minutes."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        # "1" month -> 360 minutes
        assert ms_view.milestones[0].knodes[0].estimated_minutes == 360
        # "1-2" months -> avg 1.5 -> 540 minutes
        assert ms_view.milestones[0].knodes[1].estimated_minutes == 540

    def test_milestones_view_metadata_preserved(self):
        """v5 metadata fields should be preserved in milestones view knodes."""
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        kn = ms_view.milestones[0].knodes[0]
        assert kn.module_id == "P-TEST-01-M01"
        assert kn.module_role == "foundation"
        assert kn.core_question == "Why A?"
        assert len(kn.acceptance_artifacts) == 1
        assert kn.acceptance_standard == ["Standard 1"]
        assert kn.hands_on_components == ["Hands on 1"]
        assert kn.outputs_produced == ["Output 1"]

    def test_milestones_view_sub_projects(self):
        v5_tree = V5KnowledgeTree.model_validate(V41_DATA)
        ms_view = v5_to_milestones_view(v5_tree)
        assert len(ms_view.sub_projects) == 2
        assert ms_view.sub_projects[0].id == "S1"
        assert ms_view.sub_projects[1].id == "S2"

    def test_validates_v5(self):
        """v4.1/v5 tree should pass v5 validation."""
        errors = validate_v5_tree(V41_DATA)
        assert errors == []


class TestExtractProjectMetaV41:
    def test_extracts_title(self):
        meta = extract_project_meta(V41_DATA)
        assert meta["title"] == "Test Project v4.1"

    def test_extracts_description(self):
        meta = extract_project_meta(V41_DATA)
        assert meta["description"] == "A test v4.1 project"

    def test_extracts_category(self):
        meta = extract_project_meta(V41_DATA)
        assert meta["category"] == "aerospace"

    def test_extracts_estimated_hours(self):
        meta = extract_project_meta(V41_DATA)
        assert meta["estimated_hours"] >= 1


class TestExtractProjectBriefV41:
    def test_extracts_brief(self):
        brief = extract_project_brief(V41_DATA)
        assert brief is not None
        assert brief["one_liner"] == "Test summary"

    def test_extracts_industry_relation(self):
        brief = extract_project_brief(V41_DATA)
        assert brief["industry_relation"] == "Industrial reason"
