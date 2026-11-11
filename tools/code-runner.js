/*
 * C, C++ és C# futtatás.
 * A kód a Compiler Explorer (godbolt.org) nyilvános szerverén fordul le és fut le,
 * mert ezekhez a nyelvekhez a böngészőben nincs kész, kis méretű fordító.
 */
(function () {
    "use strict";

    const API = "https://godbolt.org/api/compiler/";

    const LANGS = {
        c: {
            label: "C", mode: "text/x-csrc", lang: "c", compiler: "cg142", args: "",
            stdin: "21\n",
            code: `#include <stdio.h>

int main(void) {
    // Bekérünk egy számot, és kiírjuk a duplájának
    int szam;
    printf("Adj meg egy számot: ");
    scanf("%d", &szam);
    printf("A duplaja: %d\\n", szam * 2);

    // Kiírjuk a négyzetszámokat 1-től 5-ig
    for (int i = 1; i <= 5; i++) {
        printf("%d a negyzete %d\\n", i, i * i);
    }
    return 0;
}
`
        },
        cpp: {
            label: "C++", mode: "text/x-c++src", lang: "c++", compiler: "g142", args: "-std=c++20",
            stdin: "Marcsi\n",
            code: `#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    // Bekérjük a nevet, és köszöntjük
    string nev;
    cout << "Hogy hívnak? ";
    getline(cin, nev);
    cout << "Szia " << nev << "!" << endl;

    // Egy lista számokkal
    vector<int> szamok = {4, 8, 15, 16, 23, 42};
    int osszeg = 0;
    for (int x : szamok) {
        osszeg += x;
    }
    cout << "Az osszeg: " << osszeg << endl;
    return 0;
}
`
        },
        cs: {
            label: "C#", mode: "text/x-csharp", lang: "csharp", compiler: "dotnet100csharpcoreclr", args: "",
            stdin: "Marcsi\n",
            code: `using System;

class Program
{
    static void Main()
    {
        // Bekérjük a nevet, és köszöntjük
        Console.Write("Hogy hívnak? ");
        string nev = Console.ReadLine();
        Console.WriteLine("Szia " + nev + "!");

        // Kiírjuk a négyzetszámokat 1-től 5-ig
        for (int i = 1; i <= 5; i++)
        {
            Console.WriteLine(i + " a negyzete " + (i * i));
        }
    }
}
`
        }
    };

    const stripAnsi = s => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    const textOf = arr => (arr || []).map(x => stripAnsi(x.text)).join("\n");

    Tools.add({
        id: "code-workspace",
        title: "C / C++ / C#",
        libs: ["https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js"],
        html: `
            <div class="left-pane">
                <div class="toolbar">
                    <span>Program kód</span>
                    <div class="group">
                        <div class="seg" role="group" aria-label="Nyelv">
                            <button class="btn" data-lang="c" aria-pressed="true">C</button>
                            <button class="btn" data-lang="cpp" aria-pressed="false">C++</button>
                            <button class="btn" data-lang="cs" aria-pressed="false">C#</button>
                        </div>
                        <button class="btn primary" data-act="run" title="Ctrl + Enter">Futtatás</button>
                    </div>
                </div>
                <textarea class="code-src"></textarea>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar">
                    <span>Kimenet</span>
                    <span class="stat code-stat"></span>
                </div>
                <label class="lbl">Bemenet (amit a program beolvas, soronként)</label>
                <textarea class="field code-stdin" spellcheck="false"></textarea>
                <pre class="output-box code-out"></pre>
                <p class="code-note">A program a Compiler Explorer (godbolt.org) szerverén fordul le és fut le. Ehhez internet kell, és a kódod odakerül. Ne írj bele jelszót vagy személyes adatot.</p>
            </div>`,

        init(ws) {
            const stdin = ws.querySelector(".code-stdin");
            const out = ws.querySelector(".code-out");
            const stat = ws.querySelector(".code-stat");
            const runBtn = ws.querySelector('[data-act="run"]');
            let lang = "c";

            const editor = CodeMirror.fromTextArea(ws.querySelector(".code-src"), {
                theme: "dracula",
                lineNumbers: true,
                indentUnit: 4,
                lineWrapping: true,
                mode: LANGS.c.mode,
                extraKeys: {
                    Tab: cm => cm.execCommand("insertSoftTab"),
                    "Ctrl-Enter": () => run()
                }
            });
            editor.setValue(LANGS.c.code);
            stdin.value = LANGS.c.stdin;
            ws._editor = editor;

            function applyLang(next) {
                lang = next;
                ws.querySelectorAll("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false"));
                editor.setOption("mode", LANGS[lang].mode);
            }

            function setLang(next) {
                const cur = editor.getValue().trim();
                const untouched = Object.values(LANGS).some(l => l.code.trim() === cur);
                applyLang(next);
                // Csak akkor cseréljük ki a kódot, ha még a mintakód áll benne
                if (untouched) {
                    editor.setValue(LANGS[lang].code);
                    stdin.value = LANGS[lang].stdin;
                }
                out.textContent = "";
                stat.textContent = "";
            }
            ws.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

            function show(text, isError) {
                out.textContent = "";
                const span = Tools.mk("span", isError ? "err" : null, text);
                out.appendChild(span);
            }

            async function run() {
                const L = LANGS[lang];
                runBtn.disabled = true;
                stat.textContent = "Fordítás és futtatás...";
                out.textContent = "";
                const started = performance.now();

                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 40000);
                try {
                    const res = await fetch(API + L.compiler + "/compile", {
                        method: "POST",
                        signal: ctrl.signal,
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify({
                            source: editor.getValue(),
                            lang: L.lang,
                            options: {
                                userArguments: L.args,
                                executeParameters: { args: [], stdin: stdin.value },
                                compilerOptions: { executorRequest: true },
                                filters: { execute: true }
                            }
                        })
                    });
                    if (!res.ok) throw new Error("HTTP " + res.status);
                    const d = await res.json();
                    const build = d.buildResult || {};
                    const secs = ((performance.now() - started) / 1000).toFixed(1);

                    if (!d.didExecute) {
                        const msg = (textOf(build.stderr) + "\n" + textOf(build.stdout)).replace(/<source>/g, "program").trim();
                        show("Fordítási hiba:\n\n" + (msg || "ismeretlen hiba"), true);
                        stat.textContent = "Nem sikerült lefordítani";
                        return;
                    }

                    out.textContent = "";
                    const warnings = textOf(build.stderr).replace(/<source>/g, "program").trim();
                    if (warnings) out.appendChild(Tools.mk("span", "err", "Figyelmeztetés:\n" + warnings + "\n\n"));
                    out.appendChild(document.createTextNode(textOf(d.stdout)));
                    const errText = textOf(d.stderr).trim();
                    if (errText) out.appendChild(Tools.mk("span", "err", "\n" + errText));
                    if (d.timedOut) out.appendChild(Tools.mk("span", "err", "\nA program túl sokáig futott, ezért leállítottuk."));
                    else if (d.code !== 0) out.appendChild(Tools.mk("span", "err", "\nA program hibakóddal állt le: " + d.code));
                    stat.textContent = "Lefutott, " + secs + " mp";
                } catch (e) {
                    show(e.name === "AbortError"
                        ? "A szerver nem válaszolt időben. Próbáld újra."
                        : "Nem sikerült elérni a fordító szervert. Van internetkapcsolat? (" + e.message + ")", true);
                    stat.textContent = "Hiba történt";
                } finally {
                    clearTimeout(timer);
                    runBtn.disabled = false;
                }
            }
            runBtn.addEventListener("click", run);

            // Mentés / betöltés: a forráskód saját fájlként, a teljes állapot a munkamenet-fájlban
            const EXT = { c: "c", cpp: "cpp", cs: "cs" };
            const BY_EXT = { c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", cs: "cs" };
            const clearOut = () => { out.textContent = ""; stat.textContent = ""; };
            ws._state = {
                get: () => ({ lang, code: editor.getValue(), stdin: stdin.value }),
                set(d) {
                    if (!d) return;
                    if (LANGS[d.lang]) applyLang(d.lang);
                    if (typeof d.code === "string") { editor.setValue(d.code); editor.clearHistory(); }
                    if (typeof d.stdin === "string") stdin.value = d.stdin;
                    clearOut();
                },
                file: {
                    name: () => "program." + EXT[lang],
                    type: "text/plain",
                    accept: ".c,.h,.cpp,.cc,.cxx,.hpp,.cs,.txt",
                    text: () => editor.getValue(),
                    load(text, name) {
                        const next = BY_EXT[(name.split(".").pop() || "").toLowerCase()];
                        if (next) applyLang(next);
                        editor.setValue(text);
                        editor.clearHistory();
                        clearOut();
                    }
                }
            };
        },

        onShow(ws) { requestAnimationFrame(() => ws._editor && ws._editor.refresh()); },
        onResize(ws) { if (ws._editor) ws._editor.refresh(); }
    });
})();
