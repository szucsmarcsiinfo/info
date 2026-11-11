/*
 * Hálózat és OSINT (a DevBox Toolkitből átvéve): IP-helymeghatározás, DNS, WHOIS/RDAP,
 * HTTP-alapú "ping", traceroute-linkek és a saját böngésző adatai.
 * Ez az egyetlen fül, ami külső szolgáltatásnak küld adatot, de csak gombnyomásra.
 */
(function () {
    "use strict";

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const EXT = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
    const ext = (href, label) => '<a class="btn" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + EXT + '<span class="sr-only"> (új lapon nyílik meg)</span></a>';

    const MODES = {
        ip: { label: "IP", hint: "Egy IP-cím helye, szolgáltatója és ASN-je. A címet az ipwho.is szolgáltatás kapja meg." },
        dns: { label: "DNS", hint: "Egy domain DNS-rekordjai (A, MX, TXT...). A kérdést a Cloudflare vagy a Google DNS-over-HTTPS szolgáltatása kapja meg." },
        whois: { label: "WHOIS", hint: "Kié egy domain vagy IP-tartomány, mikor regisztrálták. RDAP-ot használ, ez a WHOIS mai utódja." },
        ping: { label: "Ping", hint: "A böngésző nem tud valódi (ICMP) pinget küldeni, ezért ez HTTPS-kérések idejét méri. Közelítő érték, nem a routerek közti oda-vissza idő." },
        trace: { label: "Traceroute", hint: "Valódi traceroute-hoz nyers ICMP/UDP csomagok kellenek, ezt böngésző nem tud. Ezek az oldalak lefuttatják helyetted." },
        me: { label: "Saját gép", hint: "A böngésződ és a géped adatai, amiket minden weboldal lát. Ezek a gépeden maradnak; a saját IP-det csak a gombra kattintva kérdezi le." }
    };

    async function fetchJSON(url, opts, ms) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), ms || 8000);
        try {
            const res = await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
            if (!res.ok) throw new Error("HTTP " + res.status);
            return await res.json();
        } catch (e) {
            throw e.name === "AbortError" ? new Error("időtúllépés") : e;
        } finally { clearTimeout(id); }
    }
    function kv(pairs) {
        const rows = pairs.filter(p => p[1] !== undefined && p[1] !== null && p[1] !== "");
        if (!rows.length) return '<p class="empty">Nem jött vissza adat.</p>';
        return '<dl class="kv-list">' + rows.map(p => "<dt>" + esc(p[0]) + "</dt><dd>" + esc(p[1]) + "</dd>").join("") + "</dl>";
    }
    const loading = t => '<p class="loading">' + esc(t) + "</p>";
    const errBox = t => '<p class="err">' + esc(t) + "</p>";

    function ipRows(d) {
        return kv([
            ["IP-cím", d.ip], ["Típus", d.type], ["Város", d.city], ["Régió", d.region],
            ["Ország", (d.country || "") + (d.country_code ? " (" + d.country_code + ")" : "")], ["Irányítószám", d.postal],
            ["Szolgáltató", d.connection && (d.connection.isp || d.connection.org)], ["ASN", d.connection && d.connection.asn],
            ["Időzóna", d.timezone && d.timezone.id],
            ["Koordináták", d.latitude != null && d.longitude != null ? d.latitude.toFixed(3) + ", " + d.longitude.toFixed(3) : ""]
        ]);
    }

    const DNS_TYPES = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 257: "CAA" };
    const looksLikeIp = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) || /^[0-9a-f:]+:[0-9a-f:]+$/i.test(s);
    const EVENTS = { registration: "Regisztrálva", expiration: "Lejár", "last changed": "Utoljára módosítva", "last update of RDAP database": "RDAP frissítve", transfer: "Átruházva" };

    Tools.add({
        id: "network-workspace",
        title: "Hálózat (OSINT)",
        html: `
            <div class="left-pane">
                <div class="toolbar">
                    <span>Hálózat és OSINT</span>
                </div>
                <div class="seg net-modes" role="group" aria-label="Eszköz">
                    ${Object.keys(MODES).map(k => '<button class="btn" type="button" data-mode="' + k + '" aria-pressed="' + (k === "ip") + '">' + MODES[k].label + "</button>").join("")}
                </div>
                <div class="side-scroll plain">
                    <p class="hint net-hint"></p>
                    <div class="net-form" data-for="ip">
                        <label class="lbl" for="nw-ip">IP-cím</label>
                        <input id="nw-ip" class="field" type="text" placeholder="pl. 8.8.8.8" autocomplete="off" spellcheck="false">
                        <div class="actions">
                            <button class="btn primary" type="button" data-act="ip">Lekérdezés</button>
                            <button class="btn small" type="button" data-ip="8.8.8.8">8.8.8.8</button>
                            <button class="btn small" type="button" data-ip="1.1.1.1">1.1.1.1</button>
                        </div>
                    </div>
                    <div class="net-form" data-for="dns" hidden>
                        <div class="form-grid">
                            <div>
                                <label class="lbl" for="nw-dns">Domain</label>
                                <input id="nw-dns" class="field" type="text" placeholder="pl. example.com" autocomplete="off" spellcheck="false">
                            </div>
                            <div>
                                <label class="lbl" for="nw-dnstype">Rekordtípus</label>
                                <select id="nw-dnstype" class="btn wide">${["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "CAA"].map(t => "<option>" + t + "</option>").join("")}</select>
                            </div>
                        </div>
                        <div class="actions"><button class="btn primary" type="button" data-act="dns">Lekérdezés</button></div>
                    </div>
                    <div class="net-form" data-for="whois" hidden>
                        <label class="lbl" for="nw-whois">Domain vagy IP-cím</label>
                        <input id="nw-whois" class="field" type="text" placeholder="pl. example.com vagy 8.8.8.8" autocomplete="off" spellcheck="false">
                        <p class="note">Egyes nyilvántartók nem válaszolnak böngészőből érkező kérdésre. Ilyenkor kapsz egy linket a teljes WHOIS-adatokhoz.</p>
                        <div class="actions"><button class="btn primary" type="button" data-act="whois">Lekérdezés</button></div>
                    </div>
                    <div class="net-form" data-for="ping" hidden>
                        <label class="lbl" for="nw-ping">Kiszolgáló</label>
                        <input id="nw-ping" class="field" type="text" placeholder="pl. cloudflare.com" autocomplete="off" spellcheck="false">
                        <div class="actions"><button class="btn primary" type="button" data-act="ping">Ping</button></div>
                    </div>
                    <div class="net-form" data-for="trace" hidden>
                        <div class="actions">
                            <span class="trace-he">${ext("https://bgp.he.net/", "Hurricane Electric looking glass")}</span>
                            ${ext("https://traceroute.org/", "Traceroute-szerverek a világban")}
                        </div>
                    </div>
                    <div class="net-form" data-for="me" hidden>
                        <div class="actions"><button class="btn primary" type="button" data-act="myip">Saját IP-cím lekérése</button></div>
                    </div>
                    <p class="note-box">Ez a fül nem teljesen helyi: a beírt IP-címet vagy domaint HTTPS-en elküldi nyilvános szolgáltatásoknak (ipwho.is, Cloudflare / Google DNS, RDAP-nyilvántartók), hogy válaszolni tudjanak. Ez az oldal semmit nem tárol el.</p>
                </div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Eredmény</span></div>
                <div class="side-scroll">
                    ${Object.keys(MODES).map(k => '<div class="net-out" data-for="' + k + '"' + (k === "ip" ? "" : " hidden") + '><p class="empty">Még nincs eredmény.</p></div>').join("")}
                </div>
            </div>`,

        init(ws) {
            const q = s => ws.querySelector(s);
            const out = k => q('.net-out[data-for="' + k + '"]');
            let mode = "ip";

            function setMode(m) {
                mode = MODES[m] ? m : "ip";
                ws.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"));
                ws.querySelectorAll(".net-form, .net-out").forEach(f => { f.hidden = f.dataset.for !== mode; });
                q(".net-hint").textContent = MODES[mode].hint;
                if (mode === "me") showDevice();
            }
            ws.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));

            function setTraceIp(ip) { q(".trace-he a").href = "https://bgp.he.net/ip/" + encodeURIComponent(ip) + "#_traceroute"; }

            async function lookupIp(ip, box) {
                box.innerHTML = loading(ip ? "Lekérdezés..." : "A saját IP-címed lekérdezése...");
                try {
                    const d = await fetchJSON("https://ipwho.is/" + (ip ? encodeURIComponent(ip) : ""));
                    if (!d.success) throw new Error(d.message || "nem található");
                    return d;
                } catch (e) {
                    box.innerHTML = errBox("Az IP-lekérdezés nem sikerült (" + e.message + ").");
                    return null;
                }
            }
            async function doIp() {
                const ip = q("#nw-ip").value.trim(), box = out("ip");
                if (!ip) { box.innerHTML = '<p class="empty">Írj be egy IP-címet.</p>'; return; }
                const d = await lookupIp(ip, box);
                if (d) { box.innerHTML = ipRows(d); setTraceIp(d.ip); }
            }
            async function doMyIp() {
                const box = q(".my-ip");
                const d = await lookupIp("", box);
                if (d) { box.innerHTML = ipRows(d); setTraceIp(d.ip); }
            }

            async function doDns() {
                const name = q("#nw-dns").value.trim(), type = q("#nw-dnstype").value, box = out("dns");
                if (!name) { box.innerHTML = '<p class="empty">Írj be egy domaint.</p>'; return; }
                box.innerHTML = loading("Lekérdezés...");
                let data = null, last = null;
                for (const url of ["https://cloudflare-dns.com/dns-query?name=", "https://dns.google/resolve?name="]) {
                    try { data = await fetchJSON(url + encodeURIComponent(name) + "&type=" + type, { headers: { Accept: "application/dns-json" } }); break; }
                    catch (e) { last = e; }
                }
                if (!data) { box.innerHTML = errBox("A DNS-lekérdezés nem sikerült (" + (last ? last.message : "ismeretlen hiba") + ")."); return; }
                if (data.Status !== 0 || !data.Answer || !data.Answer.length) {
                    box.innerHTML = '<p class="empty">Nincs ' + esc(type) + " rekord" + (data.Status ? " (állapotkód: " + data.Status + ")" : "") + ".</p>";
                    return;
                }
                box.innerHTML = '<table class="result"><thead><tr><th>Típus</th><th>TTL</th><th>Érték</th></tr></thead><tbody>' +
                    data.Answer.map(a => "<tr><td>" + esc(DNS_TYPES[a.type] || a.type) + "</td><td>" + a.TTL + " s</td><td class=\"mono wrap\">" + esc(a.data) + "</td></tr>").join("") + "</tbody></table>";
            }

            async function doWhois() {
                const v = q("#nw-whois").value.trim(), box = out("whois");
                if (!v) { box.innerHTML = '<p class="empty">Írj be egy domaint vagy IP-címet.</p>'; return; }
                box.innerHTML = loading("Lekérdezés...");
                const kind = looksLikeIp(v) ? "ip" : "domain";
                try {
                    const d = await fetchJSON("https://rdap.org/" + kind + "/" + encodeURIComponent(v), {}, 10000);
                    const rows = [];
                    if (kind === "domain") {
                        rows.push(["Domain", d.ldhName || d.unicodeName || v]);
                        if (d.status) rows.push(["Állapot", d.status.join(", ")]);
                        if (d.nameservers && d.nameservers.length) rows.push(["Névszerverek", d.nameservers.map(n => n.ldhName).filter(Boolean).join(", ")]);
                    } else {
                        rows.push(["IP-tartomány", (d.startAddress || "") + " – " + (d.endAddress || "")], ["Hálózat neve", d.name], ["Ország", d.country], ["Típus", d.type]);
                        if (d.parentHandle) rows.push(["Szülő azonosító", d.parentHandle]);
                    }
                    (d.events || []).forEach(ev => rows.push([EVENTS[ev.eventAction] || ev.eventAction, ev.eventDate ? String(ev.eventDate).slice(0, 10) : ""]));
                    (d.entities || []).forEach(en => { if (en.roles && en.roles.length) rows.push(["Szereplő (" + en.roles.join(", ") + ")", en.handle || ""]); });
                    box.innerHTML = kv(rows);
                } catch (e) {
                    box.innerHTML = errBox("Ez a nyilvántartó nem válaszolt a böngészőnek (" + e.message + ").") +
                        '<div class="actions">' + ext("https://who.is/whois/" + encodeURIComponent(v), "Teljes WHOIS a who.is oldalon") +
                        (kind === "ip" ? ext("https://bgp.he.net/ip/" + encodeURIComponent(v), "Hurricane Electric") : "") + "</div>";
                }
            }

            async function doPing() {
                let host = q("#nw-ping").value.trim();
                const box = out("ping");
                if (!host) { box.innerHTML = '<p class="empty">Írj be egy kiszolgálót.</p>'; return; }
                if (!/^https?:\/\//i.test(host)) host = "https://" + host;
                let base;
                try { base = new URL(host); } catch (e) { box.innerHTML = errBox("Ez nem tűnik érvényes címnek."); return; }
                box.innerHTML = loading(base.hostname + " pingelése...");
                const N = 5, times = [];
                for (let i = 0; i < N; i++) {
                    const t0 = performance.now();
                    try { await fetch(base.origin + "/?_=" + Date.now() + "_" + i, { mode: "no-cors", cache: "no-store" }); times.push(performance.now() - t0); }
                    catch (e) { times.push(null); }
                }
                const ok = times.filter(t => t !== null);
                const stats = ok.length
                    ? kv([["Min. / átlag / max.", Math.min(...ok).toFixed(0) + " / " + (ok.reduce((a, b) => a + b, 0) / ok.length).toFixed(0) + " / " + Math.max(...ok).toFixed(0) + " ms"],
                          ["Elveszett kérések", Math.round((N - ok.length) / N * 100) + "%"]])
                    : errBox("Nem jött válasz. A kiszolgáló nem elérhető, vagy nem enged más oldalakról érkező kéréseket.");
                box.innerHTML = '<p class="mini-label">' + N + " kérés ide: " + esc(base.hostname) + "</p>" +
                    kv(times.map((t, i) => [(i + 1) + ". kérés", t !== null ? t.toFixed(0) + " ms" : "időtúllépés"])) + stats;
            }

            function showDevice() {
                const box = out("me");
                if (box.querySelector(".device")) return;
                const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                box.innerHTML = '<p class="mini-label">Saját IP-cím</p><div class="my-ip"><p class="empty">Kattints a „Saját IP-cím lekérése” gombra.</p></div>' +
                    '<p class="mini-label">Böngésző és eszköz</p><div class="device">' + kv([
                        ["Böngésző azonosító", navigator.userAgent],
                        ["Platform", navigator.platform || ""],
                        ["Nyelv(ek)", (navigator.languages || [navigator.language]).join(", ")],
                        ["Időzóna", Intl.DateTimeFormat().resolvedOptions().timeZone],
                        ["Képernyő", screen.width + " × " + screen.height + " @" + (window.devicePixelRatio || 1) + "x"],
                        ["Ablak", innerWidth + " × " + innerHeight],
                        ["Processzormagok", navigator.hardwareConcurrency || ""],
                        ["Memória", navigator.deviceMemory ? navigator.deviceMemory + " GB" : ""],
                        ["Kapcsolat típusa", c ? c.effectiveType || "" : ""],
                        ["Színséma", matchMedia("(prefers-color-scheme: dark)").matches ? "sötét" : "világos"],
                        ["Ne kövess (DNT)", navigator.doNotTrack === "1" ? "bekapcsolva" : "nincs megadva"],
                        ["Sütik engedélyezve", navigator.cookieEnabled ? "igen" : "nem"]
                    ]) + "</div>";
            }

            const actions = { ip: doIp, dns: doDns, whois: doWhois, ping: doPing, myip: doMyIp };
            ws.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => actions[b.dataset.act]()));
            ws.querySelectorAll("[data-ip]").forEach(b => b.addEventListener("click", () => { q("#nw-ip").value = b.dataset.ip; doIp(); }));
            [["#nw-ip", doIp], ["#nw-dns", doDns], ["#nw-whois", doWhois], ["#nw-ping", doPing]].forEach(([sel, fn]) =>
                q(sel).addEventListener("keydown", e => { if (e.key === "Enter") fn(); }));
            setMode("ip");

            ws._state = {
                get: () => ({ mode, ip: q("#nw-ip").value, dns: q("#nw-dns").value, dnsType: q("#nw-dnstype").value, whois: q("#nw-whois").value, ping: q("#nw-ping").value }),
                set(d) {
                    if (!d) return;
                    [["ip", "#nw-ip"], ["dns", "#nw-dns"], ["whois", "#nw-whois"], ["ping", "#nw-ping"]].forEach(([k, sel]) => { if (typeof d[k] === "string") q(sel).value = d[k]; });
                    if (["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "CAA"].includes(d.dnsType)) q("#nw-dnstype").value = d.dnsType;
                    setMode(d.mode);
                }
            };
        }
    });
})();
