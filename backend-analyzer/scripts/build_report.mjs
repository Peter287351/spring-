#!/usr/bin/env node
/**
 * build_report.mjs —— 把 docs/analysis/ 下的 Markdown 文档集编译成
 * 单文件自包含的 report.html（内联 marked + mermaid，离线双击即开）。
 *
 * 用法：node build_report.mjs --src docs/analysis [--out docs/analysis/report.html] [--title <标题>]
 * 退出码：0 成功；1 源目录/文件缺失或 mermaid 块存在无法修复的语法问题。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const vendorDir = resolve(scriptDir, '..', 'assets', 'vendor');

// ---------- 参数 ----------
function parseArgs(argv) {
  const args = { src: 'docs/analysis', out: null, title: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--src') args.src = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--title') args.title = argv[++i];
    else { console.error(`未知参数：${argv[i]}`); process.exit(1); }
  }
  return args;
}
const args = parseArgs(process.argv);
const srcDir = resolve(args.src);
if (!statSafe(srcDir)) {
  console.error(`源目录不存在：${srcDir}`);
  process.exit(1);
}
function statSafe(p) { try { return statSync(p).isDirectory(); } catch { return false; } }

// ---------- 收集 .md ----------
function collectMd(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === 'report.html' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectMd(full, base));
    else if (name.toLowerCase().endsWith('.md')) out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}
const mdFiles = collectMd(srcDir);
if (mdFiles.length === 0) {
  console.error(`源目录下没有 .md 文件：${srcDir}`);
  process.exit(1);
}
// 排序：README 第一，00- 第二，其余按路径字母序（modules/ 自然归组）
const rank = (p) => (p === 'README.md' ? 0 : p.startsWith('00-') ? 1 : 2);
mdFiles.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'zh'));

const KNOWN_DIAGRAMS = /^(flowchart|graph|sequenceDiagram|stateDiagram|erDiagram|classDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|gitGraph|sankey|block-beta|architecture)\b/;
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 每个 mermaid 块做轻量语法把关（确定性 gate）
function lintMermaid(md, file) {
  const problems = [];
  const blocks = [...md.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)];
  blocks.forEach((m, i) => {
    const code = m[1].replace(/\r/g, '');
    const firstLine = code.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('%%')) ?? '';
    if (!KNOWN_DIAGRAMS.test(firstLine)) {
      problems.push(`${file} 第 ${i + 1} 个 mermaid 块：首行「${firstLine}」不是已知图类型`);
    }
    const open = (code.match(/\["/g) ?? []).length;
    const close = (code.match(/"\]/g) ?? []).length;
    if (open !== close) {
      problems.push(`${file} 第 ${i + 1} 个 mermaid 块：[" 与 "] 数量不等（${open}/${close}），标签引号可能未闭合`);
    }
  });
  return { problems, count: blocks.length };
}

const pages = [];
let mermaidTotal = 0;
const allProblems = [];
for (const rel of mdFiles) {
  const raw = readFileSync(join(srcDir, rel), 'utf8');
  const lint = lintMermaid(raw, rel);
  allProblems.push(...lint.problems);
  mermaidTotal += lint.count;
  const titleMatch = raw.match(/^#\s+(.+)\r?$/m);
  const slug = rel.replace(/\.md$/i, '').split('\\').join('/');
  pages.push({ slug, title: titleMatch ? titleMatch[1].trim() : slug, group: '', md: raw });
}
// 分组：README→导读；00-*→总览；modules/*→模块详解；其余→其他
for (const p of pages) {
  p.group = p.slug === 'README' ? '导读'
    : p.slug.startsWith('00-') ? '总览'
    : p.slug.startsWith('modules/') ? '模块详解'
    : '其他';
}

const reportTitle = args.title
  ?? (pages.find((p) => p.slug === 'README')?.title ?? '后端项目解析报告')
  .replace(/\s*后端项目解析\s*$/, '') + ' · 后端项目解析报告';

// ---------- vendor ----------
let markedJs, mermaidJs;
try {
  markedJs = readFileSync(join(vendorDir, 'marked.min.js'), 'utf8');
  mermaidJs = readFileSync(join(vendorDir, 'mermaid.min.js'), 'utf8');
} catch (e) {
  console.error(`读取 vendor 库失败（${e.message}）。请确认 assets/vendor/ 下有 marked.min.js 与 mermaid.min.js。`);
  process.exit(1);
}
// 防止 </script> 提前闭合标签
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

// ---------- 页面模板 ----------
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(reportTitle)}</title>
<style>
  :root {
    --bg: #f7f8fa; --panel: #ffffff; --ink: #24292f; --muted: #57606a;
    --line: #e4e7eb; --accent: #2563eb; --accent-soft: #eff4ff;
    --sidebar-w: 264px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
         background: var(--bg); color: var(--ink); }
  #app { display: flex; min-height: 100vh; }

  /* 侧边栏 */
  #sidebar { width: var(--sidebar-w); flex: 0 0 var(--sidebar-w); background: var(--panel);
             border-right: 1px solid var(--line); padding: 18px 14px; position: sticky; top: 0;
             height: 100vh; overflow-y: auto; }
  #sidebar h1 { font-size: 15px; margin: 4px 6px 14px; line-height: 1.4; }
  #sidebar .group { font-size: 12px; color: var(--muted); margin: 16px 6px 6px;
                    text-transform: uppercase; letter-spacing: .05em; }
  #sidebar a { display: block; padding: 7px 10px; border-radius: 8px; color: var(--ink);
               text-decoration: none; font-size: 13.5px; line-height: 1.45; }
  #sidebar a:hover { background: var(--accent-soft); }
  #sidebar a.active { background: var(--accent); color: #fff; }
  #menu-btn { display: none; position: fixed; z-index: 30; top: 12px; left: 12px;
              border: 1px solid var(--line); background: var(--panel); border-radius: 8px;
              padding: 6px 10px; cursor: pointer; }

  /* 正文 */
  #content { flex: 1; min-width: 0; padding: 34px 40px 90px; }
  .doc { max-width: 920px; margin: 0 auto; background: var(--panel); border: 1px solid var(--line);
         border-radius: 12px; padding: 34px 42px; }

  /* markdown 元素 */
  .doc h1 { font-size: 26px; border-bottom: 2px solid var(--line); padding-bottom: 10px; }
  .doc h2 { font-size: 21px; margin-top: 34px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
  .doc h3 { font-size: 17px; margin-top: 26px; }
  .doc code { background: #f0f2f5; border-radius: 4px; padding: 2px 5px; font-size: .9em;
              font-family: Consolas, "JetBrains Mono", monospace; }
  .doc pre { background: #f6f8fa; border: 1px solid var(--line); border-radius: 8px;
             padding: 14px 16px; overflow-x: auto; line-height: 1.55; }
  .doc pre code { background: none; padding: 0; }
  .doc table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; }
  .doc th, .doc td { border: 1px solid var(--line); padding: 7px 10px; text-align: left;
                     vertical-align: top; }
  .doc th { background: #f0f3f7; }
  .doc tr:nth-child(even) td { background: #fafbfc; }
  .doc blockquote { margin: 12px 0; padding: 8px 16px; border-left: 4px solid #f0a020;
                    background: #fff8ec; border-radius: 0 8px 8px 0; color: #6b4b12; }
  .doc a { color: var(--accent); }
  .doc li { margin: 4px 0; }
  .doc hr { border: none; border-top: 1px solid var(--line); margin: 26px 0; }

  /* 接口徽章：HTTP 方法色块 + 等宽路径，与正文文字区分 */
  .api { white-space: nowrap; }
  .api-method { display: inline-block; font: 700 11px/1.7 Consolas, "JetBrains Mono", monospace;
                padding: 0 7px; border-radius: 5px; margin-right: 5px; letter-spacing: .03em;
                vertical-align: 1px; }
  .m-get { color: #166534; background: #dcfce7; }
  .m-post { color: #1e40af; background: #dbeafe; }
  .m-put { color: #92400e; background: #fef3c7; }
  .m-delete { color: #991b1b; background: #fee2e2; }
  .m-patch { color: #6d28d9; background: #ede9fe; }
  .api-path { background: #eef1f5; border: 1px solid var(--line); padding: 1px 7px;
              border-radius: 5px; font-family: Consolas, "JetBrains Mono", monospace;
              font-size: .92em; color: var(--ink); }
  /* 证据引用（文件:行号 的 code）专门样式 */
  code.ev { background: #eef4ff; border: 1px solid #d4e2ff; border-left: 3px solid #7ea6f8;
            padding: 1px 7px; border-radius: 5px; color: #1d4ed8; }
  /* 站内跳转链接加导航箭头 */
  .doc a[href^="#"]:not(.fig-ref)::before { content: "\\00BB  "; color: var(--accent); font-weight: 700; }

  /* mermaid 图 */
  .mermaid { background: #fcfdff; border: 1px dashed var(--line); border-radius: 10px;
             padding: 16px; margin: 12px 0 16px; text-align: center; overflow-x: auto; cursor: zoom-in; }
  .mermaid svg { max-width: 100% !important; height: auto; }
  .fig-caption { text-align: center; font-size: 13.5px; color: var(--muted);
                 margin: 18px 0 0; font-weight: 600; }
  .fig-caption .fig-no { color: var(--accent); margin-right: 8px; }
  .fig-caption .fig-title { color: var(--ink); }
  .fig-ref { color: var(--accent); text-decoration: none; border-bottom: 1px dashed var(--accent); }
  .fig-ref:hover { background: var(--accent-soft); }
  #overlay { display: none; position: fixed; inset: 0; z-index: 50; background: rgba(15,18,25,.72);
             padding: 30px; cursor: zoom-out; }
  #overlay.show { display: flex; align-items: center; justify-content: center; }
  #overlay .frame { background: #fff; border-radius: 12px; max-width: 96vw; max-height: 92vh;
                    overflow: auto; padding: 20px; }
  #overlay svg { max-width: 92vw; height: auto; }

  /* 阅读进度条 */
  #progress { position: fixed; top: 0; left: 0; height: 3px; width: 0;
              background: var(--accent); z-index: 40; transition: width .15s; }

  /* 搜索 */
  #search-box { position: relative; margin: 0 6px 10px; }
  #search { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 7px 26px 7px 10px;
            font-size: 13px; outline: none; background: var(--bg); color: var(--ink); }
  #search:focus { border-color: var(--accent); }
  #search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
                  border: none; background: none; cursor: pointer; color: var(--muted); font-size: 14px; }
  #search-results { margin: 0 6px 10px; font-size: 12.5px; }
  #search-results .sr-item { display: block; padding: 6px 8px; border-radius: 6px; text-decoration: none;
                             color: var(--ink); border: 1px solid var(--line); margin-bottom: 6px;
                             background: var(--panel); }
  #search-results .sr-item:hover { border-color: var(--accent); }
  #search-results .sr-page { color: var(--accent); font-weight: 600; display: block; }
  #search-results .sr-snip { color: var(--muted); word-break: break-all; }
  #search-results .sr-snip mark { background: #ffe9a8; padding: 0 1px; }

  /* 本页目录 */
  #toc-title { font-size: 12px; color: var(--muted); margin: 16px 6px 6px; letter-spacing: .05em; }
  #toc a { display: block; padding: 4px 10px 4px 16px; font-size: 12.5px; color: var(--muted);
           text-decoration: none; border-left: 2px solid var(--line); border-radius: 0; }
  #toc a.toc-h3 { padding-left: 30px; }
  #toc a:hover { color: var(--accent); border-left-color: var(--accent); }

  /* 返回顶部 */
  #to-top { display: none; position: fixed; right: 22px; bottom: 26px; z-index: 35;
            border: 1px solid var(--line); background: var(--panel); color: var(--muted);
            border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 13px;
            box-shadow: 0 2px 10px rgba(0,0,0,.06); }
  #to-top:hover { color: var(--accent); border-color: var(--accent); }

  #pager { max-width: 920px; margin: 18px auto 0; display: flex; justify-content: space-between; gap: 12px; }
  #pager a { background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
             padding: 10px 16px; text-decoration: none; color: var(--ink); font-size: 14px; }
  #pager a:hover { border-color: var(--accent); color: var(--accent); }

  @media (max-width: 900px) {
    #sidebar { position: fixed; z-index: 20; transform: translateX(-100%);
               transition: transform .2s; }
    #sidebar.open { transform: translateX(0); }
    #menu-btn { display: block; }
    #content { padding: 54px 14px 60px; }
    .doc { padding: 22px 18px; }
  }
  @media print {
    #sidebar, #menu-btn, #pager, #to-top { display: none; }
    #content { padding: 0; }
    .doc { border: none; max-width: none; }
    .mermaid { border: none; }
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #101418; --panel: #171c22; --ink: #d7dde3; --muted: #8b98a5;
      --line: #2a323c; --accent: #5b9bff; --accent-soft: #1c2739;
    }
    .doc code { background: #232b34; }
    .doc pre { background: #1d232b; }
    .doc th { background: #1f2731; }
    .doc tr:nth-child(even) td { background: #1a2027; }
    .doc blockquote { background: #2a2416; color: #d8c07a; border-left-color: #b78a2e; }
    .mermaid { background: #141a20; }
    .mermaid svg { filter: invert(.88) hue-rotate(180deg); }
    #search-results .sr-snip mark, #search-results mark { background: #4d3f14; color: #ffd76a; }
    #overlay .frame { background: #171c22; }
    .api-path { background: #232b34; border-color: var(--line); }
    .m-get { color: #86efac; background: #14301f; }
    .m-post { color: #93c5fd; background: #16283f; }
    .m-put { color: #fcd34d; background: #33260d; }
    .m-delete { color: #fca5a5; background: #381616; }
    .m-patch { color: #c4b5fd; background: #251d3f; }
    code.ev { background: #16283f; border-color: #24354f; color: #93c5fd; }
  }
</style>
</head>
<body>
<button id="menu-btn" aria-label="目录">☰ 目录</button>
<div id="progress"></div>
<div id="app">
  <nav id="sidebar">
    <h1>${escapeHtml(reportTitle)}</h1>
    <div id="search-box">
      <input id="search" type="search" placeholder="搜索全部文档…" autocomplete="off">
      <button id="search-clear" aria-label="清除" hidden>✕</button>
    </div>
    <div id="search-results"></div>
    <div id="nav"></div>
    <div id="toc-title" hidden>本页目录</div>
    <div id="toc"></div>
  </nav>
  <main id="content">
    <div class="doc" id="doc"></div>
    <div id="pager"></div>
  </main>
</div>
<div id="overlay"><div class="frame" id="overlay-frame"></div></div>
<button id="to-top" aria-label="返回顶部">↑ 顶部</button>

<script>${safeJs(markedJs)}</script>
<script>${safeJs(mermaidJs)}</script>
<script>
const PAGES = ${safeJs(JSON.stringify(pages))};

// ---- 路由 ----
// hash 三种形态：#/slug（切页）、#/slug@anchor（切页+滚动）、#anchor（当前页内滚动，不切页）
function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\\/?/, ''));
  if (PAGES.some((p) => p.slug === h)) return { slug: h, anchor: '' };
  if (h.includes('@')) {
    const parts = h.split('@');
    const s = parts.shift();
    if (PAGES.some((p) => p.slug === s)) return { slug: s, anchor: parts.join('@') };
  }
  return { slug: null, anchor: h };
}
let current = PAGES[0].slug; // 裸锚点 hash 切换时停留的页面

// ---- markdown → html ----
function headingId(text) {
  return 'h-' + encodeURIComponent(text.trim());
}
function escapeHtml_(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// 用 marked 默认渲染，再做 DOM 后处理：mermaid 代码块 → 渲染容器、标题补 id、
// 图标题条 + "图 N-M" 交叉引用。
// 不自定义 renderer：marked v12 的 use({renderer}) 会破坏全局 parse。
function renderDoc(md) {
  const host = document.createElement('div');
  // 图号锚点目标含空格（#图 3-2），CommonMark 要求 <> 包裹，否则整条链接按字面输出
  md = md.replace(/\\]\\(#(图\\s*\\d+-\\d+)\\)/g, '](<#$1>)');
  host.innerHTML = marked.parse(md);
  // mermaid 代码块：提取块内第一行「%% 图 N-M 标题」作可见标题条
  host.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    const raw = code.textContent;
    const m = raw.match(/^\\s*%%\\s*(图\\s*\\d+-\\d+[^\\n]*)/m);
    if (m) {
      div.dataset.figNo = m[1].replace(/\\s+/g, ' ').trim();
      div.textContent = raw.replace(m[0], '').replace(/^\\n+/, '');
    } else {
      div.textContent = raw;
    }
    code.parentElement.replaceWith(div);
  });
  host.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    h.id = headingId(h.textContent);
  });
  // 兜底：块内没有标题注释、但紧邻块前有「%% 图 N-M …」段落的（旧式写法），提取为标题并移除裸段落
  host.querySelectorAll('div.mermaid:not([data-fig-no])').forEach((div) => {
    const prev = div.previousElementSibling;
    if (prev && prev.tagName === 'P') {
      const m = prev.textContent.match(/^\s*%%?\\s*(图\\s*\\d+-\\d+.*$)/);
      if (m) {
        div.dataset.figNo = m[1].replace(/\\s+/g, ' ').trim();
        prev.remove();
      }
    }
  });
  // 图标题条：插在图容器之前
  host.querySelectorAll('div.mermaid[data-fig-no]').forEach((div) => {
    const no = div.dataset.figNo;
    const cap = document.createElement('div');
    cap.className = 'fig-caption';
    const noMatch = no.match(/^(图\\s*\\d+-\\d+)\\s*(.*)$/);
    cap.id = 'fig-' + encodeURIComponent(noMatch[1]);
    cap.innerHTML = '<span class="fig-no">' + escapeHtml_(noMatch[1]) + '</span>' +
      (noMatch[2] ? '<span class="fig-title">' + escapeHtml_(noMatch[2]) + '</span>' : '');
    div.parentElement.insertBefore(cap, div);
  });
  // 交叉引用：段落/表格/列表/引用中的「图 N-M」→ 指向本页或跨页的图标题条
  const figIds = new Set(Array.from(host.querySelectorAll('.fig-caption')).map((c) => c.id));
  host.querySelectorAll('p, td, li, blockquote').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('pre, code, a, .mermaid')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    targets.forEach((node) => {
      const text = node.textContent;
      if (!/图\\s*\\d+-\\d+/.test(text)) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      const re = /图\\s*\\d+-\\d+/g;
      let m2;
      while ((m2 = re.exec(text)) !== null) {
        const no = m2[0].replace(/\\s+/g, ' ');
        const id = 'fig-' + encodeURIComponent(no);
        frag.appendChild(document.createTextNode(text.slice(last, m2.index)));
        if (figIds.has(id)) {
          const a = document.createElement('a');
          a.className = 'fig-ref';
          a.href = '#' + no;
          a.textContent = no;
          frag.appendChild(a);
        } else {
          frag.appendChild(document.createTextNode(m2[0]));
        }
        last = m2.index + m2[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentElement.replaceChild(frag, node);
    });
  });
  // 接口徽章：正文/表格/列表里的「METHOD /路径」自动变成方法色块 + 等宽路径
  const API_RE = /\\b(GET|POST|PUT|DELETE|PATCH)(\\s+)(\\/[A-Za-z0-9\\-._~!$&'()*+,;=:@%?{}]+)/g;
  const API_TEST = /\\b(GET|POST|PUT|DELETE|PATCH)\\s+\\//;
  function apiBadge(method, path) {
    const span = document.createElement('span');
    span.className = 'api';
    const m = document.createElement('span');
    m.className = 'api-method m-' + method.toLowerCase();
    m.textContent = method;
    span.appendChild(m);
    if (path) {
      const p = document.createElement('code');
      p.className = 'api-path';
      p.textContent = path;
      span.appendChild(p);
    }
    return span;
  }
  const apiTargets = [];
  host.querySelectorAll('p, td, li, blockquote, h2, h3, h4').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('pre, code, a, .mermaid, .api')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (walker.nextNode()) if (API_TEST.test(walker.currentNode.textContent)) apiTargets.push(walker.currentNode);
  });
  apiTargets.forEach((node) => {
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    let last = 0;
    API_RE.lastIndex = 0;
    let m3;
    while ((m3 = API_RE.exec(text)) !== null) {
      frag.appendChild(document.createTextNode(text.slice(last, m3.index)));
      frag.appendChild(apiBadge(m3[1], m3[3]));
      last = m3.index + m3[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentElement.replaceChild(frag, node);
  });
  // 表格里的纯方法单元格 → 方法色块；纯路径单元格 → 等宽路径样式
  host.querySelectorAll('td').forEach((td) => {
    const t = td.textContent.trim();
    if (/^(GET|POST|PUT|DELETE|PATCH)$/.test(t)) {
      td.innerHTML = '';
      td.appendChild(apiBadge(t, ''));
    } else if (/^\\//.test(t) && t.length < 80 && !td.querySelector('*')) {
      const code = document.createElement('code');
      code.className = 'api-path';
      code.textContent = t;
      td.replaceChildren(code);
    }
  });
  // 证据引用：内容是「文件.扩展名:行号」的 code 加专门样式
  host.querySelectorAll('code').forEach((c) => {
    if (c.classList.contains('api-path')) return;
    if (/^[\\w./\\\\-]+\\.(java|xml|yml|yaml|properties|sql|kt|kts|gradle|groovy|md)(:\\d+){0,2}$/i.test(c.textContent.trim())) {
      c.classList.add('ev');
    }
  });
  return host;
}
// 把指向其它文档的 .md 链接改写为站内路由
function rewriteLinks(md, fromSlug) {
  const fromDir = fromSlug.includes('/') ? fromSlug.slice(0, fromSlug.lastIndexOf('/') + 1) : '';
  return md.replace(/\\]\\(([^)]+\\.md)([^)]*)\\)/g, (m, target, frag) => {
    const clean = target.replace(/^\\.\\//, '');
    const abs = (clean.includes('/') ? clean : fromDir + clean).split('/').reduce((acc, part) => {
      if (part === '..') acc.pop(); else if (part !== '.') acc.push(part); return acc;
    }, []).join('/');
    const slug = abs.replace(/\\.md$/i, '');
    const anchor = frag.startsWith('#') ? '@' + frag.slice(1) : '';
    return '](' + (PAGES.some((p) => p.slug === slug)
      ? '#/' + encodeURIComponent(slug) + anchor
      : target + frag) + ')';
  });
}

function renderNav(activeSlug) {
  const nav = document.getElementById('nav');
  const groups = [];
  PAGES.forEach((p, i) => {
    let g = groups.find((x) => x.name === p.group);
    if (!g) { g = { name: p.group, items: [] }; groups.push(g); }
    g.items.push({ ...p, index: i });
  });
  nav.innerHTML = groups.map((g) =>
    '<div class="group">' + g.name + '</div>' +
    g.items.map((it) =>
      '<a href="#/' + encodeURIComponent(it.slug) + '" data-slug="' + it.slug + '"' +
      (it.slug === activeSlug ? ' class="active"' : '') + '>' + escapeHtml_(it.title) + '</a>'
    ).join('')
  ).join('');
}

async function renderPage() {
  const { slug: routeSlug, anchor } = parseHash();
  const page = PAGES.find((p) => p.slug === (routeSlug ?? current)) ?? PAGES[0];
  const doc = document.getElementById('doc');
  const needRender = page.slug !== current || !doc.hasChildNodes();
  current = page.slug;
  if (needRender) {
    const idx = PAGES.indexOf(page);
    const host = renderDoc(rewriteLinks(page.md, page.slug));
    doc.replaceChildren(...host.childNodes);
    document.title = page.title + ' · 后端项目解析报告';
    renderNav(page.slug);
    // 上一页/下一页
    const prev = PAGES[idx - 1], next = PAGES[idx + 1];
    document.getElementById('pager').innerHTML =
      (prev ? '<a href="#/' + encodeURIComponent(prev.slug) + '">← ' + escapeHtml_(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a href="#/' + encodeURIComponent(next.slug) + '">' + escapeHtml_(next.title) + ' →</a>' : '<span></span>');
    // 渲染 mermaid
    const nodes = doc.querySelectorAll('.mermaid:not([data-processed])');
    if (nodes.length) {
      try { await mermaid.run({ nodes: Array.from(nodes) }); }
      catch (e) { console.error('mermaid 渲染失败：', e); }
    }
    fillToc(page);
  }
  // 锚点滚动：先精确匹配标题 id，匹配不到再按"标题文本包含锚点词"回退
  // （文档里常写 #优化建议 这类短锚点，而实际标题是「5. 优化建议」）
  if (anchor) {
    let el = document.getElementById('h-' + encodeURIComponent(anchor))
      || document.getElementById('fig-' + encodeURIComponent(anchor));
    if (!el) {
      const wanted = anchor.toLowerCase();
      el = Array.from(doc.querySelectorAll('h1, h2, h3, h4'))
        .find((h) => h.textContent.toLowerCase().includes(wanted))
        || Array.from(doc.querySelectorAll('.fig-caption'))
          .find((c) => c.textContent.toLowerCase().includes(wanted));
    }
    if (el) el.scrollIntoView({ block: 'start' });
  } else if (needRender) {
    window.scrollTo(0, 0);
  }
  document.getElementById('sidebar').classList.remove('open');
}

// ---- 图点击放大 ----
document.addEventListener('click', (e) => {
  const fig = e.target.closest('.mermaid');
  if (fig && !e.target.closest('#overlay')) {
    const svg = fig.querySelector('svg');
    if (svg) {
      document.getElementById('overlay-frame').innerHTML = svg.outerHTML;
      document.getElementById('overlay').classList.add('show');
    }
  }
});
document.getElementById('overlay').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
});
document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});
window.addEventListener('hashchange', renderPage);

// ---- 本页目录 ----
function fillToc(page) {
  const toc = document.getElementById('toc');
  const titleEl = document.getElementById('toc-title');
  const heads = Array.from(document.querySelectorAll('#doc h2, #doc h3'));
  if (heads.length === 0) { toc.innerHTML = ''; titleEl.hidden = true; return; }
  titleEl.hidden = false;
  toc.innerHTML = heads.map((h) =>
    '<a class="toc-' + h.tagName.toLowerCase() + '" href="#/' + encodeURIComponent(page.slug) +
    '@' + encodeURIComponent(h.textContent) + '">' + escapeHtml_(h.textContent) + '</a>'
  ).join('');
}

// ---- 搜索（跨页全文） ----
const searchInput = document.getElementById('search');
const searchResults = document.getElementById('search-results');
const searchClear = document.getElementById('search-clear');
let searchTimer = null;
function highlight(text, kw) {
  const i = text.toLowerCase().indexOf(kw.toLowerCase());
  if (i < 0) return escapeHtml_(text);
  return escapeHtml_(text.slice(0, i)) + '<mark>' + escapeHtml_(text.slice(i, i + kw.length)) + '</mark>' +
    escapeHtml_(text.slice(i + kw.length));
}
function doSearch(q) {
  q = q.trim();
  searchClear.hidden = !q;
  if (!q) { searchResults.innerHTML = ''; return; }
  const lq = q.toLowerCase();
  const hits = [];
  PAGES.forEach((p) => {
    let count = 0;
    p.md.split('\\n').forEach((line) => {
      if (count >= 3 || hits.length >= 20) return;
      if (line.trim() && line.toLowerCase().indexOf(lq) >= 0) {
        count++;
        hits.push({ page: p, line: line.trim().slice(0, 90) });
      }
    });
  });
  searchResults.innerHTML = hits.length === 0
    ? '<div class="sr-item"><span class="sr-snip">没有匹配内容</span></div>'
    : hits.map((h) =>
        '<a class="sr-item" href="#/' + encodeURIComponent(h.page.slug) + '">' +
        '<span class="sr-page">' + escapeHtml_(h.page.title) + '</span>' +
        '<span class="sr-snip">' + highlight(h.line, q) + '</span></a>'
      ).join('');
}
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(searchInput.value), 200);
});
searchClear.addEventListener('click', () => { searchInput.value = ''; doSearch(''); searchInput.focus(); });
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchInput.value = ''; doSearch(''); searchInput.blur(); }
});

