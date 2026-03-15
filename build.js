#!/usr/bin/env node
/**
 * Static site generator for Agency Agents.
 * Zero dependencies — uses only Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DOCS_DIR = path.join(ROOT, 'docs');
const AGENTS_DIR = path.join(DOCS_DIR, 'agents');

const SKIP_DIRS = new Set(['.git', '.github', 'docs', 'scripts', 'examples', '__pycache__', 'node_modules']);
const SKIP_FILES = new Set(['README.md', 'CONTRIBUTING.md', 'LICENSE']);

const CATEGORY_META = {
  'design': ['Design', '🎨'],
  'engineering': ['Engineering', '⚙️'],
  'examples': ['Examples', '📝'],
  'game-development': ['Game Development', '🎮'],
  'integrations': ['Integrations', '🔗'],
  'marketing': ['Marketing', '📢'],
  'paid-media': ['Paid Media', '💰'],
  'product': ['Product', '📦'],
  'project-management': ['Project Management', '📋'],
  'sales': ['Sales', '💼'],
  'spatial-computing': ['Spatial Computing', '🥽'],
  'specialized': ['Specialized', '🔧'],
  'strategy': ['Strategy', '♟️'],
  'support': ['Support', '🤝'],
  'testing': ['Testing', '🧪'],
};

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return [{}, text];
  const fmText = match[1];
  const body = text.slice(match[0].length);
  const meta = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = val;
    }
  }
  return [meta, body];
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let i = 0;
  let inList = false;
  let listType = '';
  let inBlockquote = false;

  function closeList() {
    if (inList) {
      html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
      inList = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      html += '</blockquote>\n';
      inBlockquote = false;
    }
  }

  function inlineFormat(text) {
    // Code spans first
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold+italic
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return text;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (line.match(/^```/)) {
      closeList();
      closeBlockquote();
      const lang = line.slice(3).trim();
      let code = '';
      i++;
      while (i < lines.length && !lines[i].match(/^```/)) {
        code += escapeHtml(lines[i]) + '\n';
        i++;
      }
      html += `<pre><code>${code}</code></pre>\n`;
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      closeList();
      closeBlockquote();
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineFormat(headingMatch[2])}</h${level}>\n`;
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      closeList();
      closeBlockquote();
      html += '<hr>\n';
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+[-| :]*$/)) {
      closeList();
      closeBlockquote();
      const headerCells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      html += '<table>\n<thead><tr>';
      for (const cell of headerCells) {
        html += `<th>${inlineFormat(cell)}</th>`;
      }
      html += '</tr></thead>\n<tbody>\n';
      i += 2; // skip header and separator
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '');
        html += '<tr>';
        for (const cell of cells) {
          html += `<td>${inlineFormat(cell)}</td>`;
        }
        html += '</tr>\n';
        i++;
      }
      html += '</tbody></table>\n';
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s?(.*)/);
    if (bqMatch) {
      closeList();
      if (!inBlockquote) {
        html += '<blockquote>\n';
        inBlockquote = true;
      }
      html += `<p>${inlineFormat(bqMatch[1])}</p>\n`;
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      closeBlockquote();
      if (!inList || listType !== 'ul') {
        closeList();
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      html += `<li>${inlineFormat(ulMatch[2])}</li>\n`;
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
      closeBlockquote();
      if (!inList || listType !== 'ol') {
        closeList();
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      html += `<li>${inlineFormat(olMatch[2])}</li>\n`;
      i++;
      continue;
    }

    // Paragraph
    closeList();
    closeBlockquote();
    html += `<p>${inlineFormat(line)}</p>\n`;
    i++;
  }

  closeList();
  closeBlockquote();
  return html;
}

function walkDir(dir, agents, rootDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkDir(path.join(dir, entry.name), agents, rootDir);
    } else if (entry.isFile() && entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
      const filepath = path.join(dir, entry.name);
      const rel = path.relative(rootDir, dir);
      const parts = rel.split(path.sep);
      if (!parts[0] || rel === '.') continue;

      const category = parts[0];
      const subcategory = parts.length > 1 ? parts.slice(1).join('/') : null;

      const text = fs.readFileSync(filepath, 'utf-8');
      const [meta, body] = parseFrontmatter(text);
      if (!meta.name) return;

      const slug = entry.name.replace('.md', '');
      agents.push({
        name: meta.name || slug,
        description: meta.description || '',
        color: meta.color || '#6366f1',
        emoji: meta.emoji || '🤖',
        vibe: meta.vibe || '',
        category,
        subcategory,
        slug,
        body_html: markdownToHtml(body),
        source_path: path.relative(rootDir, filepath),
      });
    }
  }
}

const CSS = `\
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

.search-bar {
  width: 100%; padding: 0.75rem 1rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text); font-size: 1rem;
  margin-bottom: 1.5rem; outline: none;
  transition: border-color 0.2s;
}
.search-bar:focus { border-color: var(--accent); }

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

.stats {
  display: flex; gap: 1.5rem; margin-bottom: 2rem;
  color: var(--text-muted); font-size: 0.9rem;
}
.stats strong { color: var(--text); }

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
`;

function buildIndexPage(agents, categories) {
  const agentsJson = JSON.stringify(agents.map(a => ({
    name: a.name, description: a.description, emoji: a.emoji,
    vibe: a.vibe, category: a.category, subcategory: a.subcategory,
    slug: a.slug, color: a.color,
  })));

  let filterButtons = '';
  for (const cat of [...categories].sort()) {
    const [label, icon] = CATEGORY_META[cat] || [cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), '📁'];
    const count = agents.filter(a => a.category === cat).length;
    filterButtons += `<button class="filter-btn" data-cat="${cat}">${icon} ${label} (${count})</button>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Agency - AI Specialists</title>
<meta name="description" content="A complete AI agency at your fingertips. ${agents.length} specialized AI agent personalities ready to transform your workflow.">
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
  <input type="text" class="search-bar" id="search" placeholder="Search ${agents.length} agents..." autofocus>
  <div class="filters">
    <button class="filter-btn active" data-cat="all">All (${agents.length})</button>
    ${filterButtons}
  </div>
  <div class="stats" id="stats">
    <span><strong>${agents.length}</strong> agents</span>
    <span><strong>${categories.size}</strong> categories</span>
  </div>
  <div class="agent-grid" id="grid"></div>
</div>
<script>
const agents = ${agentsJson};
const grid = document.getElementById('grid');
const search = document.getElementById('search');
const stats = document.getElementById('stats');
let activeCategory = 'all';

function renderAgents(list) {
  grid.innerHTML = list.map(a => \`
    <a class="agent-card" href="agents/\${a.slug}.html" style="--card-color: \${a.color}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:\${a.color}"></div>
      <div class="emoji">\${a.emoji}</div>
      <div class="name">\${a.name}</div>
      <div class="vibe">\${a.vibe}</div>
      <div class="category-badge">\${a.subcategory ? a.category + ' / ' + a.subcategory : a.category}</div>
    </a>
  \`).join('');
  stats.innerHTML = \`<span><strong>\${list.length}</strong> agents shown</span>\`;
}

function filterAgents() {
  const q = search.value.toLowerCase();
  let filtered = agents;
  if (activeCategory !== 'all') {
    filtered = filtered.filter(a => a.category === activeCategory);
  }
  if (q) {
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.vibe.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.subcategory && a.subcategory.toLowerCase().includes(q))
    );
  }
  renderAgents(filtered);
}

search.addEventListener('input', filterAgents);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    filterAgents();
  });
});

renderAgents(agents);
</script>
</body>
</html>`;
}

function buildAgentPage(agent) {
  const githubUrl = `https://github.com/msitarzewski/agency-agents/blob/main/${agent.source_path}`;
  const subLabel = agent.subcategory ? ` / ${agent.subcategory}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${agent.emoji} ${agent.name} - The Agency</title>
<meta name="description" content="${agent.description.slice(0, 160)}">
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
    <div class="emoji">${agent.emoji}</div>
    <div class="info">
      <h2>${agent.name}</h2>
      <p class="desc">${agent.description}</p>
      <p class="vibe">"${agent.vibe}"</p>
      <div class="category-badge" style="margin-top:0.5rem">${agent.category}${subLabel}</div>
    </div>
  </div>
  <div class="agent-body">
    ${agent.body_html}
  </div>
  <div class="agent-source">
    📄 <a href="${githubUrl}" target="_blank">View source on GitHub</a>
  </div>
</div>
</body>
</html>`;
}

function main() {
  // Clean output
  if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true });
  }
  fs.mkdirSync(DOCS_DIR);
  fs.mkdirSync(AGENTS_DIR);

  // Collect agents
  const agents = [];
  walkDir(ROOT, agents, ROOT);
  agents.sort((a, b) => {
    const cmp = a.category.localeCompare(b.category);
    if (cmp !== 0) return cmp;
    const sub = (a.subcategory || '').localeCompare(b.subcategory || '');
    if (sub !== 0) return sub;
    return a.name.localeCompare(b.name);
  });
  const categories = new Set(agents.map(a => a.category));

  console.log(`Found ${agents.length} agents in ${categories.size} categories`);

  // Write CSS
  fs.writeFileSync(path.join(DOCS_DIR, 'style.css'), CSS);

  // Write .nojekyll
  fs.writeFileSync(path.join(DOCS_DIR, '.nojekyll'), '');

  // Write index
  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), buildIndexPage(agents, categories));

  // Write agent pages
  for (const agent of agents) {
    fs.writeFileSync(path.join(AGENTS_DIR, `${agent.slug}.html`), buildAgentPage(agent));
  }

  console.log(`Site built in docs/`);
  console.log(`  - ${agents.length} agent pages`);
  console.log(`  - index.html with search and filtering`);
}

main();
