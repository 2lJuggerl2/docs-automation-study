// Линтер документации. Запускается до сборки: если проверка не прошла,
// конвейер останавливается и не публикует сломанный сайт.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const docsDir = path.join(root, "docs");

const problems = [];

const fail = (file, line, message) => {
  problems.push(`${file}${line ? `:${line}` : ""} — ${message}`);
};

const pages = fs
  .readdirSync(docsDir, { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => e.name)
  .sort();

if (pages.length === 0) {
  fail("docs/", 0, "не найдено ни одной страницы Markdown");
}

// Страница site/<name>.html получается из docs/<name>.md, поэтому обратная
// ссылка в тексте должна указывать именно на такое имя.
const knownPages = new Set(pages.map((name) => name.replace(/\.md$/, ".html")));

function resolveTarget(target) {
  const clean = target.split("#")[0].split("?")[0];
  if (!clean) return { ok: true };
  if (clean.endsWith(".html")) {
    if (knownPages.has(clean)) return { ok: true };
    return { ok: fs.existsSync(path.join(root, clean)), expected: `страница docs/${clean.replace(/\.html$/, ".md")}` };
  }
  if (clean.endsWith(".md")) {
    return { ok: fs.existsSync(path.join(root, clean)) || fs.existsSync(path.join(docsDir, clean)) };
  }
  return { ok: fs.existsSync(path.join(root, clean)) || fs.existsSync(path.join(docsDir, clean)) };
}

const LINK_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const name of pages) {
  const rel = `docs/${name}`;
  const text = fs.readFileSync(path.join(docsDir, name), "utf8");
  const lines = text.split(/\r?\n/);

  // Ровно один заголовок первого уровня и он же первый по тексту.
  const h1 = lines
    .map((line, i) => ({ line, no: i + 1 }))
    .filter((item) => /^#\s+\S/.test(item.line));
  if (h1.length === 0) fail(rel, 0, "нет заголовка первого уровня");
  else if (h1.length > 1) fail(rel, h1[1].no, "второй заголовок первого уровня");
  else if (h1[0].no !== lines.findIndex((l) => l.trim() !== "") + 1) {
    fail(rel, h1[0].no, "заголовок первого уровня должен быть первым непустым абзацем");
  }

  // Уровни заголовков не должны перескакивать.
  let prevLevel = 0;
  let inFence = false;
  let fenceCount = 0;
  lines.forEach((line, i) => {
    const no = i + 1;
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      fenceCount += 1;
      return;
    }
    if (inFence) return;

    const heading = line.match(/^(#{1,6})\s+(\S.*)$/);
    if (heading) {
      const level = heading[1].length;
      if (prevLevel && level > prevLevel + 1) {
        fail(rel, no, `пропущен уровень заголовка: ${prevLevel} → ${level}`);
      }
      prevLevel = level;
      if (!/[^\s]/.test(heading[2])) fail(rel, no, "пустой текст заголовка");
    }

    if (/\b(TODO|FIXME|XXX|заглушка)\b/i.test(line)) {
      fail(rel, no, "недописанный фрагмент");
    }

    let match;
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(line)) !== null) {
      const target = match[3];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const result = resolveTarget(target);
      if (!result.ok) {
        const hint = result.expected ? ` (ожидалось ${result.expected})` : "";
        fail(rel, no, `битая ссылка «${target}»${hint}`);
      }
    }
  });

  if (inFence) fail(rel, 0, "незакрытый блок кода");
  if (fenceCount === 0 && text.includes("|") && !text.includes("--- |")) {
    // не ошибка, просто оставляем как есть
  }
}

// Файлы, на которые опирается сборка.
const required = [
  "package.json",
  "tools/build.mjs",
  "tools/check.mjs",
  "openapi/openapi.yaml",
  "swagger/index.html",
  ".github/workflows/docs.yml",
  "README.md",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail(file, 0, "обязательный файл отсутствует");
}

// В спецификации должны быть разделы, на которые ссылается текст.
const openapiPath = path.join(root, "openapi", "openapi.yaml");
if (fs.existsSync(openapiPath)) {
  const spec = fs.readFileSync(openapiPath, "utf8");
  for (const key of ["openapi:", "info:", "paths:", "components:", "schemas:"]) {
    if (!spec.includes(key)) fail("openapi/openapi.yaml", 0, `нет раздела «${key}»`);
  }
}

// Диаграммы: исходник есть — должен быть и результат рендера.
const diagramsDir = path.join(root, "diagrams");
if (fs.existsSync(diagramsDir)) {
  for (const file of fs.readdirSync(diagramsDir)) {
    if (!file.endsWith(".puml")) continue;
    const base = file.replace(/\.puml$/, "");
    if (!fs.existsSync(path.join(diagramsDir, `${base}.svg`))) {
      fail(`diagrams/${file}`, 0, "не отрендерен SVG рядом с исходником");
    }
  }
}

if (problems.length > 0) {
  console.error(`Проверка документации не пройдена: ${problems.length} замечаний`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Проверка документации пройдена: ${pages.length} страниц, ${required.length} обязательных файлов`);