// ---- 键盘翻页（← →） ----
document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const idx = PAGES.findIndex((p) => p.slug === current);
  if (e.key === 'ArrowRight' && PAGES[idx + 1]) location.hash = '#/' + encodeURIComponent(PAGES[idx + 1].slug);
  if (e.key === 'ArrowLeft' && PAGES[idx - 1]) location.hash = '#/' + encodeURIComponent(PAGES[idx - 1].slug);
});

// ---- 阅读进度条 + 返回顶部 ----
const progress = document.getElementById('progress');
const toTop = document.getElementById('to-top');
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  toTop.style.display = window.scrollY > 400 ? 'block' : 'none';
}, { passive: true });
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#eff4ff', primaryBorderColor: '#2563eb', primaryTextColor: '#1f2937',
    lineColor: '#64748b', fontSize: '14px',
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
  },
  securityLevel: 'loose',
  flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
  sequence: { useMaxWidth: true, actorFontFamily: 'inherit', noteFontFamily: 'inherit', messageFontFamily: 'inherit' }
});
renderPage();
</script>
</body>
</html>
`;

const outPath = resolve(args.out ?? join(srcDir, 'report.html'));
writeFileSync(outPath, html, 'utf8');

console.log(`已生成：${outPath}`);
console.log(`页面数：${pages.length}（${pages.map((p) => p.slug).join('、')}）`);
console.log(`mermaid 图：${mermaidTotal} 个；文件大小：${(html.length / 1024 / 1024).toFixed(2)} MB`);
if (allProblems.length) {
  console.error('\nmermaid 语法问题：');
  for (const p of allProblems) console.error('  - ' + p);
  process.exit(1);
}
