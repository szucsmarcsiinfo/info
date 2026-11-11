/*
 * Titkosítás gyakorló: hash (MD5, SHA-1, SHA-256, SHA-512), Base64 és AES.
 * A számolás a böngészőben történik (CryptoJS), semmi nem megy ki a gépedről.
 */
(function () {
    "use strict";

    const HINTS = {
        hash: "A hash a szöveg ujjlenyomata. Ugyanabból a szövegből mindig ugyanaz jön ki, de az eredményből nem lehet visszaszámolni a szöveget. Írj át egy betűt, és nézd meg, mennyit változik.",
        b64: "A Base64 nem titkosítás. Csak átírja a szöveget olyan betűkre, amiket bárhol el lehet küldeni. Bárki vissza tudja fejteni.",
        aes: "Az AES jelszóval titkosít, és ugyanazzal a jelszóval lehet visszafejteni. Minden titkosításnál más az eredmény, mert a program véletlen sót tesz bele. A visszafejtés ettől még működik."
    };

    function copyText(text, btn) {
        const done = () => { const old = btn.textContent; btn.textContent = "Másolva"; setTimeout(() => { btn.textContent = old; }, 1200); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
        } else fallbackCopy(text, done);
    }
    function fallbackCopy(text, done) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* nem sikerült */ }
        ta.remove();
    }

    Tools.add({
        id: "crypto-workspace",
        title: "Titkosítás",
        libs: ["https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"],
        html: `
            <div class="left-pane">
                <div class="toolbar">
                    <span>Titkosítás</span>
                    <div class="seg" role="group" aria-label="Mit szeretnél kipróbálni?">
                        <button class="btn" data-mode="hash" aria-pressed="true">Hash</button>
                        <button class="btn" data-mode="b64" aria-pressed="false">Base64</button>
                        <button class="btn" data-mode="aes" aria-pressed="false">AES</button>
                    </div>
                </div>
                <p class="hint"></p>
                <label class="lbl" for="cr-input">Szöveg</label>
                <textarea id="cr-input" class="field grow" spellcheck="false" placeholder="Írj ide valamit...">Szia világ</textarea>
                <div class="aes-only" hidden>
                    <label class="lbl" for="cr-pass">Jelszó</label>
                    <input id="cr-pass" class="field" type="text" value="titok123" autocomplete="off" spellcheck="false">
                </div>
                <div class="actions b64-actions" hidden>
                    <div class="seg" role="group" aria-label="Irány">
                        <button class="btn" data-dir="enc" aria-pressed="true">Kódolás</button>
                        <button class="btn" data-dir="dec" aria-pressed="false">Visszafejtés</button>
                    </div>
                </div>
                <div class="actions aes-actions" hidden>
                    <button class="btn primary" data-act="encrypt">Titkosítás</button>
                    <button class="btn" data-act="decrypt">Visszafejtés</button>
                </div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Eredmény</span></div>
                <div class="side-scroll cr-out"></div>
            </div>`,

        init(ws) {
            const input = ws.querySelector("#cr-input");
            const pass = ws.querySelector("#cr-pass");
            const out = ws.querySelector(".cr-out");
            const hint = ws.querySelector(".hint");
            let mode = "hash", dir = "enc", aesResult = null;

            function row(name, value, isErr, extraBtns) {
                const r = Tools.mk("div", "out-row");
                const head = Tools.mk("div", "name");
                head.appendChild(Tools.mk("span", null, name));
                const btns = Tools.mk("span");
                btns.style.display = "flex";
                btns.style.gap = "6px";
                if (!isErr) {
                    const copy = Tools.mk("button", "btn small", "Másolás");
                    copy.addEventListener("click", () => copyText(value, copy));
                    btns.appendChild(copy);
                    (extraBtns || []).forEach(x => btns.appendChild(x));
                }
                head.appendChild(btns);
                r.appendChild(head);
                r.appendChild(Tools.mk("code", "val" + (isErr ? " err" : ""), value));
                return r;
            }

            function useAsInput(value) {
                const b = Tools.mk("button", "btn small", "Bemenetnek");
                b.title = "Az eredményt beteszi a Szöveg mezőbe";
                b.addEventListener("click", () => { input.value = value; refresh(); });
                return b;
            }

            function renderHash() {
                const t = input.value;
                const C = CryptoJS;
                out.replaceChildren(
                    row("MD5 (128 bit)", C.MD5(t).toString()),
                    row("SHA-1 (160 bit)", C.SHA1(t).toString()),
                    row("SHA-256 (256 bit)", C.SHA256(t).toString()),
                    row("SHA-512 (512 bit)", C.SHA512(t).toString()),
                    Tools.mk("p", "hint", "Az MD5 és az SHA-1 már nem számít biztonságosnak. Jelszavak tárolására egyiket se használd.")
                );
            }

            function renderB64() {
                const t = input.value;
                try {
                    const res = dir === "enc"
                        ? CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(t))
                        : CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(t.trim()));
                    if (dir === "dec" && t.trim() && !res) throw new Error("üres");
                    out.replaceChildren(row(dir === "enc" ? "Base64 kód" : "Visszafejtett szöveg", res, false, [useAsInput(res)]));
                } catch (e) {
                    out.replaceChildren(row("Hiba", "Ez nem érvényes Base64 szöveg.", true));
                }
            }

            function renderAes() {
                if (!aesResult) {
                    out.replaceChildren(Tools.mk("p", "hint", "Írj be egy szöveget és egy jelszót, majd kattints a Titkosítás gombra."));
                    return;
                }
                out.replaceChildren(row(aesResult.name, aesResult.value, aesResult.err, aesResult.err ? [] : [useAsInput(aesResult.value)]));
            }

            function refresh() {
                if (mode === "hash") renderHash();
                else if (mode === "b64") renderB64();
                else renderAes();
            }

            function setMode(m) {
                mode = m;
                aesResult = null;
                ws.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false"));
                hint.textContent = HINTS[m];
                ws.querySelector(".aes-only").hidden = m !== "aes";
                ws.querySelector(".aes-actions").hidden = m !== "aes";
                ws.querySelector(".b64-actions").hidden = m !== "b64";
                refresh();
            }

            ws.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
            ws.querySelectorAll("[data-dir]").forEach(b => b.addEventListener("click", () => {
                dir = b.dataset.dir;
                ws.querySelectorAll("[data-dir]").forEach(x => x.setAttribute("aria-pressed", x.dataset.dir === dir ? "true" : "false"));
                refresh();
            }));

            ws.querySelector('[data-act="encrypt"]').addEventListener("click", () => {
                if (!pass.value) { aesResult = { name: "Hiba", value: "Adj meg egy jelszót.", err: true }; renderAes(); return; }
                aesResult = { name: "Titkosított szöveg (Base64)", value: CryptoJS.AES.encrypt(input.value, pass.value).toString() };
                renderAes();
            });

            ws.querySelector('[data-act="decrypt"]').addEventListener("click", () => {
                if (!pass.value) { aesResult = { name: "Hiba", value: "Adj meg egy jelszót.", err: true }; renderAes(); return; }
                try {
                    const plain = CryptoJS.AES.decrypt(input.value.trim(), pass.value).toString(CryptoJS.enc.Utf8);
                    if (!plain) throw new Error("rossz jelszó");
                    aesResult = { name: "Visszafejtett szöveg", value: plain };
                } catch (e) {
                    aesResult = { name: "Hiba", value: "Nem sikerült visszafejteni. Rossz a jelszó, vagy a szöveg nem AES-sel titkosított.", err: true };
                }
                renderAes();
            });

            input.addEventListener("input", () => { if (mode !== "aes") refresh(); });
            setMode("hash");

            // Állapot a mentéshez: mód, irány, szöveg és jelszó (JSON-ként)
            ws._state = {
                get: () => ({ mode, dir, input: input.value, pass: pass.value }),
                set(d) {
                    if (!d) return;
                    if (typeof d.input === "string") input.value = d.input;
                    if (typeof d.pass === "string") pass.value = d.pass;
                    if (d.dir === "enc" || d.dir === "dec") {
                        dir = d.dir;
                        ws.querySelectorAll("[data-dir]").forEach(x => x.setAttribute("aria-pressed", x.dataset.dir === dir ? "true" : "false"));
                    }
                    setMode(HINTS[d.mode] !== undefined ? d.mode : mode);
                }
            };
        }
    });
})();
