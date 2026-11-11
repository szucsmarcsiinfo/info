/*
 * Kiegészítő fülek: Terminál, C / C++ / C#, Folyamatábra, Titkosítás.
 *
 * Az oldalba egyetlen sor kell (a </body> elé):
 *     <script src="tools/tools.js"></script>
 *
 * Minden fül maga teszi be a gombját és a munkaterületét, a nagy könyvtárak
 * (xterm, mermaid, crypto-js) pedig csak akkor töltődnek le, amikor először
 * megnyitod az adott fület.
 */
(function () {
    "use strict";

    const BASE = new URL(".", document.currentScript.src).href;
    // A script sor végén lévő ?v=szám minden betöltött fájlra átmegy, így a szám átírásával
    // mindenki friss fájlokat kap (különben a böngésző a régit tarthatja meg).
    const VER = new URL(document.currentScript.src).search;
    const loaded = {};
    const entries = {};

    function loadScript(url) {
        if (!loaded[url]) {
            loaded[url] = new Promise((resolve, reject) => {
                const s = document.createElement("script");
                s.src = url;
                s.onload = resolve;
                s.onerror = () => reject(new Error("Nem sikerült betölteni: " + url));
                document.head.appendChild(s);
            });
        }
        return loaded[url];
    }

    function loadCss(url) {
        if (loaded[url]) return;
        loaded[url] = true;
        const l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = url;
        document.head.appendChild(l);
    }

    function mk(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function activate(id) {
        document.querySelectorAll(".workspace").forEach(w => w.classList.toggle("active", w.id === id));
        // Az oldal ebből tudja, hogy fület váltottunk (a menü kijelöléséhez és a logó cseréjéhez)
        document.dispatchEvent(new CustomEvent("tools:activate", { detail: { id } }));

        ensure(id).then(() => { const e = entries[id]; e.def.onShow && e.def.onShow(e.ws); }).catch(() => {});
    }

    // Betölti és elindítja a fület anélkül, hogy odaváltana (a mentés/betöltés is ezt használja)
    function ensure(id) {
        const e = entries[id];
        if (!e) return Promise.reject(new Error("Ismeretlen fül: " + id));
        if (!e.loading) {
            (e.def.css || []).forEach(loadCss);
            e.loading = Promise.all((e.def.libs || []).map(loadScript))
                .then(() => { e.def.init(e.ws); addFileMenu(e); e.ready = true; })
                .catch(err => {
                    const msg = mk("p", "tools-error", "Ezt a részt most nem sikerült betölteni. Ellenőrizd az internetkapcsolatot, és frissítsd az oldalt. (" + err.message + ")");
                    e.ws.replaceChildren(msg);
                    throw err;
                });
        }
        return e.loading.then(() => e.ws);
    }

    // ---------- Fájlba mentés és fájlból betöltés ----------
    function download(data, name, type) {
        const a = mk("a");
        a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: (type || "text/plain") + ";charset=utf-8" }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function pickFile(accept, binary) {
        return new Promise(resolve => {
            const input = mk("input");
            input.type = "file";
            if (accept) input.accept = accept;
            input.style.display = "none";
            input.addEventListener("change", () => {
                const file = input.files[0];
                input.remove();
                if (!file) return resolve(null);
                const r = new FileReader();
                r.onload = () => resolve({ name: file.name, data: r.result });
                r.onerror = () => resolve(null);
                binary ? r.readAsArrayBuffer(file) : r.readAsText(file);
            });
            document.body.appendChild(input);
            input.click();
        });
    }

    // Minden fül az init()-ben beállíthat egy ws._state = { get(), set(adat), file? } objektumot.
    // file: { name(), type, accept, text(), load(szöveg, fájlnév) } a fül saját fájlformátumához;
    // ha nincs, a fül állapota JSON-ként mentődik.
    function addFileMenu(e) {
        const st = e.ws._state;
        if (!st) return;
        const bar = e.ws.querySelector(".left-pane .toolbar");
        if (!bar) return;
        let group = bar.querySelector(".group");
        if (!group) { group = mk("div", "group"); bar.appendChild(group); }
        const f = st.file || {
            name: () => e.def.id.replace("-workspace", "") + ".json",
            type: "application/json",
            accept: ".json,application/json",
            text: () => JSON.stringify({ app: "informatika-tanulas", tab: e.def.id, state: st.get() }, null, 2),
            load: text => {
                const d = JSON.parse(text);
                st.set(d && d.tab === e.def.id && d.state ? d.state : d);
            }
        };
        const sel = mk("select", "btn");
        sel.setAttribute("aria-label", "Fájl: mentés vagy betöltés");
        sel.append(new Option("Fájl...", ""), new Option("Mentés fájlba", "save"), new Option("Betöltés fájlból", "load"));
        sel.addEventListener("change", async () => {
            const act = sel.value;
            sel.value = "";
            if (act === "save") download(f.text(), f.name(), f.type);
            if (act === "load") {
                const file = await pickFile(f.accept, false);
                if (!file) return;
                try { f.load(file.data, file.name); }
                catch (err) { alert("Ezt a fájlt nem sikerült betölteni: " + err.message); }
            }
        });
        group.prepend(sel);
    }

    function getState(id) {
        const e = entries[id];
        return e && e.ready && e.ws._state ? e.ws._state.get() : null;
    }
    function setState(id, data) {
        return ensure(id).then(ws => { if (ws._state) ws._state.set(data); });
    }

    function add(def) {
        const nav = document.querySelector(".nav");
        const main = document.querySelector("body > main") || document.querySelector("main");
        if (!nav || !main) return;

        // A fül gombja az oldal menüjében van; ha mégsem, a menüsor végére kerül. A kattintást az oldal kezeli.
        if (!nav.querySelector('.tab[data-target="' + def.id + '"]')) {
            const btn = mk("button", "tab", def.title);
            btn.type = "button";
            btn.dataset.target = def.id;
            nav.appendChild(btn);
        }

        const ws = mk("div", "workspace");
        ws.id = def.id;
        ws.dataset.tools = "1";
        ws.innerHTML = def.html;
        main.appendChild(ws);

        entries[def.id] = { def, ws, loading: null };
    }

    // Húzható elválasztó a saját munkaterületeknek
    let drag = null;
    document.addEventListener("mousedown", e => {
        const bar = e.target.closest && e.target.closest(".workspace[data-tools] > .resizer");
        if (!bar) return;
        drag = { bar, pane: bar.previousElementSibling, ws: bar.parentElement };
        bar.classList.add("active");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const overlay = mk("div");
        overlay.id = "tools-drag-overlay";
        overlay.style.cssText = "position:fixed;inset:0;z-index:9999;cursor:col-resize;";
        document.body.appendChild(overlay);
        e.preventDefault();
    });
    document.addEventListener("mousemove", e => {
        if (!drag) return;
        const rect = drag.ws.getBoundingClientRect();
        drag.pane.style.width = Math.max(240, Math.min(rect.width - 240, e.clientX - rect.left)) + "px";
    });
    document.addEventListener("mouseup", () => {
        if (!drag) return;
        drag.bar.classList.remove("active");
        const entry = entries[drag.ws.id];
        drag = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const o = document.getElementById("tools-drag-overlay");
        if (o) o.remove();
        if (entry && entry.def.onResize) entry.def.onResize(entry.ws);
    });
    window.addEventListener("resize", () => {
        Object.values(entries).forEach(e => {
            if (e.ws.classList.contains("active") && e.def.onResize) e.def.onResize(e.ws);
        });
    });

    window.Tools = { add, mk, loadScript, loadCss, BASE, ensure, download, pickFile, getState, setState, activate, ids: () => Object.keys(entries) };

    loadCss(BASE + "tools.css" + VER);
    // Egymás után töltjük be őket, hogy a fülek mindig ugyanabban a sorrendben jelenjenek meg
    ["terminal.js", "code-runner.js", "flowchart.js", "crypto.js", "image.js", "analyzers.js", "network.js", "snippets.js"].reduce(
        (chain, f) => chain.then(() => loadScript(BASE + f + VER)).catch(() => {}),
        Promise.resolve()
    );
})();
