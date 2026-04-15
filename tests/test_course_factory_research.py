"""
Tests for course_factory external research integration (Tavily + merge)
and {{KEY}} shortcode expansion.

Covers:
- should_research_knode() heuristic classification
- _extract_youtube_id() URL parsing
- merge_resources_into_plan() markdown injection locations
- make_course_content(research=...) end-to-end integration
- research_knode() with mocked Tavily client
- expand_resource_shortcodes() shortcode → Markdown link replacement
- EXTERNAL_RESOURCE_URLS registry consistency
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))
sys.path.insert(0, str(_ROOT / "src"))

import course_factory.factory as cf  # noqa: E402


# ─── Fixtures ───────────────────────────────────────────────────────────────


def _engineering_knode() -> dict:
    return {
        "title": "火星地形数据处理与可视化",
        "summary": "使用 HiRISE 图像生成 DEM 地形模型",
        "difficulty_level": 6,
        "module_role": "engineering",
        "hands_on_components": ["加载 HiRISE 图像并生成 DEM", "在地形图上标注危险区域"],
        "acceptance_standard": ["生成至少 1 份带标注的 DEM 地图"],
        "acceptance_artifacts": [{"title": "DEM 地图 PNG", "format": "image"}],
        "core_question": "如何从 HiRISE 图像恢复火星地形三维数据？",
    }


def _intro_knode() -> dict:
    return {
        "title": "项目介绍与学习方法",
        "summary": "如何完成这个火星风险地图项目",
        "difficulty_level": 2,
        "module_role": "onboarding",
        "hands_on_components": [],
    }


def _science_knode() -> dict:
    return {
        "title": "神经元的信号传导机制",
        "summary": "动作电位与突触传导",
        "difficulty_level": 5,
    }


def _legacy_knode() -> dict:
    """No v4.1 fields at all."""
    return {
        "title": "基础生物学概念",
        "summary": "细胞与代谢",
        "difficulty_level": 3,
    }


def _sample_research() -> dict:
    return {
        "web_query": "Mars HiRISE terrain",
        "youtube_query": "Mars terrain tutorial",
        "web_results": [
            {
                "title": "NASA HiRISE Mission",
                "url": "https://hirise.lpl.arizona.edu",
                "snippet": "High resolution imaging of Mars surface.",
                "score": 0.92,
            },
            {
                "title": "USGS Mars DEM Archive",
                "url": "https://astrogeology.usgs.gov/mars",
                "snippet": "Digital elevation models of Mars terrain.",
                "score": 0.85,
            },
        ],
        "youtube_results": [
            {
                "title": "Mars Terrain Mapping Explained",
                "url": "https://www.youtube.com/watch?v=abc123",
                "video_id": "abc123",
                "snippet": "Tutorial on mapping Mars terrain from satellite images.",
                "score": 0.88,
            }
        ],
        "researched_at": "2026-04-05T16:00:00",
    }


def _sample_plan_markdown() -> str:
    return """## 学习目标
- 能够处理 HiRISE 图像
- 能够生成 DEM 地图

## 引入：如何从 HiRISE 图像恢复火星地形三维数据？
通过立体视觉重建火星地形。

## 核心概念：立体视觉重建
利用两张不同视角的图像恢复深度信息。

## 深入理解：DEM 生成流程
从图像配准到高程计算的完整管线。

