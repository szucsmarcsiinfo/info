/*
 * Kódrészlet-gyűjtemény (a DevBox Toolkitből átvéve): kereshető, másolható részletek,
 * és ami itt is fut (Python, JavaScript, HTML, CSS, SQL), az egy gombbal kipróbálható a saját fülén.
 */
(function () {
    "use strict";

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const CATS = { all: "Mind", python: "Python", javascript: "JavaScript", html: "HTML", css: "CSS", bash: "Bash", sql: "SQL" };

    // Hova lehet betölteni az egyes nyelveket kipróbálásra (a TypeScript fül a sima JavaScriptet is futtatja)
    const TRY = {
        python: { tab: "python-workspace", editor: () => pythonEditor, name: "Python" },
        javascript: { tab: "ts-workspace", editor: () => tsEditor, name: "TypeScript" },
        html: { tab: "html-workspace", editor: () => htmlEditor, name: "HTML" },
        css: { tab: "html-workspace", editor: () => htmlEditor, name: "HTML", wrap: code => "<!DOCTYPE html>\n<html lang=\"hu\">\n<head>\n<meta charset=\"UTF-8\">\n<style>\n" + code + "\n</style>\n</head>\n<body>\n    <div class=\"grid center ellipsis clamp\">Próbaszöveg a CSS kipróbálásához.</div>\n</body>\n</html>\n" },
        sql: { tab: "sql-workspace", editor: () => sqlEditor, name: "SQL" }
    };

    const SNIPPETS = [
        { cat: "python", title: "JSON-fájl biztonságos beolvasása", desc: "JSON betöltése lemezről, és érthető hiba, ha hiányzik vagy hibás.", use: "Beállításfájlok, gyorsítótárak, bármilyen kis adatfájl, amit induláskor olvasol be.",
            code: 'import json\nfrom pathlib import Path\n\ndef load_json(path, default=None):\n    p = Path(path)\n    if not p.exists():\n        return default\n    try:\n        return json.loads(p.read_text(encoding="utf-8"))\n    except json.JSONDecodeError as e:\n        raise ValueError(f"Hibás JSON: {path}: {e}") from e\n\ndata = load_json("config.json", default={})' },
        { cat: "python", title: "Időmérő dekorátor", desc: "Kiírja, mennyi ideig fut egy függvény.", use: "Gyors mérés, ha azt gyanítod, hogy egy függvény lassítja a programot.",
            code: 'import time, functools\n\ndef timed(fn):\n    @functools.wraps(fn)\n    def wrap(*a, **kw):\n        t = time.perf_counter()\n        try:\n            return fn(*a, **kw)\n        finally:\n            print(f"{fn.__name__}: {time.perf_counter()-t:.4f} mp")\n    return wrap\n\n@timed\ndef work():\n    sum(range(1_000_000))\n\nwork()' },
        { cat: "python", title: "Lista darabolása csoportokra", desc: "Egy listát egyforma méretű darabokra vág (az utolsó lehet rövidebb).", use: "API-hívások, adatbázis-beszúrások vagy fájlírások csoportosítása.",
            code: 'def chunked(items, size):\n    for i in range(0, len(items), size):\n        yield items[i:i + size]\n\nfor batch in chunked(list(range(1, 11)), 4):\n    print(list(batch))  # [1,2,3,4] [5,6,7,8] [9,10]' },
        { cat: "python", title: "Újrapróbálás várakozással", desc: "Egy megbízhatatlan hívást többször is megpróbál, egyre hosszabb szünetekkel.", use: "Hálózati kérések vagy bármi, ami néha magától elromlik.",
            code: 'import time\n\ndef retry(fn, tries=3, delay=0.5, factor=2):\n    last = None\n    for attempt in range(tries):\n        try:\n            return fn()\n        except Exception as e:\n            last = e\n            time.sleep(delay * factor ** attempt)\n    raise last\n\n# eredmeny = retry(lambda: requests.get(url).json())' },

        { cat: "javascript", title: "Debounce", desc: "Csak akkor futtatja a függvényt, ha a felhasználó abbahagyta a gépelést vagy kattintgatást.", use: "Keresés gépelés közben, ablak átméretezése, automatikus mentés.",
            code: 'function debounce(fn, wait = 300) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), wait);\n  };\n}\n\nconst log = debounce(q => console.log("Keresés:", q), 400);\nlog("a"); log("al"); log("alma"); // csak az "alma" íródik ki' },
        { cat: "javascript", title: "Szöveg vágólapra másolása", desc: "Szöveg másolása a modern API-val, régi böngészőkhöz tartalék megoldással.", use: "„Kód másolása”, „Link másolása”, „Kuponkód másolása” gombok.",
            code: 'async function copy(text) {\n  try {\n    await navigator.clipboard.writeText(text);\n    return true;\n  } catch {\n    const ta = document.createElement("textarea");\n    ta.value = text; document.body.appendChild(ta); ta.select();\n    const ok = document.execCommand("copy");\n    ta.remove();\n    return ok;\n  }\n}' },
        { cat: "javascript", title: "JSON lekérése időkorláttal", desc: "Megszakítja a kérést, ha túl sokáig tart, és beolvassa a JSON-t.", use: "Bármilyen API-hívás, ahol nem akarsz örökké várni.",
            code: 'async function getJSON(url, ms = 8000) {\n  const ctrl = new AbortController();\n  const id = setTimeout(() => ctrl.abort(), ms);\n  try {\n    const res = await fetch(url, { signal: ctrl.signal });\n    if (!res.ok) throw new Error("HTTP " + res.status);\n    return await res.json();\n  } finally {\n    clearTimeout(id);\n  }\n}' },
        { cat: "javascript", title: "Tömb csoportosítása kulcs szerint", desc: "Egy lapos tömbből egy tulajdonság szerint csoportosított objektumot készít.", use: "Csoportos listák megjelenítése (kategória, dátum vagy felhasználó szerint).",
            code: 'const groupBy = (arr, key) =>\n  arr.reduce((acc, item) => {\n    const k = typeof key === "function" ? key(item) : item[key];\n    (acc[k] = acc[k] || []).push(item);\n    return acc;\n  }, {});\n\nconsole.log(groupBy([{ t: "a" }, { t: "b" }, { t: "a" }], "t"));' },

        { cat: "html", title: "Reszponzív kép tartalékkal", desc: "WebP-t ad, ha a böngésző ismeri, különben automatikusan JPG-t.", use: "Gyorsan betöltődő borítóképek és tartalomképek.",
            code: '<picture>\n  <source srcset="hero.webp" type="image/webp">\n  <source srcset="hero.jpg"  type="image/jpeg">\n  <img src="hero.jpg" alt="A kép leírása"\n       width="1200" height="630" loading="lazy" decoding="async">\n</picture>' },
        { cat: "html", title: "Alap meta címkék (SEO)", desc: "Azok a meta címkék, amik minden oldalra kellenek.", use: "Bármelyik új HTML-oldal <head> része.",
            code: '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Oldal címe | Márka</title>\n<meta name="description" content="160 karakter alatt, minden oldalon más.">\n<link rel="canonical" href="https://example.com/oldal">\n<meta property="og:title" content="Oldal címe">\n<meta property="og:description" content="Megosztáskor ez látszik.">\n<meta property="og:image" content="https://example.com/borito.png">\n<meta name="twitter:card" content="summary_large_image">' },
        { cat: "html", title: "Lenyíló szakasz JavaScript nélkül", desc: "Összecsukható rész csak a <details> és <summary> elemekkel.", use: "GYIK, „Tovább olvasom”, rejtett válaszok, nulla JavaScripttel.",
            code: '<details>\n  <summary>Mi van benne?</summary>\n  <p>Minden a böngésződben fut. Semmi nem töltődik fel.</p>\n</details>' },

        { cat: "css", title: "Magától igazodó rács", desc: "Kártyarács, ami media query nélkül is átrendeződik.", use: "Terméklisták, galériák, vezérlőpultok.",
            code: '.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));\n  gap: 1rem;\n}' },
        { cat: "css", title: "Szöveg levágása három ponttal", desc: "Egy sor levágása, vagy korlátozás N sorra.", use: "Kártyacímek, előnézetek, táblázatcellák.",
            code: '/* egy sor */\n.ellipsis {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* több sor */\n.clamp {\n  display: -webkit-box;\n  -webkit-line-clamp: 3;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}' },
        { cat: "css", title: "Tökéletes középre igazítás", desc: "Egy elem középre igazítása mindkét irányban, a megbízható módon.", use: "Felugró ablakok, borítók, töltésjelzők.",
            code: '.center {\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}' },
        { cat: "css", title: "Sötét mód követése", desc: "A színeket a látogató rendszerbeállítása szerint váltja.", use: "Bármilyen oldal, aminek világosban és sötétben is jól kell kinéznie.",
            code: ':root { --bg: #fff; --fg: #111; }\n@media (prefers-color-scheme: dark) {\n  :root { --bg: #111; --fg: #eee; }\n}\nbody { background: var(--bg); color: var(--fg); }' },

        { cat: "bash", title: "Biztonságos szkriptfejléc", desc: "Hibánál, nem létező változónál és elromlott csővezetéknél azonnal leáll.", use: "Minden komolyabb shell szkript eleje.",
            code: "#!/usr/bin/env bash\nset -Eeuo pipefail\nIFS=$'\\n\\t'\n\n# ide jön a szkript" },
        { cat: "bash", title: "Keresés és csere fájlokban", desc: "Egy szöveg cseréje egy mappa összes fájljában.", use: "Változó átnevezése, URL cseréje egy egész projektben.",
            code: "# GNU sed (Linux)\ngrep -rl \"regi-szoveg\" . | xargs sed -i 's/regi-szoveg/uj-szoveg/g'\n\n# macOS / BSD sed\ngrep -rl \"regi-szoveg\" . | xargs sed -i '' 's/regi-szoveg/uj-szoveg/g'" },
        { cat: "bash", title: "Képek tömeges átalakítása ffmpeg-gel", desc: "Egy mappa összes PNG-jét WebP-vé alakítja.", use: "Egy egész képmappa weboldalra optimalizálása.",
            code: 'for f in *.png; do\n  ffmpeg -i "$f" -qscale 80 "${f%.png}.webp"\ndone' },
        { cat: "bash", title: "JSON küldése curl-lel", desc: "JSON adatot küld POST-tal, és kiírja a válasz fejléceit is.", use: "Egy API végpont kipróbálása a terminálból.",
            code: "curl -sS -i -X POST https://api.example.com/items \\\n  -H \"Content-Type: application/json\" \\\n  -H \"Authorization: Bearer $TOKEN\" \\\n  -d '{\"name\":\"Widget\",\"qty\":3}'" },

        { cat: "sql", title: "Beszúrás vagy frissítés (upsert)", desc: "Beszúr egy sort, vagy frissíti, ha a kulcs már létezik.", use: "Szinkronizálás, számlálók, „mentés” végpontok.",
            code: "-- PostgreSQL / SQLite\nCREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, name TEXT);\n\nINSERT INTO users (id, email, name)\nVALUES (1, 'a@b.hu', 'Anna')\nON CONFLICT (id) DO UPDATE\n  SET email = excluded.email,\n      name  = excluded.name;\n\nSELECT * FROM users;" },
        { cat: "sql", title: "Csoportonként a legfrissebb sor", desc: "Minden csoportból egy sort, a legújabbat adja vissza ablakfüggvénnyel.", use: "Vásárlónként az utolsó rendelés, eszközönként a legújabb napló.",
            code: "SELECT * FROM (\n  SELECT *,\n    ROW_NUMBER() OVER (\n      PARTITION BY diak_id\n      ORDER BY id DESC) AS rn\n  FROM jegyek\n) t\nWHERE rn = 1;" },
        { cat: "sql", title: "Lapozható lekérdezés", desc: "Az eredmények egy oldalát adja vissza, mindig ugyanabban a sorrendben.", use: "Listázó API-k és végtelen görgetés.",
            code: "SELECT id, nev, osztaly\nFROM diakok\nORDER BY nev, id\nLIMIT 3 OFFSET 3;  -- 2. oldal, oldalanként 3" }
    ];

    Tools.add({
        id: "snippets-workspace",
        title: "Kódrészletek",
        html: `
            <div class="left-pane">
                <div class="toolbar"><span>Kódrészletek</span></div>
                <div class="search-field">
                    <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <input type="search" class="field sn-search" placeholder="Keresés (pl. debounce, rács, curl)" aria-label="Kódrészletek keresése">
                </div>
                <div class="chips" role="group" aria-label="Nyelv">
                    ${Object.keys(CATS).map(k => '<button class="chip" type="button" data-cat="' + k + '" aria-pressed="' + (k === "all") + '">' + CATS[k] + "</button>").join("")}
                </div>
                <div class="sn-list" role="list"></div>
                <p class="empty sn-none" hidden>Nincs találat. Próbálj másik szót vagy nyelvet.</p>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Részlet</span></div>
                <div class="side-scroll sn-detail"></div>
            </div>`,

        init(ws) {
            const q = s => ws.querySelector(s);
            const list = q(".sn-list"), detail = q(".sn-detail"), search = q(".sn-search");
            let cat = "all", sel = 0;

            list.innerHTML = SNIPPETS.map((s, i) =>
                '<button class="sn-item" type="button" role="listitem" data-i="' + i + '"><span class="lang-tag" data-cat="' + s.cat + '">' + CATS[s.cat] +
                '</span><span class="sn-title">' + esc(s.title) + '</span><span class="sn-desc">' + esc(s.desc) + "</span></button>").join("");
            const items = [...list.querySelectorAll(".sn-item")];

            function filter() {
                const needle = search.value.trim().toLowerCase();
                let visible = 0;
                items.forEach((b, i) => {
                    const s = SNIPPETS[i];
                    const hay = (s.title + " " + s.desc + " " + s.use + " " + s.cat + " " + s.code).toLowerCase();
                    const ok = (cat === "all" || s.cat === cat) && (!needle || hay.includes(needle));
                    b.hidden = !ok;
                    if (ok) visible++;
                });
                q(".sn-none").hidden = visible > 0;
                if (items[sel].hidden) { const first = items.find(b => !b.hidden); if (first) show(+first.dataset.i); }
            }

            function show(i) {
                sel = i;
                items.forEach(b => b.classList.toggle("active", +b.dataset.i === i));
                const s = SNIPPETS[i], t = TRY[s.cat];
                detail.innerHTML =
                    '<div class="sn-head"><span class="lang-tag" data-cat="' + s.cat + '">' + CATS[s.cat] + "</span><h3>" + esc(s.title) + "</h3></div>" +
                    '<p class="sn-lead">' + esc(s.desc) + "</p>" +
                    '<p class="note-box"><b>Hol használd:</b> ' + esc(s.use) + "</p>" +
                    '<div class="actions sn-actions"><button class="btn" type="button" data-act="copy">Másolás</button>' +
                    (t ? '<button class="btn primary" type="button" data-act="try">Kipróbálás a(z) ' + t.name + " fülön</button>" : '<span class="note">A Bash parancsokat egy valódi terminálban próbáld ki.</span>') + "</div>" +
                    '<pre class="output-box sn-code"><code>' + esc(s.code) + "</code></pre>";
                detail.querySelector('[data-act="copy"]').addEventListener("click", e => copyText(s.code, e.currentTarget));
                if (t) detail.querySelector('[data-act="try"]').addEventListener("click", () => tryIt(s, t));
            }

            function tryIt(s, t) {
                const ed = t.editor();
                const code = t.wrap ? t.wrap(s.code) : s.code;
                if (ed.getValue().trim() && ed.getValue() !== code && !confirm("A(z) " + t.name + " fülön lévő kód helyére ez a részlet kerül. Folytatod?")) return;
                ed.setValue(code);
                const tab = document.querySelector('.nav .tab[data-target="' + t.tab + '"]');
                if (tab) tab.click();
            }

            function copyText(text, btn) {
                const done = () => { btn.textContent = "Másolva"; setTimeout(() => { btn.textContent = "Másolás"; }, 1200); };
                const fallback = () => {
                    const ta = Tools.mk("textarea");
                    ta.value = text;
                    ta.style.cssText = "position:fixed;opacity:0";
                    document.body.appendChild(ta);
                    ta.select();
                    try { document.execCommand("copy"); done(); } catch (e) { /* nem sikerült */ }
                    ta.remove();
                };
                if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
                else fallback();
            }

            list.addEventListener("click", e => { const b = e.target.closest(".sn-item"); if (b) show(+b.dataset.i); });
            list.addEventListener("keydown", e => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                const vis = items.filter(b => !b.hidden), i = vis.indexOf(document.activeElement);
                if (i < 0) return;
                e.preventDefault();
                const next = vis[(i + (e.key === "ArrowDown" ? 1 : vis.length - 1)) % vis.length];
                next.focus();
                show(+next.dataset.i);
            });
            ws.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
                cat = c.dataset.cat;
                ws.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === c ? "true" : "false"));
                filter();
            }));
            search.addEventListener("input", filter);
            show(0);

            ws._state = {
                get: () => ({ cat, search: search.value, selected: sel }),
                set(d) {
                    if (!d) return;
                    if (CATS[d.cat]) { cat = d.cat; ws.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.cat === cat ? "true" : "false")); }
                    if (typeof d.search === "string") search.value = d.search;
                    if (Number.isInteger(d.selected) && SNIPPETS[d.selected]) show(d.selected);
                    filter();
                }
            };
        }
    });
})();
