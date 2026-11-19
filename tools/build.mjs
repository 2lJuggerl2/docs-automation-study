// Сборка статического сайта документации из Markdown.
// Источник истины — каталог docs/. Скрипт не требует сети и внешних бинарников.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcDir = path.join(root, "docs");
const outDir = path.join(root, "site");

// Якоря в кириллице: markdown-it-anchor по умолчанию кодирует id в percent-encoding.
// Свой slugify оставляет id читаемыми и в адресной строке, и на скриншоте.
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const md = new MarkdownIt({ html: true, linkify: true, typographer: false }).use(anchor, {
  slugify,
  permalink: anchor.permalink.linkInsideHeader({ symbol: "#", placement: "after" }),
});

function htmlPage({ title, nav, content }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — документация УЛР</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="index.html">УЛР · документация</a>
  <nav class="topnav">
    <a href="swagger/index.html">Swagger UI</a>
    <a href="diagrams/component.svg">Схема компонентов</a>
  </nav>
</header>
<div class="layout">
<aside class="sidebar">${nav}</aside>
<main class="content">
${content}
</main>
</div>
<footer class="footer">
Собрано из Markdown конвейером <code>tools/build.mjs</code>. Источник истины — каталог <code>docs/</code> в Git.
</footer>
</body>
</html>
`;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Порядок навигации задан префиксами файлов, но главная должна идти первой.
const order = (name) => (name === "index.md" ? "" : name);
const entries = fs
  .readdirSync(srcDir, { withFileTypes: true })
  .filter((e) => e.name.endsWith(".md"))
  .sort((a, b) => order(a.name).localeCompare(order(b.name), "ru"));

const pages = entries.map((entry) => {
  const body = fs.readFileSync(path.join(srcDir, entry.name), "utf8");
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = (titleMatch ? titleMatch[1] : entry.name.replace(/\.md$/, "")).trim();
  return { file: entry.name, page: entry.name.replace(/\.md$/, ".html"), title, body };
});

const nav = `<ul>
${pages.map((p) => `  <li><a href="${p.page}">${p.title}</a></li>`).join("\n")}
</ul>`;

for (const p of pages) {
  fs.writeFileSync(path.join(outDir, p.page), htmlPage({ title: p.title, nav, content: md.render(p.body) }), "utf8");
  fs.copyFileSync(path.join(srcDir, p.file), path.join(outDir, p.file));
}

copyDir(path.join(srcDir, "img"), path.join(outDir, "img"));
copyDir(path.join(root, "assets"), path.join(outDir, "assets"));
copyDir(path.join(root, "swagger"), path.join(outDir, "swagger"));
copyDir(path.join(root, "diagrams"), path.join(outDir, "diagrams"));

fs.copyFileSync(path.join(root, "openapi", "openapi.yaml"), path.join(outDir, "openapi.yaml"));
fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");

console.log(`Собрано страниц: ${pages.length}`);
for (const p of pages) console.log(`  docs/${p.file} -> site/${p.page}`);
