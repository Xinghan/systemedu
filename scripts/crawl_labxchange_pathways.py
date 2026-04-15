"""
爬取 LabXchange 全部 pathway 元数据到本地 JSON。

API: POST https://api.www.labxchange.org/api/v1/search/library
每页最多 100 条，共约 1500 条 pathway。

输出: knowledge_base_doc/labxchange_pathways.json
"""

import json
import re
import time
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

_HTML_TAG_RE = re.compile(r"<[^>]+>")

API_URL = "https://api.www.labxchange.org/api/v1/search/library"
PAGE_SIZE = 100  # 每页条数
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "knowledge_base_doc"
OUTPUT_FILE = OUTPUT_DIR / "labxchange_pathways.json"


def fetch_page(page: int) -> dict:
    """拉取第 page 页的 pathway 列表。"""
    body = json.dumps({
        "mode": "public",
        "mode_parameters": {},
        "keywords": "",
        "filters": [
            {"filter_on": "Language", "filter_values": ["en"]},
            {"filter_on": "ItemType", "filter_values": ["pathway"]},
        ],
        "exclude": [
            {"filter_on": "ItemType", "filter_values": ["link"]},
        ],
        "ordering": "relevance",
        "current_page": page,
        "pagination_size": PAGE_SIZE,
    }).encode("utf-8")

    req = Request(API_URL, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")

    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extract_pathway(item: dict) -> dict:
    """从 API 返回的 item 中提取我们需要的字段。"""
    meta = item.get("metadata", {})
    raw_desc = meta.get("description", "")
    clean_desc = _HTML_TAG_RE.sub("", raw_desc).strip()
    return {
        "id": meta.get("id", ""),
        "title": meta.get("title", ""),
        "description": clean_desc,
        "subject_tags": meta.get("subject_tags", []),
        "learning_objectives": [
            obj.get("description", "")
            for obj in meta.get("learning_objectives", [])
        ],
        "background_knowledge": meta.get("background_knowledge", ""),
        "language": meta.get("language", ""),
        "item_count": meta.get("item_count", 0),
        "image_url": meta.get("image_url", ""),
        "url": f"https://www.labxchange.org/library/pathway/{meta.get('id', '')}",
        "license": meta.get("license", ""),
        "stats": meta.get("stats", {}),
        "uploaded_date": meta.get("uploaded_date", ""),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 先拉第一页获取总数
    print("Fetching page 1 ...")
    data = fetch_page(1)
    total = data.get("count", 0)
    print(f"Total pathways: {total}")

    all_pathways = []
    results = data.get("results", [])
    for item in results:
        all_pathways.append(extract_pathway(item))

    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"Total pages: {total_pages}")

    for page in range(2, total_pages + 1):
        print(f"Fetching page {page}/{total_pages} ...")
        try:
            data = fetch_page(page)
            results = data.get("results", [])
            for item in results:
                all_pathways.append(extract_pathway(item))
        except HTTPError as e:
            print(f"  Error on page {page}: {e}", file=sys.stderr)
            time.sleep(3)
            # 重试一次
            try:
                data = fetch_page(page)
                results = data.get("results", [])
                for item in results:
                    all_pathways.append(extract_pathway(item))
            except HTTPError as e2:
                print(f"  Retry failed on page {page}: {e2}", file=sys.stderr)
                continue

        # 控制请求频率
        time.sleep(0.5)

    # 按学科分组统计
    subject_counts: dict[str, int] = {}
    for pw in all_pathways:
        for tag in pw["subject_tags"]:
            top_subject = tag.split(":")[0]
            subject_counts[top_subject] = subject_counts.get(top_subject, 0) + 1

    output = {
        "crawled_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(all_pathways),
        "subject_summary": dict(sorted(subject_counts.items(), key=lambda x: -x[1])),
        "pathways": all_pathways,
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone! {len(all_pathways)} pathways saved to {OUTPUT_FILE}")
    print(f"Subject distribution: {json.dumps(subject_counts, indent=2)}")


if __name__ == "__main__":
    main()
