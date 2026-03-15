#!/usr/bin/env python3
"""Static site generator for Agency Agents."""

import os
import re
import json
import shutil
import markdown
from pathlib import Path

ROOT = Path(__file__).parent
DOCS_DIR = ROOT / "docs"
AGENTS_DIR = DOCS_DIR / "agents"

# Directories to scan for agent .md files
SKIP_DIRS = {".git", ".github", "docs", "scripts", "examples", "__pycache__"}
SKIP_FILES = {"README.md", "CONTRIBUTING.md", "LICENSE"}

# Category display names and icons
CATEGORY_META = {
    "design": ("Design", "🎨"),
    "engineering": ("Engineering", "⚙️"),
    "examples": ("Examples", "📝"),
    "game-development": ("Game Development", "🎮"),
    "integrations": ("Integrations", "🔗"),
    "marketing": ("Marketing", "📢"),
    "paid-media": ("Paid Media", "💰"),
    "product": ("Product", "📦"),
    "project-management": ("Project Management", "📋"),
    "sales": ("Sales", "💼"),
    "spatial-computing": ("Spatial Computing", "🥽"),
    "specialized": ("Specialized", "🔧"),
    "strategy": ("Strategy", "♟️"),
    "support": ("Support", "🤝"),
    "testing": ("Testing", "🧪"),
}


def parse_frontmatter(text):
    """Extract YAML frontmatter from markdown text."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not match:
        return {}, text
    fm_text = match.group(1)
    body = text[match.end():]
    meta = {}
    for line in fm_text.split("\n"):
        if ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip().strip('"').strip("'")
    return meta, body


def collect_agents():
    """Walk the repo and collect all agent markdown files."""
    agents = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        rel = Path(dirpath).relative_to(ROOT)
        parts = rel.parts
        if not parts or str(rel) == ".":
            # top-level files, skip
            continue
        category = parts[0]
        subcategory = "/".join(parts[1:]) if len(parts) > 1 else None

        for fname in sorted(filenames):
            if fname in SKIP_FILES or not fname.endswith(".md"):
                continue
            filepath = Path(dirpath) / fname
            text = filepath.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(text)
            if not meta.get("name"):
                continue
            slug = fname.replace(".md", "")
            agents.append({
                "name": meta.get("name", slug),
                "description": meta.get("description", ""),
                "color": meta.get("color", "#6366f1"),
                "emoji": meta.get("emoji", "🤖"),
                "vibe": meta.get("vibe", ""),
                "category": category,
                "subcategory": subcategory,
                "slug": slug,
                "body_html": markdown.markdown(body, extensions=["tables", "fenced_code"]),
                "source_path": str(filepath.relative_to(ROOT)),
            })
    return agents


def color_css(color):
    """Normalize color to CSS-safe value."""
    if color.startswith("#"):
        return color
    # named colors
    return color


CSS = """\
:root {
  --bg: #0f1117;
  --surface: #1a1d27;
  --surface2: #242836;
  --border: #2e3345;
  --text: #e4e4e7;
  --text-muted: #9ca3af;
  --accent: #818cf8;
  --accent-hover: #6366f1;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); text-decoration: underline; }

.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 1.5rem 2rem;
  position: sticky; top: 0; z-index: 100;
}
.header-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  flex-wrap: wrap;
}
.header h1 { font-size: 1.4rem; font-weight: 700; }
.header h1 span { color: var(--accent); }
.header-links { display: flex; gap: 1rem; align-items: center; }
.header-links a {
  color: var(--text-muted); font-size: 0.9rem;
  padding: 0.4rem 0.8rem; border-radius: 6px;
  transition: all 0.2s;
}
.header-links a:hover { background: var(--surface2); color: var(--text); text-decoration: none; }

.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

/* Search */
.search-bar {
  width: 100%; padding: 0.75rem 1rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text); font-size: 1rem;
  margin-bottom: 1.5rem; outline: none;
  transition: border-color 0.2s;
}
.search-bar:focus { border-color: var(--accent); }

/* Category filters */
.filters {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  margin-bottom: 2rem;
}
.filter-btn {
  padding: 0.4rem 0.9rem; border-radius: 20px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer; font-size: 0.85rem;
  transition: all 0.2s;
}
.filter-btn:hover, .filter-btn.active {
  background: var(--accent); color: #fff; border-color: var(--accent);
}