## 应用与拓展
完成至少 1 份 DEM 地图标注。
"""


# ─── should_research_knode ──────────────────────────────────────────────────


class TestShouldResearchKnode:
    def test_engineering_knode_is_researched(self):
        assert cf.should_research_knode(_engineering_knode()) is True

    def test_always_returns_true(self):
        # should_research_knode 当前策略：始终返回 True
        assert cf.should_research_knode(_intro_knode()) is True
        assert cf.should_research_knode(_science_knode()) is True
        assert cf.should_research_knode(_legacy_knode()) is True
        assert cf.should_research_knode(_engineering_knode()) is True
        assert cf.should_research_knode({
            "title": "项目答辩与展示",
            "summary": "向评审团展示最终成果",
            "difficulty_level": 4,
        }) is True
        assert cf.should_research_knode({
            "title": "随便的主题",
            "summary": "没有关键词",
            "difficulty_level": 2,
        }) is True


# ─── _extract_youtube_id ────────────────────────────────────────────────────


class TestExtractYoutubeId:
    def test_watch_url(self):
        assert cf._extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert cf._extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        assert cf._extract_youtube_id("https://youtube.com/embed/abc123") == "abc123"

    def test_mobile_url(self):
        assert cf._extract_youtube_id("https://m.youtube.com/watch?v=mobileID") == "mobileID"

    def test_shorts_url(self):
        assert cf._extract_youtube_id("https://www.youtube.com/shorts/shortID") == "shortID"

    def test_non_youtube_url_returns_none(self):
        assert cf._extract_youtube_id("https://example.com/video") is None

    def test_youtube_no_video_id(self):
        assert cf._extract_youtube_id("https://www.youtube.com/") is None

    def test_malformed_url(self):
        assert cf._extract_youtube_id("not-a-url") is None


# ─── merge_resources_into_plan ──────────────────────────────────────────────


class TestMergeResourcesIntoPlan:
    def test_inserts_videos_after_deep_understanding(self):
        plan = _sample_plan_markdown()
        merged = cf.merge_resources_into_plan(plan, _sample_research())
        # 推荐视频 section 出现在"深入理解"之后，"应用与拓展"之前
        deep_idx = merged.index("## 深入理解")
        video_idx = merged.index("## 推荐视频")
        apply_idx = merged.index("## 应用与拓展")
        assert deep_idx < video_idx < apply_idx

    def test_includes_thumbnail_image_link(self):
        merged = cf.merge_resources_into_plan(_sample_plan_markdown(), _sample_research())
        assert "https://img.youtube.com/vi/abc123/hqdefault.jpg" in merged
        assert "https://www.youtube.com/watch?v=abc123" in merged

    def test_appends_further_reading_section(self):
        merged = cf.merge_resources_into_plan(_sample_plan_markdown(), _sample_research())
        assert "## 延伸阅读" in merged
        # 延伸阅读在最末尾
        assert merged.rfind("## 延伸阅读") > merged.rfind("## 推荐视频")
        assert "NASA HiRISE Mission" in merged
        assert "https://hirise.lpl.arizona.edu" in merged
        assert "USGS Mars DEM Archive" in merged

    def test_none_research_returns_original(self):
        plan = _sample_plan_markdown()
        assert cf.merge_resources_into_plan(plan, None) == plan

    def test_empty_research_returns_original(self):
        plan = _sample_plan_markdown()
        empty = {"web_results": [], "youtube_results": []}
        assert cf.merge_resources_into_plan(plan, empty) == plan

    def test_only_videos_no_web(self):
        research = _sample_research()
        research["web_results"] = []
        merged = cf.merge_resources_into_plan(_sample_plan_markdown(), research)
        assert "## 推荐视频" in merged
        assert "## 延伸阅读" not in merged

    def test_only_web_no_videos(self):
        research = _sample_research()
        research["youtube_results"] = []
        merged = cf.merge_resources_into_plan(_sample_plan_markdown(), research)
        assert "## 延伸阅读" in merged
        assert "## 推荐视频" not in merged

    def test_fallback_insertion_when_no_anchor(self):
        plan = "## 标题\n普通内容没有深入理解段。\n"
        merged = cf.merge_resources_into_plan(plan, _sample_research())
        assert "## 推荐视频" in merged
        assert merged.index("## 推荐视频") > merged.index("## 标题")

    def test_youtube_title_escapes_brackets(self):
        research = _sample_research()
        research["youtube_results"][0]["title"] = "Tutorial [Part 1]"
        merged = cf.merge_resources_into_plan(_sample_plan_markdown(), research)
        # [ ] 应该被转成 ( )
        assert "Tutorial (Part 1)" in merged


# ─── make_course_content(research=...) ─────────────────────────────────────


class TestMakeCourseContentWithResearch:
    def _exercises(self, ref: str = "加载 HiRISE 图像并生成 DEM"):
        return cf.make_exercises([
            {
                "question": "DEM 是什么？",
                "options": ["A", "B", "C", "D"],
                "correct": 0,
                "explanation": "数字高程模型",
                "ref": ref,
            }
        ])

    def test_research_injects_into_plan_markdown(self):
        cc = cf.make_course_content(
            plan_markdown=_sample_plan_markdown(),
            animation_html="<html></html>",
            animation_topic="DEM 重建",
            exercises=self._exercises(),
            exercise_topic="DEM 测验",
            knode=_engineering_knode(),
            animation_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            animation_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            exercise_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            exercise_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            research=_sample_research(),
        )
        assert "## 推荐视频" in cc["plan_markdown"]
        assert "## 延伸阅读" in cc["plan_markdown"]
        assert "NASA HiRISE Mission" in cc["plan_markdown"]

    def test_research_adds_external_resources_field(self):
        cc = cf.make_course_content(
            plan_markdown=_sample_plan_markdown(),
            animation_html="<html></html>",
            animation_topic="DEM 重建",
            exercises=self._exercises(),
            exercise_topic="DEM 测验",
            knode=_engineering_knode(),
            animation_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            animation_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            exercise_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            exercise_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            research=_sample_research(),
        )
        assert "external_resources" in cc
        ext = cc["external_resources"]
        assert ext["web_query"] == "Mars HiRISE terrain"
        assert len(ext["web_results"]) == 2
        assert len(ext["youtube_results"]) == 1
        assert ext["youtube_results"][0]["video_id"] == "abc123"

    def test_no_research_no_external_resources_field(self):
        cc = cf.make_course_content(
            plan_markdown=_sample_plan_markdown(),
            animation_html="<html></html>",
            animation_topic="DEM 重建",
            exercises=self._exercises(),
            exercise_topic="DEM 测验",
            knode=_engineering_knode(),
            animation_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            animation_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            exercise_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            exercise_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
        )
        assert "external_resources" not in cc
        assert "## 推荐视频" not in cc["plan_markdown"]
        assert "## 延伸阅读" not in cc["plan_markdown"]

    def test_research_merged_before_preflight(self):
        """研究资料注入后 plan_markdown 仍然包含 core_question → preflight 应该通过。"""
        cc = cf.make_course_content(
            plan_markdown=_sample_plan_markdown(),
            animation_html="<html></html>",
            animation_topic="DEM 重建",
            exercises=self._exercises(),
            exercise_topic="DEM 测验",
            knode=_engineering_knode(),
            animation_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            animation_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            exercise_hands_on_ref="加载 HiRISE 图像并生成 DEM",
            exercise_acceptance_ref="生成至少 1 份带标注的 DEM 地图",
            research=_sample_research(),
        )
        # 如果 preflight 失败会 raise；到这里说明通过
        assert "plan_markdown" in cc


# ─── research_knode (mocked Tavily) ─────────────────────────────────────────


class TestResearchKnodeMocked:
    def _fake_tavily_response(self):
        return {
            "results": [
                {
                    "title": "HiRISE Camera Overview",
                    "url": "https://www.uahirise.org/",
                    "content": "High Resolution Imaging Science Experiment.",
                    "score": 0.91,
                }
            ]
        }

    def _fake_tavily_youtube(self):
        return {
            "results": [
                {
                    "title": "HiRISE Explained",
                    "url": "https://www.youtube.com/watch?v=xyz789",
                    "content": "Overview of the HiRISE camera on Mars.",
                    "score": 0.84,
                }
            ]
        }

    def test_research_calls_tavily_and_builds_result(self):
        fake_client = type("FakeClient", (), {})()

        calls = []

        def fake_search(query, **kwargs):
            calls.append((query, kwargs))
            if "include_domains" in kwargs and "youtube.com" in kwargs["include_domains"]:
                return self._fake_tavily_youtube()
            return self._fake_tavily_response()

        fake_client.search = fake_search

        with patch("course_factory.TavilyClient", create=True, return_value=fake_client):
            # patch 直接替换模块级 import，因为 research_knode 内部做 from tavily import TavilyClient
            # 改走 module 级注入：
            import tavily as tavily_mod
            with patch.object(tavily_mod, "TavilyClient", return_value=fake_client):
                result = cf.research_knode(
                    _engineering_knode(),
                    milestone={"title": "数据准备阶段"},
                    sub_project={"id": "mars-stage1", "title": "Mars Risk Map"},
                    api_key="fake-key",
                )

        assert len(calls) == 2
        assert result["web_query"]
        assert result["youtube_query"]
        assert len(result["web_results"]) == 1
        assert result["web_results"][0]["url"] == "https://www.uahirise.org/"
        assert len(result["youtube_results"]) == 1
        assert result["youtube_results"][0]["video_id"] == "xyz789"
        assert "researched_at" in result

    def test_research_excludes_youtube_from_web_results(self):
        fake_client = type("FakeClient", (), {})()

        def fake_search(query, **kwargs):
            if "include_domains" in kwargs:
                return {
                    "results": [
                        {
                            "title": "YT Vid",
                            "url": "https://www.youtube.com/watch?v=aaa",
                            "content": "yt",
                            "score": 0.9,
                        }
                    ]
                }
            # web 通道里混入了一条 youtube.com
            return {
                "results": [
                    {
                        "title": "Real Web",
                        "url": "https://example.com",
                        "content": "web",
                        "score": 0.8,
                    },
                    {
                        "title": "YT in web channel",
                        "url": "https://youtube.com/watch?v=bbb",
                        "content": "yt contamination",
                        "score": 0.7,
                    },
                ]
            }

        fake_client.search = fake_search

        import tavily as tavily_mod
        with patch.object(tavily_mod, "TavilyClient", return_value=fake_client):
            result = cf.research_knode(
                _engineering_knode(),
                api_key="fake-key",
            )

        urls = [r["url"] for r in result["web_results"]]
        assert "https://example.com" in urls
        assert all("youtube" not in u for u in urls)

    def test_research_missing_api_key_raises(self):
        with pytest.raises(RuntimeError, match="Tavily API key"):
            cf.research_knode(_engineering_knode(), api_key="")

    def test_research_tavily_failure_raises(self):
        fake_client = type("FakeClient", (), {})()

        def fake_search(query, **kwargs):
            raise Exception("network error")

        fake_client.search = fake_search

        import tavily as tavily_mod
        with patch.object(tavily_mod, "TavilyClient", return_value=fake_client):
            with pytest.raises(RuntimeError, match="Tavily 搜索失败"):
                cf.research_knode(_engineering_knode(), api_key="fake-key")


# ─── expand_resource_shortcodes ─────────────────────────────────────────────


class TestExpandResourceShortcodes:
    """Tests for {{KEY}} shortcode expansion."""

    def test_basic_replacement(self):
        """已注册的 shortcode 被替换为 [title](url) 链接。"""
        text = "来自 {{AI4Mars}} 数据集"
        result = cf.expand_resource_shortcodes(text)
        assert "{{" not in result
        assert "[AI4Mars]" in result
        assert "data.nasa.gov" in result

    def test_case_insensitive(self):
        """KEY 不区分大小写。"""
        for variant in ("{{ai4mars}}", "{{AI4MARS}}", "{{Ai4Mars}}"):
            result = cf.expand_resource_shortcodes(variant)
            assert "[AI4Mars]" in result

    def test_multiple_shortcodes(self):
        """一段文本中多个不同 shortcode 全部替换。"""
        text = "从 {{curiosity_raw}} 和 {{perseverance_raw}} 下载"
        result = cf.expand_resource_shortcodes(text)
        assert "{{" not in result
        assert "mars.nasa.gov/msl" in result
        assert "mars.nasa.gov/mars2020" in result

    def test_unregistered_key_preserved(self):
        """未注册的 shortcode 保持原样不变。"""
        text = "参考 {{nonexistent_resource}} 的数据"
        result = cf.expand_resource_shortcodes(text)
        assert "{{nonexistent_resource}}" in result

    def test_mixed_registered_and_unregistered(self):
        """注册和未注册 shortcode 混合时各自正确处理。"""
        text = "{{AI4Mars}} 和 {{unknown_key}}"
        result = cf.expand_resource_shortcodes(text)
        assert "[AI4Mars]" in result
        assert "{{unknown_key}}" in result

    def test_no_shortcodes(self):
        """无 shortcode 的文本原样返回。"""
        text = "这段文字没有任何 shortcode"
        result = cf.expand_resource_shortcodes(text)
        assert result == text

    def test_empty_string(self):
        """空字符串处理。"""
        assert cf.expand_resource_shortcodes("") == ""

    def test_all_registered_keys(self):
        """注册表中每个 key 都能正��替换。"""
        for key, entry in cf.EXTERNAL_RESOURCE_URLS.items():
            text = f"{{{{{key}}}}}"
            result = cf.expand_resource_shortcodes(text)
            assert entry["title"] in result, f"key={key} title not found"
            assert entry["url"] in result, f"key={key} url not found"

    def test_duplicate_shortcode(self):
        """同一 shortcode 出现多次时全部替换���"""
        text = "{{AI4Mars}} 第一处，{{AI4Mars}} 第二处"
        result = cf.expand_resource_shortcodes(text)
        assert result.count("[AI4Mars]") == 2
        assert "{{" not in result

    def test_output_is_valid_markdown_link(self):
        """替换结果是合法的 Markdown 链接格式 [title](url)。"""
        import re
        result = cf.expand_resource_shortcodes("{{hirise}}")
        md_link_pattern = re.compile(r"\[.+?\]\(https?://.+?\)")
        assert md_link_pattern.search(result), f"不是合法 Markdown 链接: {result}"


class TestExternalResourceUrlsRegistry:
    """Verify EXTERNAL_RESOURCE_URLS registry integrity."""

    def test_all_entries_have_title_and_url(self):
        """每条注册项必须有 title 和 url 字段。"""
        for key, entry in cf.EXTERNAL_RESOURCE_URLS.items():
            assert "title" in entry, f"key={key} missing title"
            assert "url" in entry, f"key={key} missing url"
            assert entry["title"].strip(), f"key={key} has empty title"
            assert entry["url"].startswith("https://"), f"key={key} url not https"

    def test_keys_are_lowercase(self):
        """注册表的 key 全部是小写（匹配时转小写，key 本身也应一致）。"""
        for key in cf.EXTERNAL_RESOURCE_URLS:
            assert key == key.lower(), f"key={key} should be lowercase"

    def test_no_duplicate_urls(self):
        """不同 key 不应指向完全相同的 URL（curiosity_raw 和 curiosity_navcam 除外）。"""
        urls = {}
        # 允许 curiosity_raw 和 curiosity_navcam 共享 URL
        allowed_duplicates = {"curiosity_raw", "curiosity_navcam"}
        for key, entry in cf.EXTERNAL_RESOURCE_URLS.items():
            url = entry["url"]
            if url in urls and key not in allowed_duplicates and urls[url] not in allowed_duplicates:
                pytest.fail(f"Duplicate URL: {key} and {urls[url]} -> {url}")
            urls[url] = key
