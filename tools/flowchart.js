/*
 * Folyamatábra tervező (Mermaid.js).
 * Bal oldalon a kód, jobb oldalon élőben az ábra. SVG és PNG mentés van.
 */
(function () {
    "use strict";

    const TEMPLATES = {
        "Egyszerű folyamat": `flowchart TD
    %% Ide írhatsz megjegyzést, ez nem jelenik meg az ábrán
    A([Kezdés]) --> B[Felkelek]
    B --> C{Esik az eső?}
    C -->|igen| D[Viszek esernyőt]
    C -->|nem| E[Nem viszek esernyőt]
    D --> F([Indulok iskolába])
    E --> F
`,
        "Ciklus (számolás 1-től 5-ig)": `flowchart TD
    A([Start]) --> B[szam = 1]
    B --> C{szam <= 5?}
    C -->|igen| D[/Kiírom: szam/]
    D --> E[szam = szam + 1]
    E --> C
    C -->|nem| F([Vége])
`,
        "Páros vagy páratlan": `flowchart TD
    A([Start]) --> B[/Bekérek egy számot/]
    B --> C{A szám osztható 2-vel?}
    C -->|igen| D[/Kiírom: páros/]
    C -->|nem| E[/Kiírom: páratlan/]
    D --> F([Vége])
    E --> F
`,
        "Bejelentkezés (sorrend)": `sequenceDiagram
    participant F as Felhasználó
    participant W as Weboldal
    participant A as Adatbázis
    F->>W: Beírja a nevét és a jelszavát
    W->>A: Megkérdezi, jó-e
    A-->>W: Igen, jó
    W-->>F: Megmutatja a saját oldalát
`,
        "Közlekedési lámpa (állapotok)": `stateDiagram-v2
    [*] --> Piros
    Piros --> Zöld
    Zöld --> Sárga
    Sárga --> Piros
`,
        "Osztályok": `classDiagram
    class Allat {
        +String nev
        +hangotAd()
    }
    class Kutya {
        +ugat()
    }
    class Macska {
        +dorombol()
    }
    Allat <|-- Kutya
    Allat <|-- Macska
`,
        "Adatbázis kapcsolatok": `erDiagram
    OSZTALY ||--o{ DIAK : tartalmaz
    DIAK ||--o{ JEGY : kap
    DIAK {
        int id
        string nev
    }
    JEGY {
        int id
        string targy
        int ertek
    }
`
    };

    const SNIPPETS = [
        ["Lépés", "A[Szöveg]"],
        ["Kezdet / vég", "A([Kezdés])"],
        ["Döntés", "A{Kérdés?}"],
        ["Adat be / ki", "A[/Adat/]"],
        ["Nyíl", " --> "],
        ["Nyíl felirattal", " -->|igen| "],
        ["Megjegyzés", "%% megjegyzés"]
    ];

    function defineMode() {
        CodeMirror.defineSimpleMode("mermaid", {
            start: [
                { regex: /%%.*/, token: "comment" },
                { regex: /"(?:[^\\"]|\\.)*"/, token: "string" },
                { regex: /\b(?:graph|flowchart|subgraph|end|direction|sequenceDiagram|participant|actor|classDiagram|class|stateDiagram-v2|stateDiagram|erDiagram|gantt|pie|journey|title|note|loop|alt|else|opt|classDef|style|linkStyle|click|section)\b/, token: "keyword" },
                { regex: /\b(?:TD|TB|BT|RL|LR)\b/, token: "atom" },
                { regex: /<-->|-->>|--\)|--x|-->|---|==>|-\.->|-\.-|->>|\|[^|]*\|/, token: "operator" },
                { regex: /[\[\]{}()]+/, token: "bracket" }
            ]
        });
    }

    Tools.add({
        id: "flow-workspace",
        title: "Folyamatábra",
        libs: [
            "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/mode/simple.min.js",
            "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
        ],
        html: `
            <div class="left-pane">
                <div class="toolbar">
                    <span>Folyamatábra kód</span>
                    <div class="group">
                        <select class="btn flow-template" aria-label="Minta betöltése"></select>
                        <button class="btn" data-act="elements">Elemek</button>
                    </div>
                </div>
                <div class="info-panel flow-elements" hidden>
                    <h4>Kattints egy elemre, és a kurzor helyére kerül.</h4>
                    <div class="flow-snippets" style="display:flex; flex-wrap:wrap; gap:6px;"></div>
                    <p class="note">Az A, B, C betűk az elemek nevei. Minden elemnek más nevet adj. A szögletes zárójelben lévő szöveg jelenik meg az ábrán.</p>
                </div>
                <textarea class="flow-src"></textarea>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar">
                    <span>Ábra</span>
                    <div class="group">
                        <button class="btn small" data-act="zoom-out" title="Kicsinyítés">−</button>
                        <button class="btn small" data-act="zoom-in" title="Nagyítás">+</button>
                        <button class="btn small" data-act="zoom-fit" title="Az ablakhoz igazítja">Illesztés</button>
                        <button class="btn" data-act="svg">Mentés SVG</button>
                        <button class="btn" data-act="png">Mentés PNG</button>
                    </div>
                </div>
                <div class="flow-view"></div>
                <div class="status-bar flow-status" hidden></div>
            </div>`,

        init(ws) {
            defineMode();
            const view = ws.querySelector(".flow-view");
            const status = ws.querySelector(".flow-status");
            const select = ws.querySelector(".flow-template");
            const names = Object.keys(TEMPLATES);
            let zoom = null, counter = 0, timer = null, lastSvg = "";

            mermaid.initialize({
                startOnLoad: false,
                securityLevel: "strict",
                theme: "neutral",
                flowchart: { htmlLabels: false },
                fontFamily: "system-ui, Arial, sans-serif"
            });

            const editor = CodeMirror.fromTextArea(ws.querySelector(".flow-src"), {
                theme: "dracula",
                lineNumbers: true,
                indentUnit: 4,
                lineWrapping: true,
                mode: "mermaid",
                extraKeys: { Tab: cm => cm.execCommand("insertSoftTab") }
            });
            ws._editor = editor;

            const opt0 = Tools.mk("option", null, "Minta betöltése...");
            opt0.value = "";
            select.appendChild(opt0);
            names.forEach(n => { const o = Tools.mk("option", null, n); o.value = n; select.appendChild(o); });

            let lastTemplate = names[0];
            editor.setValue(TEMPLATES[lastTemplate]);

            ws._state = {
                get: () => ({ code: editor.getValue() }),
                set(d) { if (d && typeof d.code === "string") { editor.setValue(d.code); editor.clearHistory(); } },
                file: {
                    name: () => "folyamatabra.mmd",
                    type: "text/plain",
                    accept: ".mmd,.mermaid,.md,.txt",
                    text: () => editor.getValue(),
                    load(text) { editor.setValue(text); editor.clearHistory(); }
                }
            };

            select.addEventListener("change", () => {
                const n = select.value;
                select.value = "";
                if (!n) return;
                if (editor.getValue() !== TEMPLATES[lastTemplate] && !confirm("A mostani kód el fog veszni. Betöltöd a mintát?")) return;
                lastTemplate = n;
                editor.setValue(TEMPLATES[n]);
            });

            const snipBox = ws.querySelector(".flow-snippets");
            SNIPPETS.forEach(([label, code]) => {
                const b = Tools.mk("button", "btn", label);
                b.addEventListener("click", () => { editor.replaceSelection(code); editor.focus(); });
                snipBox.appendChild(b);
            });
            ws.querySelector('[data-act="elements"]').addEventListener("click", () => {
                const p = ws.querySelector(".flow-elements");
                p.hidden = !p.hidden;
            });

            function applyZoom() {
                const svg = view.querySelector("svg");
                if (!svg) return;
                const vb = svg.viewBox.baseVal;
                if (zoom === null) {
                    svg.style.width = "";
                    svg.style.maxWidth = "100%";
                } else {
                    svg.style.maxWidth = "none";
                    svg.style.width = Math.round(vb.width * zoom) + "px";
                }
            }
            function changeZoom(f) {
                const svg = view.querySelector("svg");
                if (!svg) return;
                if (zoom === null) zoom = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
                zoom = Math.min(5, Math.max(0.2, zoom * f));
                applyZoom();
            }
            ws.querySelector('[data-act="zoom-in"]').addEventListener("click", () => changeZoom(1.25));
            ws.querySelector('[data-act="zoom-out"]').addEventListener("click", () => changeZoom(0.8));
            ws.querySelector('[data-act="zoom-fit"]').addEventListener("click", () => { zoom = null; applyZoom(); });

            async function render() {
                const code = editor.getValue();
                if (!code.trim()) { view.replaceChildren(); status.hidden = true; lastSvg = ""; return; }
                const id = "mmd-" + (++counter);
                try {
                    await mermaid.parse(code);
                    const { svg } = await mermaid.render(id, code);
                    view.innerHTML = svg;
                    lastSvg = svg;
                    status.hidden = true;
                    applyZoom();
                } catch (e) {
                    const box = document.getElementById("d" + id);
                    if (box) box.remove();
                    status.textContent = "Hiba a kódban: " + String(e.message || e).split("\n").slice(0, 4).join(" ");
                    status.hidden = false;
                }
            }
            editor.on("change", () => { clearTimeout(timer); timer = setTimeout(render, 350); });

            function download(name, blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }

            // Önálló SVG szöveg: kell neki méret és névtér, hogy fájlként is megnyíljon
            function standaloneSvg() {
                const svg = view.querySelector("svg");
                if (!svg) return null;
                const clone = svg.cloneNode(true);
                const vb = svg.viewBox.baseVal;
                clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                clone.setAttribute("width", Math.ceil(vb.width));
                clone.setAttribute("height", Math.ceil(vb.height));
                clone.style.maxWidth = "";
                clone.style.width = "";
                return { text: new XMLSerializer().serializeToString(clone), w: Math.ceil(vb.width), h: Math.ceil(vb.height) };
            }

            ws.querySelector('[data-act="svg"]').addEventListener("click", () => {
                const s = standaloneSvg();
                if (!s) return;
                download("folyamatabra.svg", new Blob([s.text], { type: "image/svg+xml;charset=utf-8" }));
            });

            ws.querySelector('[data-act="png"]').addEventListener("click", () => {
                const s = standaloneSvg();
                if (!s) return;
                const img = new Image();
                img.onload = () => {
                    const scale = 2;
                    const canvas = document.createElement("canvas");
                    canvas.width = s.w * scale;
                    canvas.height = s.h * scale;
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#fff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    try {
                        canvas.toBlob(b => b && download("folyamatabra.png", b), "image/png");
                    } catch (e) {
                        alert("A PNG mentés ebben a böngészőben nem sikerült. Használd az SVG mentést.");
                    }
                };
                img.onerror = () => alert("A PNG mentés nem sikerült. Használd az SVG mentést.");
                img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s.text);
            });

            render();
        },

        onShow(ws) { requestAnimationFrame(() => ws._editor && ws._editor.refresh()); },
        onResize(ws) { if (ws._editor) ws._editor.refresh(); }
    });
})();