/* Stats */
.stats {
  display: flex; gap: 1.5rem; margin-bottom: 2rem;
  color: var(--text-muted); font-size: 0.9rem;
}
.stats strong { color: var(--text); }

/* Agent grid */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}
.agent-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s;
  cursor: pointer;
  display: flex; flex-direction: column; gap: 0.5rem;
  text-decoration: none !important;
  color: var(--text) !important;
  position: relative;
  overflow: hidden;
}
.agent-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
}
.agent-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(99,102,241,0.15);
  text-decoration: none !important;
}
.agent-card .emoji { font-size: 1.6rem; }
.agent-card .name { font-size: 1.05rem; font-weight: 600; }
.agent-card .vibe {
  font-size: 0.85rem; color: var(--text-muted);
  font-style: italic;
}
.agent-card .category-badge {
  display: inline-block; padding: 0.2rem 0.6rem;
  background: var(--surface2); border-radius: 12px;
  font-size: 0.75rem; color: var(--text-muted);
  width: fit-content;
}

/* Agent detail page */
.back-link {
  display: inline-flex; align-items: center; gap: 0.3rem;
  color: var(--text-muted); margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
.back-link:hover { color: var(--accent); }
.agent-header {
  display: flex; align-items: flex-start; gap: 1rem;
  margin-bottom: 2rem;
}
.agent-header .emoji { font-size: 3rem; }
.agent-header .info h2 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.3rem; }
.agent-header .info .desc { color: var(--text-muted); font-size: 1rem; margin-bottom: 0.5rem; }
.agent-header .info .vibe { font-style: italic; color: var(--accent); font-size: 0.95rem; }
.agent-body {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  line-height: 1.8;
}
.agent-body h1, .agent-body h2, .agent-body h3, .agent-body h4 {
  margin-top: 1.5rem; margin-bottom: 0.75rem;
  color: var(--text);
}
.agent-body h1 { font-size: 1.5rem; }
.agent-body h2 { font-size: 1.3rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.agent-body h3 { font-size: 1.1rem; }
.agent-body ul, .agent-body ol {
  padding-left: 1.5rem; margin: 0.5rem 0;
}
.agent-body li { margin: 0.3rem 0; }
.agent-body code {
  background: var(--surface2); padding: 0.15rem 0.4rem;
  border-radius: 4px; font-size: 0.9em;
}
.agent-body pre {
  background: var(--surface2); padding: 1rem;
  border-radius: 8px; overflow-x: auto;
  margin: 0.75rem 0;
}
.agent-body pre code { background: none; padding: 0; }
.agent-body blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 1rem; margin: 0.75rem 0;
  color: var(--text-muted);
}
.agent-body table {
  width: 100%; border-collapse: collapse; margin: 0.75rem 0;
}
.agent-body th, .agent-body td {
  padding: 0.5rem 0.75rem; border: 1px solid var(--border);
  text-align: left;
}
.agent-body th { background: var(--surface2); }
.agent-source {
  margin-top: 1.5rem; padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.85rem; color: var(--text-muted);
}
.agent-source a { color: var(--accent); }

