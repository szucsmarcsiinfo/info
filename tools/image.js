/*
 * Képátalakító és tömörítő (a DevBox Toolkitből átvéve).
 * JPG ⇄ PNG, WebP-tömörítés és többméretes ICO favicon. A kép nem hagyja el a gépet.
 */
(function () {
    "use strict";

    const ICON_UP = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

    function humanSize(b) {
        if (b < 1024) return b + " B";
        if (b < 1048576) return (b / 1024).toFixed(1).replace(".", ",") + " KB";
        return (b / 1048576).toFixed(2).replace(".", ",") + " MB";
    }
    function canvasToBlob(canvas, mime, q) {
        return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("a böngésző nem tudta elkészíteni")), mime, q));
    }

    Tools.add({
        id: "image-workspace",
        title: "Képátalakító",
        html: `
            <div class="left-pane">
                <div class="toolbar"><span>Képátalakító</span></div>
                <div class="side-scroll plain">
                    <p class="hint">JPG ⇄ PNG átalakítás, WebP- és JPEG-tömörítés, és többméretes ICO favicon készítése. A kép a böngészőben marad, nem töltődik fel sehova.</p>
                    <div class="dropzone" tabindex="0" role="button" aria-label="Kép kiválasztása vagy ide húzása">
                        ${ICON_UP}
                        <div><b>Húzz ide egy képet</b>, vagy kattints a tallózáshoz</div>
                        <small>PNG, JPG, WEBP, GIF, BMP</small>
                        <input type="file" accept="image/*" hidden>
                    </div>
                    <div class="img-controls" hidden>
                        <div class="form-grid">
                            <div>
                                <label class="lbl" for="im-fmt">Kimeneti formátum</label>
                                <select id="im-fmt" class="btn wide">
                                    <option value="image/png">PNG (veszteségmentes, átlátszó)</option>
                                    <option value="image/jpeg">JPEG / JPG (kicsi, nem átlátszó)</option>
                                    <option value="image/webp">WebP (legjobb tömörítés)</option>
                                    <option value="ico">ICO (favicon, több méret)</option>
                                </select>
                            </div>
                            <div class="im-quality">
                                <label class="lbl" for="im-q">Minőség <span class="range-val">0,82</span></label>
                                <input type="range" id="im-q" min="0.1" max="1" step="0.01" value="0.82">
                                <p class="note">Kisebb érték, kisebb fájl (csak JPEG és WebP).</p>
                            </div>
                            <div class="im-resize">
                                <label class="lbl" for="im-max">Legnagyobb szélesség/magasság (px)</label>
                                <input type="number" id="im-max" class="field" min="16" placeholder="pl. 1920, üresen marad az eredeti">
                            </div>
                            <div class="im-ico" hidden>
                                <label class="lbl" for="im-sizes">ICO méretek</label>
                                <select id="im-sizes" class="btn wide">
                                    <option value="16,32,48,64,128,256">Mind (16, 32, 48, 64, 128, 256)</option>
                                    <option value="16,32,48">Favicon-készlet (16, 32, 48)</option>
                                    <option value="256">Egy darab 256 × 256</option>
                                    <option value="64">Egy darab 64 × 64</option>
                                </select>
                            </div>
                        </div>
                        <div class="actions">
                            <button class="btn primary" type="button" data-act="convert">Átalakítás</button>
                            <button class="btn" type="button" data-act="download" hidden>Letöltés</button>
                            <button class="btn" type="button" data-act="clear">Törlés</button>
                        </div>
                    </div>
                    <p class="im-err err" role="status"></p>
                    <p class="note-box">A JPEG nem tud átlátszó lenni: ha átlátszó PNG-t alakítasz JPG-vé, a háttér fehér lesz. Az átlátszóság megtartásához válaszd a PNG-t vagy a WebP-t.</p>
                </div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Eredmény</span></div>
                <div class="side-scroll im-out">
                    <p class="empty">Válassz ki egy képet, állítsd be a formátumot, és nyomd meg az Átalakítás gombot.</p>
                    <div class="im-result" hidden>
                        <div class="preview-grid">
                            <figure><figcaption class="mini-label">Eredeti</figcaption><div class="thumb"><img class="im-orig" alt="Az eredeti kép"></div></figure>
                            <figure><figcaption class="mini-label">Eredmény</figcaption><div class="thumb"><img class="im-new" alt="Az átalakított kép"></div></figure>
                        </div>
                        <dl class="kv-list"></dl>
                    </div>
                </div>
            </div>`,

        init(ws) {
            const q = s => ws.querySelector(s);
            const drop = q(".dropzone"), fileInput = drop.querySelector("input"), controls = q(".img-controls");
            const fmt = q("#im-fmt"), qual = q("#im-q"), max = q("#im-max"), sizes = q("#im-sizes"), err = q(".im-err");
            const dlBtn = q('[data-act="download"]'), convBtn = q('[data-act="convert"]');
            let img = null, file = null, outBlob = null, outExt = "png", urls = [];

            const track = u => (urls.push(u), u);
            function freeUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }

            function fmtChanged() {
                const lossy = fmt.value === "image/jpeg" || fmt.value === "image/webp";
                q(".im-quality").classList.toggle("disabled", !lossy);
                qual.disabled = !lossy;
                q(".im-ico").hidden = fmt.value !== "ico";
                q(".im-resize").hidden = fmt.value === "ico";
            }
            fmt.addEventListener("change", fmtChanged);
            qual.addEventListener("input", () => { q(".range-val").textContent = (+qual.value).toFixed(2).replace(".", ","); });

            function loadFile(f) {
                if (!f || !f.type.startsWith("image/")) { err.textContent = "Ez nem képfájl. Válassz egy képet."; return; }
                err.textContent = "";
                const url = URL.createObjectURL(f);
                const im = new Image();
                im.onload = () => {
                    freeUrls();
                    urls.push(url);
                    img = im; file = f; outBlob = null;
                    controls.hidden = false;
                    dlBtn.hidden = true;
                    q(".im-result").hidden = true;
                    q(".im-out .empty").hidden = false;
                    q(".im-out .empty").textContent = f.name + " betöltve (" + im.naturalWidth + " × " + im.naturalHeight + " px, " + humanSize(f.size) + "). Nyomd meg az Átalakítás gombot.";
                    // A szokásos irány: PNG-ből JPG, JPG-ből PNG
                    if (/png/i.test(f.type)) fmt.value = "image/jpeg";
                    else if (/jpe?g/i.test(f.type)) fmt.value = "image/png";
                    fmtChanged();
                };
                im.onerror = () => { URL.revokeObjectURL(url); err.textContent = "Ezt a képet nem sikerült beolvasni."; };
                im.src = url;
            }
            drop.addEventListener("click", () => fileInput.click());
            drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
            fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
            ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
            ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
            drop.addEventListener("drop", e => { if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });

            function targetDims() {
                let w = img.naturalWidth, h = img.naturalHeight;
                const m = parseInt(max.value, 10);
                if (m > 0 && (w > m || h > m)) { const s = Math.min(m / w, m / h); w = Math.round(w * s); h = Math.round(h * s); }
                return { w, h };
            }
            function drawTo(w, h, mime) {
                const c = document.createElement("canvas");
                c.width = w; c.height = h;
                const ctx = c.getContext("2d");
                if (mime === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, w, h);
                return c;
            }
            // PNG képeket tartalmazó .ico (minden mai böngésző és a Windows is érti)
            async function buildIco(list) {
                const pngs = [];
                for (const s of list) pngs.push({ size: s, buf: new Uint8Array(await (await canvasToBlob(drawTo(s, s, "image/png"), "image/png")).arrayBuffer()) });
                const header = new Uint8Array(6 + pngs.length * 16), dv = new DataView(header.buffer);
                dv.setUint16(2, 1, true);
                dv.setUint16(4, pngs.length, true);
                let offset = header.length;
                pngs.forEach((p, i) => {
                    const o = 6 + i * 16;
                    header[o] = header[o + 1] = p.size >= 256 ? 0 : p.size;
                    dv.setUint16(o + 4, 1, true);
                    dv.setUint16(o + 6, 32, true);
                    dv.setUint32(o + 8, p.buf.length, true);
                    dv.setUint32(o + 12, offset, true);
                    offset += p.buf.length;
                });
                return new Blob([header, ...pngs.map(p => p.buf)], { type: "image/x-icon" });
            }

            convBtn.addEventListener("click", async () => {
                if (!img) return;
                err.textContent = "";
                convBtn.disabled = true;
                convBtn.textContent = "Dolgozom...";
                try {
                    let dims;
                    if (fmt.value === "ico") {
                        const list = sizes.value.split(",").map(Number);
                        outBlob = await buildIco(list);
                        outExt = "ico";
                        dims = list.map(s => s + " × " + s).join(", ");
                    } else {
                        const { w, h } = targetDims();
                        const lossy = fmt.value === "image/jpeg" || fmt.value === "image/webp";
                        outBlob = await canvasToBlob(drawTo(w, h, fmt.value), fmt.value, lossy ? parseFloat(qual.value) : undefined);
                        if (fmt.value === "image/webp" && outBlob.type !== "image/webp") throw new Error("ez a böngésző nem tud WebP-t menteni");
                        outExt = { "image/jpeg": "jpg", "image/webp": "webp" }[fmt.value] || "png";
                        dims = w + " × " + h + " px";
                    }
                    q(".im-orig").src = urls[0];
                    q(".im-new").src = track(URL.createObjectURL(outBlob));
                    const diff = file.size - outBlob.size, pct = file.size ? Math.round(diff / file.size * 100) : 0;
                    const rows = [
                        ["Forrás", (file.type || "kép") + ", " + file.name],
                        ["Eredeti méret", humanSize(file.size)],
                        ["Új méret", humanSize(outBlob.size)],
                        ["Megtakarítás", diff > 0 ? humanSize(diff) + " (" + pct + "%-kal kisebb)" : diff < 0 ? humanSize(-diff) + "-tal nagyobb" : "nincs változás"],
                        ["Képméret", dims]
                    ];
                    const dl = q(".kv-list");
                    dl.innerHTML = "";
                    rows.forEach(([k, v], i) => {
                        dl.append(Tools.mk("dt", null, k));
                        const dd = Tools.mk("dd", null, v);
                        if (i === 3) dd.className = diff > 0 ? "good" : diff < 0 ? "bad" : "";
                        dl.append(dd);
                    });
                    q(".im-result").hidden = false;
                    q(".im-out .empty").hidden = true;
                    dlBtn.hidden = false;
                } catch (e) {
                    err.textContent = "Az átalakítás nem sikerült: " + e.message + ".";
                } finally {
                    convBtn.disabled = false;
                    convBtn.textContent = "Átalakítás";
                }
            });

            dlBtn.addEventListener("click", () => {
                if (!outBlob) return;
                const base = (file.name || "kep").replace(/\.[^.]+$/, "");
                Tools.download(outBlob, outExt === "ico" ? "favicon.ico" : base + "." + outExt);
            });
            q('[data-act="clear"]').addEventListener("click", () => {
                freeUrls();
                img = file = outBlob = null;
                fileInput.value = "";
                controls.hidden = true;
                err.textContent = "";
                q(".im-result").hidden = true;
                q(".im-out .empty").hidden = false;
                q(".im-out .empty").textContent = "Válassz ki egy képet, állítsd be a formátumot, és nyomd meg az Átalakítás gombot.";
            });
            fmtChanged();
        }
    });
})();
