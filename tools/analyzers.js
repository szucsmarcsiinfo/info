/*
 * Hash-felismerő és Kódolás-felismerő (a DevBox Toolkitből átvéve).
 * Hossz, karakterkészlet és előtag alapján megtippeli, mi lehet egy szöveg.
 * Minden a böngészőben fut, semmi nem megy ki a gépedről.
 */
(function () {
    "use strict";

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const CONF = { high: "valószínű", med: "lehetséges", low: "tipp" };

    function renderCands(box, list, emptyText) {
        if (!list.length) { box.innerHTML = '<p class="empty">' + esc(emptyText) + "</p>"; return; }
        box.innerHTML = '<p class="mini-label">' + list.length + " találat, a legvalószínűbb elöl</p>" +
            list.map(r => '<div class="cand"><div class="cand-top"><span class="cand-name">' + esc(r.name) +
                '</span><span class="conf ' + r.conf + '">' + CONF[r.conf] + '</span></div><p class="cand-meta">' + esc(r.meta) + "</p>" +
                (r.decoded != null ? '<pre class="decoded">' + esc(r.decoded) + "</pre>" : "") + "</div>").join("");
    }

    function samples(list, attr) {
        return list.map(([label, val]) => '<button class="btn small" type="button" data-' + attr + '="' + esc(val) + '">' + esc(label) + "</button>").join("");
    }

    // ---------------- Hash-felismerő ----------------
    function identifyHash(raw) {
        const h = raw.trim();
        if (!h) return [];
        const out = [];
        const add = (name, conf, meta) => out.push({ name, conf, meta });

        // Előtaggal jelölt formátumok: ezek biztosak
        if (/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(h)) add("bcrypt", "high", "Modern jelszó-hash (Blowfish alapú). Benne van a költség-tényező és a só.");
        else if (/^\$argon2(id|i|d)\$/.test(h)) add("Argon2", "high", "Sok memóriát igénylő jelszó-hash (a Password Hashing Competition győztese).");
        else if (/^\$6\$/.test(h)) add("sha512crypt ($6$)", "high", "Unix crypt SHA-512-vel, az /etc/shadow fájlból.");
        else if (/^\$5\$/.test(h)) add("sha256crypt ($5$)", "high", "Unix crypt SHA-256-tal, az /etc/shadow fájlból.");
        else if (/^\$1\$/.test(h)) add("md5crypt ($1$)", "high", "Régi Unix MD5 crypt.");
        else if (/^\$y\$/.test(h)) add("yescrypt", "high", "Az újabb Linux-disztribúciók alapértelmezett jelszó-hash-e.");
        else if (/^\{SSHA\}/.test(h)) add("LDAP {SSHA}", "high", "Sózott SHA-1, Base64-ben (OpenLDAP).");
        else if (/^\{SHA\}/.test(h)) add("LDAP {SHA}", "high", "SHA-1 Base64-ben (OpenLDAP).");
        else if (/^[0-9a-f]{32}:[0-9a-f]{32}$/i.test(h)) add("MD5(só) / hash:só", "med", "Két 32 karakteres hexa rész, gyakran hash:só.");
        else if (/^\*[0-9A-F]{40}$/i.test(h)) add("MySQL 4.1+ (SHA1(SHA1))", "high", "A kezdő * és a 40 hexa karakter árulja el.");

        if (out.length && out[0].conf === "high") return out;

        if (/^[\w-]+\.[\w-]+\.[\w-]*$/.test(h)) add("JWT (JSON Web Token)", "high", "Ez nem hash, hanem aláírt token. A Kódolás-felismerő fül ki is bontja.");

        const isHex = /^[0-9a-f]+$/i.test(h);
        const isB64 = /^[A-Za-z0-9+/]+={0,2}$/.test(h);
        const L = h.length;
        if (isHex) {
            const map = {
                8: [["CRC-32", "low"], ["Adler-32", "low"], ["CRC-32B", "low"]],
                16: [["CRC-64", "low"], ["MySQL 4.1 előtti jelszó", "med"], ["DES (Unix)", "low"]],
                32: [["MD5", "high"], ["NTLM", "high"], ["MD4", "med"], ["MD2", "low"], ["RIPEMD-128", "low"], ["dupla MD5", "low"]],
                40: [["SHA-1", "high"], ["RIPEMD-160", "med"], ["SHA-0", "low"], ["HAVAL-160", "low"]],
                56: [["SHA-224", "high"], ["SHA3-224", "med"], ["HAVAL-224", "low"]],
                64: [["SHA-256", "high"], ["SHA3-256", "med"], ["BLAKE2s-256", "low"], ["RIPEMD-256", "low"], ["Keccak-256", "low"]],
                96: [["SHA-384", "high"], ["SHA3-384", "med"]],
                128: [["SHA-512", "high"], ["SHA3-512", "med"], ["Whirlpool", "med"], ["BLAKE2b-512", "low"], ["Keccak-512", "low"]]
            };
            const list = map[L];
            if (list) list.forEach(([n, c]) => add(n, c, L + " hexa karakter (" + L * 4 + " bit)."));
            else add("Ismeretlen hexa kivonat", "low", L + " hexa karakter. Egyik gyakori algoritmusnak sincs ilyen hossza.");
        } else if (isB64 && L % 4 === 0) {
            if (L === 24) add("MD5 (Base64)", "med", "16 bájt Base64-ben.");
            else if (L === 28) add("SHA-1 (Base64)", "med", "20 bájt Base64-ben.");
            else if (L === 44) add("SHA-256 (Base64)", "med", "32 bájt Base64-ben.");
            else if (L === 88) add("SHA-512 (Base64)", "med", "64 bájt Base64-ben.");
            else add("Base64-ben kódolt kivonat", "low", "Base64-nek tűnik. Fejtsd vissza, és nézd meg, hány bájt.");
        } else {
            add("Nem ismert hash", "low", "Hexán és Base64-en kívüli karakterek vannak benne, vagy szokatlan a hossza.");
        }
        return out;
    }

    Tools.add({
        id: "hashid-workspace",
        title: "Hash-felismerő",
        html: `
            <div class="left-pane">
                <div class="toolbar"><span>Hash-felismerő</span></div>
                <p class="hint">Illessz be egy hash-t, és a program a hossza, a karakterei és az előtagja alapján megmondja, melyik algoritmus lehetett. Visszafejteni nem tudja: a hash egyirányú.</p>
                <label class="lbl" for="hi-input">Hash</label>
                <textarea id="hi-input" class="field grow" spellcheck="false" placeholder="pl. 5f4dcc3b5aa765d61d8327deb882cf99"></textarea>
                <div class="actions">
                    <button class="btn primary" type="button" data-act="identify">Felismerés</button>
                </div>
                <p class="mini-label samples-label">Példák</p>
                <div class="samples">${samples([
                    ["MD5", "5f4dcc3b5aa765d61d8327deb882cf99"],
                    ["bcrypt", "$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"],
                    ["SHA-256", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"]
                ], "sample")}</div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Lehetséges algoritmusok</span></div>
                <div class="side-scroll hi-out"><p class="empty">Írj be egy hash-t, és nyomd meg a Felismerés gombot.</p></div>
            </div>`,
        init(ws) {
            const input = ws.querySelector("#hi-input"), out = ws.querySelector(".hi-out");
            const run = () => renderCands(out, identifyHash(input.value), "Írj be egy hash-t, és nyomd meg a Felismerés gombot.");
            ws.querySelector('[data-act="identify"]').addEventListener("click", run);
            ws.querySelectorAll("[data-sample]").forEach(b => b.addEventListener("click", () => { input.value = b.dataset.sample; run(); }));
            input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); });
            ws._state = {
                get: () => ({ input: input.value }),
                set(d) { if (d && typeof d.input === "string") { input.value = d.input; run(); } }
            };
        }
    });

    // ---------------- Kódolás-felismerő ----------------
    function shannon(str) {
        const map = {};
        for (const ch of str) map[ch] = (map[ch] || 0) + 1;
        let e = 0;
        for (const k in map) { const p = map[k] / str.length; e -= p * Math.log2(p); }
        return e;
    }
    function tryJSON(s) { try { return JSON.stringify(JSON.parse(s), null, 2); } catch (e) { return null; } }
    function b64decode(s) {
        try {
            const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
            return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
        } catch (e) { return null; }
    }
    function rot13(s) { return s.replace(/[a-z]/gi, c => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(b + (c.charCodeAt(0) - b + 13) % 26); }); }
    function atbash(s) { return s.replace(/[a-zA-Z]/g, c => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }); }
    function rot47(s) { return s.replace(/[!-~]/g, c => String.fromCharCode(33 + (c.charCodeAt(0) - 33 + 47) % 94)); }
    function printableRatio(s) {
        let p = 0;
        for (const c of s) { const n = c.charCodeAt(0); if ((n >= 32 && n < 127) || n === 9 || n === 10 || n === 13 || n > 159) p++; }
        return s.length ? p / s.length : 0;
    }
    function indexOfCoincidence(s) {
        const letters = s.toUpperCase().replace(/[^A-Z]/g, "");
        const n = letters.length;
        if (n < 2) return null;
        const freq = {};
        for (const c of letters) freq[c] = (freq[c] || 0) + 1;
        let sum = 0;
        for (const k in freq) sum += freq[k] * (freq[k] - 1);
        return sum / (n * (n - 1));
    }
    function looksLikeFernet(s) {
        if (!/^[A-Za-z0-9_-]{20,}=*$/.test(s)) return false;
        try { const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return bin.length >= 73 && bin.charCodeAt(0) === 0x80; }
        catch (e) { return false; }
    }
    const MORSE = { ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y", "--..": "Z", "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4", ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9" };
    function base32decode(s) {
        const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = "";
        for (const c of s.replace(/=+$/, "")) bits += A.indexOf(c).toString(2).padStart(5, "0");
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
        return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    }

    function analyse(raw) {
        const s = raw.trim();
        if (!s) return [];
        const out = [];
        const add = (name, conf, meta, decoded) => out.push({ name, conf, meta, decoded });
        const NOKEY = "A visszafejtéshez titkos kulcs kell, ezt a program nem próbálja meg.";

        if (/^[\w-]+\.[\w-]+\.[\w-]*$/.test(s)) {
            const parts = s.split(".");
            const head = b64decode(parts[0]), body = b64decode(parts[1]);
            const hj = head ? tryJSON(head) : null, bj = body ? tryJSON(body) : null;
            if (hj) {
                add("JWT (JSON Web Token)", "high", "Fejléc + tartalom + aláírás, Base64URL-ben. Nincs titkosítva, bárki elolvashatja.",
                    "FEJLÉC:\n" + hj + "\n\nTARTALOM:\n" + (bj || body || "(olvashatatlan)") + "\n\nALÁÍRÁS:\n" + parts[2]);
                return out;
            }
        }
        if (/^[\w-]*\.[\w-]*\.[\w-]*\.[\w-]*\.[\w-]+$/.test(s)) {
            const jh = b64decode(s.split(".")[0]), jhj = jh ? tryJSON(jh) : null;
            if (jhj && /"(enc|alg)"/.test(jhj)) add("JWE (JSON Web Encryption)", "high", "Ötrészes token: fejléc, titkosított kulcs, IV, titkosított adat, hitelesítő címke. Ez valódi titkosítás. " + NOKEY);
            else add("JWE (lehetséges)", "low", "Öt pontokkal elválasztott részből áll, mint egy JWE, de a fejléce nem olvasható.");
        }
        if (/-----BEGIN CERTIFICATE-----/.test(s)) add("X.509 tanúsítvány (PEM)", "high", "Nyilvános tanúsítvány. Nyugodtan megosztható, nincs benne titkos kulcs.");
        if (/-----BEGIN (RSA |EC |DSA |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/.test(s)) add("Privát kulcs (PEM)", "high", "Ez titkos kulcs! Soha ne oszd meg, és ne illeszd be megbízhatatlan helyre.");
        if (/-----BEGIN PUBLIC KEY-----/.test(s)) add("Nyilvános kulcs (PEM / SPKI)", "high", "Nyilvános kulcs, nyugodtan megosztható.");
        if (/-----BEGIN PGP MESSAGE-----/.test(s)) add("PGP/GPG titkosított üzenet", "high", "OpenPGP titkosított szöveg. A címzett privát kulcsa és jelszava kell hozzá.");
        if (/-----BEGIN PGP PUBLIC KEY BLOCK-----/.test(s)) add("PGP/GPG nyilvános kulcs", "high", "Nyilvános kulcsblokk, megosztható.");
        if (/-----BEGIN PGP PRIVATE KEY BLOCK-----/.test(s)) add("PGP/GPG privát kulcs", "high", "Privát kulcsblokk. Tartsd titokban.");
        if (/-----BEGIN PGP SIGNATURE-----/.test(s)) add("PGP/GPG aláírás", "high", "A hitelességet igazolja. Ez aláírás, nem titkosított adat.");
        if (/age-encryption\.org\/v1/.test(s) || /^age1[0-9a-z]{20,}$/i.test(s)) add("age titkosított fájl / címzett", "high", "Modern fájltitkosítási formátum (age/rage). A hozzá tartozó privát kulcs kell a visszafejtéshez.");
        if (/^(ssh-rsa|ssh-ed25519|ssh-dss|ecdsa-sha2-nistp(256|384|521))\s+[A-Za-z0-9+/]+=*(\s+\S+)?$/.test(s)) add("SSH nyilvános kulcs", "high", "authorized_keys formátumú nyilvános kulcs, megosztható.");
        if (looksLikeFernet(s)) add("Fernet token", "high", "A Python cryptography könyvtár szimmetrikus titkosítása (AES-128-CBC + HMAC). " + NOKEY);
        if (/^<~[!-u\s]+~>$/.test(s)) add("Ascii85 / Base85", "high", "<~ és ~> jelek közé zárt kódolás. Ez kódolás, nem titkosítás.");
        if (/^xn--[a-z0-9-]+$/i.test(s)) add("Punycode (ékezetes domain)", "high", "Ékezetes domainnév ASCII-alakja, pl. xn--rvztr-... Nem titkosítás.");
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) add("UUID", "high", "128 bites egyedi azonosító, nem titkosított adat.");
        if (/^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(s)) add("Bitcoin-cím", "high", "Nyilvános tárcacím. Megosztható, nem ad hozzáférést a pénzhez.");
        if (/^0x[0-9a-fA-F]{40}$/.test(s)) add("Ethereum-cím", "high", "Nyilvános tárcacím, megosztható.");
        if (/%[0-9a-f]{2}/i.test(s)) {
            let d = null;
            try { d = decodeURIComponent(s); } catch (e) { /* hibás % jelsorozat */ }
            add("URL-kódolás (százalékos)", "high", "%XX alakú jelsorozatok vannak benne.", d);
        }
        if (/^[0-9a-f\s]+$/i.test(s) && s.replace(/\s/g, "").length % 2 === 0 && s.replace(/\s/g, "").length >= 2) {
            const hex = s.replace(/\s/g, "");
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
            const d = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            const readable = printableRatio(d) > 0.8;
            add("Hexadecimális", readable ? "high" : "med", bytes.length + " bájt.", readable ? d : "(" + bytes.length + " bájtra fejthető vissza, valószínűleg bináris adat vagy titkosított szöveg)");
            if (!readable && bytes.length % 16 === 0 && bytes.length >= 16 && shannon(d) > 4.5)
                add("Talán AES vagy más blokktitkosítás", "low", bytes.length + " bájt: a 16 bájtos AES-blokk többszöröse, és nagyon véletlenszerű. " + NOKEY);
        }
        if (/=[0-9A-F]{2}/.test(s) && /^[\x20-\x7E\r\n]*$/.test(s)) {
            const qp = s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (m, hx) => String.fromCharCode(parseInt(hx, 16)));
            if (qp !== s) add("Quoted-Printable", "med", "E-mailekben használt kódolás =XX jelekkel. Kódolás, nem titkosítás.", qp);
        }
        if (/^[01\s]+$/.test(s) && s.replace(/\s/g, "").length >= 8) {
            const bits = s.replace(/\s/g, "");
            let d = "";
            if (bits.length % 8 === 0) for (let i = 0; i < bits.length; i += 8) d += String.fromCharCode(parseInt(bits.substr(i, 8), 2));
            add("Bináris (kettes számrendszer)", "high", "Csak 0 és 1 van benne.", d || "(a hossza nem osztható 8-cal)");
        }
        if (/^[.\-/\s]+$/.test(s) && /[.-]/.test(s)) {
            const d = s.split(/\s*\/\s*/).map(w => w.trim().split(/\s+/).map(c => MORSE[c] || "?").join("")).join(" ");
            add("Morze-kód", "high", "Pontok, vonások és perjelek.", d);
        }
        if (/^[A-Z2-7]+=*$/.test(s) && s.length % 8 === 0) add("Base32", "med", "A–Z betűk és 2–7 számok = kitöltéssel (RFC 4648).", base32decode(s));
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length % 4 === 0 && s.length >= 4) {
            const d = b64decode(s);
            const readable = d && printableRatio(d) > 0.85;
            add("Base64", readable ? "high" : "med", "Szabványos Base64 ábécé.", readable ? d : "(nem szövegre, hanem bináris adatra fejthető vissza)");
            if (!readable && d && d.length % 16 === 0 && d.length >= 16 && shannon(d) > 4.5)
                add("Talán AES vagy más blokktitkosítás", "low", d.length + " visszafejtett bájt: a 16 bájtos AES-blokk többszöröse, és nagyon véletlenszerű. " + NOKEY);
        } else if (/^[A-Za-z0-9_-]+$/.test(s) && /[-_]/.test(s)) {
            const d = b64decode(s);
            if (d && printableRatio(d) > 0.85) add("Base64URL", "med", "URL-barát Base64 (- és _ jelekkel).", d);
        }
        if (/[a-z]/i.test(s) && printableRatio(s) > 0.95 && s.length < 400) {
            add("ROT13 / Caesar (tipp)", "low", "Szövegnek tűnik. Így néz ki 13 betűvel eltolva.", rot13(s));
            add("Atbash (tipp)", "low", "Szövegnek tűnik. Így néz ki tükrözött ábécével (A↔Z).", atbash(s));
        }
        if (/[!-~]/.test(s) && printableRatio(s) > 0.95 && s.length < 400)
            add("ROT47 (tipp)", "low", "Minden látható ASCII-karaktert 47-tel tol el. Próbáld ezt, ha a ROT13 nem jött be.", rot47(s));
        const lettersOnly = s.replace(/[^A-Za-z]/g, "");
        if (lettersOnly.length >= 40 && lettersOnly.length / s.length > 0.85) {
            const ic = indexOfCoincidence(s);
            if (ic !== null && ic < 0.052)
                add("Talán többábécés titkosítás (pl. Vigenère)", "low", "Az egyezési index ≈ " + ic.toFixed(3) + ", ez közelebb van a véletlenhez, mint a normál szöveghez (~0,067). Kulcsszó kellene a visszafejtéshez.");
        }
        if (!out.length || out.every(o => o.conf === "low")) {
            const e = shannon(s);
            add("Nagy entrópia, talán titkosított", "low", "Shannon-entrópia ≈ " + e.toFixed(2) + " bit/karakter" + (e > 4.2 ? ". Véletlenszerűnek tűnik, lehet titkosított szöveg vagy kulcs." : "."));
        }
        return out;
    }

    Tools.add({
        id: "decoder-workspace",
        title: "Kódolás-felismerő",
        html: `
            <div class="left-pane">
                <div class="toolbar"><span>Kódolás-felismerő</span></div>
                <p class="hint">Felismeri a Base64-et, a hexát, a JWT-t, a Morze-kódot és más visszafejthető kódolásokat, és ki is bontja őket. A valódi titkosítást (PEM-kulcs, PGP, SSH, AES) is felismeri, de nem töri fel, mert ahhoz titkos kulcs kell.</p>
                <label class="lbl" for="de-input">Kódolt szöveg</label>
                <textarea id="de-input" class="field grow" spellcheck="false" placeholder="Illessz be valamit, ami kódoltnak vagy titkosítottnak tűnik..."></textarea>
                <div class="actions">
                    <button class="btn primary" type="button" data-act="analyse">Elemzés</button>
                </div>
                <p class="mini-label samples-label">Példák</p>
                <div class="samples">${samples([
                    ["Base64", "SGVsbG8sIHdvcmxkIQ=="],
                    ["Hexa", "48656c6c6f21"],
                    ["JWT", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"],
                    ["ROT13", "Uryyb, jbeyq!"],
                    ["ROT47", "w6==@[ H@C=5P"],
                    ["Atbash", "Svool, dliow!"],
                    ["Morze", ".... . .-.. .-.. --- / ...- .. .-.. .- --."],
                    ["PEM tanúsítvány", "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END CERTIFICATE-----"],
                    ["SSH kulcs", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ8FoY3xX2ZQK7L6vQwq9v5t5m7r0m6iC2Yq5s2H0F1a user@host"],
                    ["Bitcoin-cím", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
                    ["UUID", "550e8400-e29b-41d4-a716-446655440000"]
                ], "sample")}</div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span>Mi lehet ez?</span></div>
                <div class="side-scroll de-out"><p class="empty">Illessz be valamit, és nyomd meg az Elemzés gombot.</p></div>
            </div>`,
        init(ws) {
            const input = ws.querySelector("#de-input"), out = ws.querySelector(".de-out");
            const run = () => renderCands(out, analyse(input.value), "Illessz be valamit, és nyomd meg az Elemzés gombot.");
            ws.querySelector('[data-act="analyse"]').addEventListener("click", run);
            ws.querySelectorAll("[data-sample]").forEach(b => b.addEventListener("click", () => { input.value = b.dataset.sample; run(); }));
            input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); });
            ws._state = {
                get: () => ({ input: input.value }),
                set(d) { if (d && typeof d.input === "string") { input.value = d.input; run(); } }
            };
        }
    });
})();