@media (max-width: 640px) {
  .container { padding: 1rem; }
  .agent-grid { grid-template-columns: 1fr; }
  .header-inner { flex-direction: column; align-items: flex-start; }
}
"""


def build_index_page(agents, categories):
    """Generate the main index.html."""
    agents_json = json.dumps([{
        "name": a["name"],
        "description": a["description"],
        "emoji": a["emoji"],
        "vibe": a["vibe"],
        "category": a["category"],
        "subcategory": a["subcategory"],
        "slug": a["slug"],
        "color": a["color"],
    } for a in agents])

    filter_buttons = ""
    for cat in sorted(categories):
        label, icon = CATEGORY_META.get(cat, (cat.replace("-", " ").title(), "📁"))
        count = sum(1 for a in agents if a["category"] == cat)
        filter_buttons += f'<button class="filter-btn" data-cat="{cat}">{icon} {label} ({count})</button>\n'

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Agency - AI Specialists</title>
<meta name="description" content="A complete AI agency at your fingertips. {len(agents)} specialized AI agent personalities ready to transform your workflow.">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="header">
  <div class="header-inner">
    <h1>🎭 <span>The Agency</span></h1>
    <div class="header-links">
      <a href="https://github.com/msitarzewski/agency-agents" target="_blank">GitHub</a>
    </div>
  </div>
</div>
<div class="container">
  <input type="text" class="search-bar" id="search" placeholder="Search {len(agents)} agents..." autofocus>
  <div class="filters">
    <button class="filter-btn active" data-cat="all">All ({len(agents)})</button>
    {filter_buttons}
  </div>
  <div class="stats" id="stats">
    <span><strong>{len(agents)}</strong> agents</span>
    <span><strong>{len(categories)}</strong> categories</span>
  </div>
  <div class="agent-grid" id="grid"></div>
</div>
<script>
const agents = {agents_json};
const grid = document.getElementById('grid');
const search = document.getElementById('search');
const stats = document.getElementById('stats');
let activeCategory = 'all';

function renderAgents(list) {{
  grid.innerHTML = list.map(a => `
    <a class="agent-card" href="agents/${{a.slug}}.html" style="--card-color: ${{a.color}}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${{a.color}}"></div>
      <div class="emoji">${{a.emoji}}</div>
      <div class="name">${{a.name}}</div>
      <div class="vibe">${{a.vibe}}</div>
      <div class="category-badge">${{a.subcategory ? a.category + ' / ' + a.subcategory : a.category}}</div>
    </a>
  `).join('');
  stats.innerHTML = `<span><strong>${{list.length}}</strong> agents shown</span>`;
}}

function filterAgents() {{
  const q = search.value.toLowerCase();
  let filtered = agents;
  if (activeCategory !== 'all') {{
    filtered = filtered.filter(a => a.category === activeCategory);
  }}
  if (q) {{
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.vibe.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.subcategory && a.subcategory.toLowerCase().includes(q))
    );
  }}
  renderAgents(filtered);
}}

search.addEventListener('input', filterAgents);

document.querySelectorAll('.filter-btn').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    filterAgents();
  }});
}});

renderAgents(agents);
</script>
</body>
</html>"""


def build_agent_page(agent):
    """Generate an individual agent detail page."""
    github_url = f"https://github.com/msitarzewski/agency-agents/blob/main/{agent['source_path']}"
    sub_label = f" / {agent['subcategory']}" if agent['subcategory'] else ""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{agent['emoji']} {agent['name']} - The Agency</title>
<meta name="description" content="{agent['description'][:160]}">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<div class="header">
  <div class="header-inner">
    <h1><a href="../index.html" style="color:inherit;text-decoration:none">🎭 <span>The Agency</span></a></h1>
    <div class="header-links">
      <a href="https://github.com/msitarzewski/agency-agents" target="_blank">GitHub</a>
    </div>
  </div>
</div>
<div class="container">
  <a href="../index.html" class="back-link">← Back to all agents</a>
  <div class="agent-header">
    <div class="emoji">{agent['emoji']}</div>
    <div class="info">
      <h2>{agent['name']}</h2>
      <p class="desc">{agent['description']}</p>
      <p class="vibe">"{agent['vibe']}"</p>
      <div class="category-badge" style="margin-top:0.5rem">{agent['category']}{sub_label}</div>
    </div>
  </div>
  <div class="agent-body">
    {agent['body_html']}
  </div>
  <div class="agent-source">
    📄 <a href="{github_url}" target="_blank">View source on GitHub</a>
  </div>
</div>
</body>
</html>"""


def main():
    # Clean output
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    DOCS_DIR.mkdir()
    AGENTS_DIR.mkdir()

    # Collect agents
    agents = collect_agents()
    agents.sort(key=lambda a: (a["category"], a.get("subcategory") or "", a["name"]))
    categories = sorted(set(a["category"] for a in agents))

    print(f"Found {len(agents)} agents in {len(categories)} categories")

    # Write CSS
    (DOCS_DIR / "style.css").write_text(CSS)

    # Write index
    (DOCS_DIR / "index.html").write_text(build_index_page(agents, categories))

    # Write agent pages
    for agent in agents:
        (AGENTS_DIR / f"{agent['slug']}.html").write_text(build_agent_page(agent))

    print(f"Site built in {DOCS_DIR}/")
    print(f"  - {len(agents)} agent pages")
    print(f"  - index.html with search and filtering")


if __name__ == "__main__":
    main()
