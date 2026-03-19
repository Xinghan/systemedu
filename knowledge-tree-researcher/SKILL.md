---
name: knowledge-tree-researcher
description: >
  Given a learning domain, decompose it into a structured knowledge tree (up to 50 nodes),
  then research each node on the internet and YouTube, evaluate result quality, and produce
  a comprehensive learning resource report.

  Trigger this skill when a user asks to:
  - "Build a knowledge tree for [topic]"
  - "Help me learn [domain] systematically"
  - "Create a learning roadmap with resources for [subject]"
  - "Research and structure learning materials for [topic]"
  - Generate a knowledge tree and find learning resources for any field
---

# Knowledge Tree Researcher

## Workflow Overview

Execute the following phases in strict order:

1. **Decompose** the domain into a knowledge tree
2. **Research** each node (web + YouTube)
3. **Evaluate** and filter results
4. **Report** the final structured output

---

## Phase 1: Knowledge Tree Generation

### Rules
- Maximum **50 nodes** total across all milestones
- Group nodes into **3-6 milestones** (logical learning stages)
- Each node must have:
  - `title`: concise name (max 10 words)
  - `summary`: what the learner will understand/be able to do (2-3 sentences)
  - `difficulty_level`: 1-10
  - `estimated_minutes`: realistic study time
  - `xp_reward`: 50-500 based on difficulty
  - `prerequisite_indices`: global indices of nodes that must come first (empty for root nodes)
- Prerequisite relationships must be **scientifically justified** — only add a dependency when the learner genuinely cannot understand node B without first mastering node A
- Global indices are 0-based, counted sequentially across all milestones

### Output Format (JSON)

```json
{
  "domain": "<learning domain>",
  "milestones": [
    {
      "title": "Milestone title",
      "description": "What this stage covers",
      "order": 0,
      "xp_reward": 500,
      "knodes": [
        {
          "title": "Node title",
          "summary": "What you will learn and be able to do.",
          "difficulty_level": 3,
          "estimated_minutes": 30,
          "xp_reward": 100,
          "prerequisite_indices": []
        }
      ]
    }
  ]
}
```

Print the complete JSON before moving to Phase 2.

---

## Phase 2: Resource Research

For **each node** (iterate in global index order):

### Search Strategy

Use available search tools to find:

**Web search query**: `"<node title> <domain> tutorial guide explained"`
- Collect up to 10 candidate URLs

**YouTube search query**: `"<node title> <domain> tutorial"`
- Collect up to 5 candidate video URLs

If a web search skill or tool is available (e.g., `web_search`, `search`, `brave_search`), use it.
If a YouTube-specific search is available, use it. Otherwise use web search with `site:youtube.com`.

### Per-Node Collection Format

```
### Node <index>: <title>

**Web resources (candidates):**
1. [Title](URL) — <one-line description>
...

**YouTube videos (candidates):**
1. [Title](URL) — <one-line description>
...
```

---

## Phase 3: Quality Evaluation

For each collected resource, score on two dimensions:

| Criterion | Score | Description |
|-----------|-------|-------------|
| Relevance | 1-5   | Directly teaches this node's content |
| Quality   | 1-5   | Authoritative, clear, up-to-date, well-structured |

**Combined score** = Relevance × Quality (max 25)

### Filtering Rules
- Keep web resources with combined score **≥ 12** (top 5 max per node)
- Keep YouTube videos with combined score **≥ 10** (top 3 max per node)
- Discard paywalled content, broken links, or off-topic results
- Prefer: official docs, reputable educational sites (MDN, Khan Academy, Coursera, MIT OCW), and channels with clear educational focus

---

## Phase 4: Final Report

Output a structured Markdown report:

```markdown
# Knowledge Tree: <Domain>

## Summary
- Total nodes: N
- Total milestones: M
- Estimated total study time: X hours

## Milestone 1: <Title>
<description>

### Node 0: <Title>
**Summary:** ...
**Difficulty:** X/10 | **Time:** Xmin | **XP:** X

**Learning Resources:**

Web:
1. [Title](URL) — Relevance: X, Quality: X
...

YouTube:
1. [Title](URL) — Relevance: X, Quality: X
...

### Node 1: <Title>
...

## Milestone 2: ...
```

End the report with:
```markdown
## Research Complete
- Nodes researched: N/N
- Total web resources: X
- Total YouTube videos: X
```

---

## Notes

- If search tools are unavailable, clearly state so and provide the search queries the user can run manually
- If a domain is very broad, scope it to a specific sub-field and note the scoping decision
- Do not invent URLs — only include links actually returned by search tools
- Prioritize English-language resources unless the user specifies otherwise
