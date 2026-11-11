/*
 * Gyakorló terminál: Linux (bash) és Windows (cmd).
 * Ez egy szimuláció. Van benne saját fájlrendszer és sok ismert parancs,
 * de nem fut valódi operációs rendszer, és a gépedhez nem fér hozzá.
 */
(function () {
    "use strict";

    const ESC = "\x1b[";
    const C = {
        reset: ESC + "0m", red: ESC + "31m", green: ESC + "1;32m",
        blue: ESC + "1;34m", dim: ESC + "90m"
    };
    const HOME = ["home", "diak"];

    // ---------- Fájlrendszer ----------
    const F = (d, m) => ({ t: "f", d, m: m || "rw-r--r--", mt: Date.now() });
    const D = (c, m) => ({ t: "d", c: c || {}, m: m || "rwxr-xr-x", mt: Date.now() });

    const CSV = "nev,kor,varos\nAnna,16,Nagykáta\nPéter,17,Tápió\nDóra,16,Nagykáta\nBence,15,Szolnok\n";
    const JEGYZET = "Ez egy jegyzet.\nMásodik sor.\nHarmadik sor a gyakorláshoz.\n";
    const LISTA = "tej\nkenyér\nalma\nsajt\nalma\nvaj\n";

    function linuxFs() {
        return D({
            home: D({
                diak: D({
                    dokumentumok: D({ "jegyzet.txt": F(JEGYZET), "bevasarlolista.txt": F(LISTA) }),
                    letoltesek: D({ "kep.png": F("(kép)") }),
                    kepek: D(),
                    "hello.txt": F("Hello világ!\n"),
                    "adatok.csv": F(CSV),
                    ".bashrc": F("# beállítások\n")
                })
            }),
            etc: D({ hostname: F("gyakorlo\n"), "os-release": F('NAME="Ubuntu"\nVERSION="24.04 LTS"\n') }),
            tmp: D(),
            var: D({ log: D({ "rendszer.log": F("rendszer elindult\n") }) }),
            usr: D({ bin: D() })
        });
    }

    function winFs() {
        return D({
            Users: D({
                Diak: D({
                    Documents: D({ "jegyzet.txt": F(JEGYZET), "bevasarlolista.txt": F(LISTA) }),
                    Downloads: D({ "kep.png": F("(kép)") }),
                    Pictures: D(),
                    Desktop: D({ "hello.txt": F("Hello világ!\n") }),
                    "adatok.csv": F(CSV)
                })
            }),
            Windows: D({ System32: D(), "notepad.exe": F("MZ", "rwxr-xr-x") }),
            "Program Files": D()
        });
    }

    function newSession(os) {
        const win = os === "win";
        return {
            os,
            root: win ? winFs() : linuxFs(),
            cwd: win ? ["Users", "Diak"] : HOME.slice(),
            oldcwd: null,
            history: [], hi: -1, buf: "", pos: 0, status: 0,
            env: win
                ? { USERNAME: "Diak", COMPUTERNAME: "GYAKORLO", USERPROFILE: "C:\\Users\\Diak", OS: "Windows_NT" }
                : { USER: "diak", HOME: "/home/diak", HOSTNAME: "gyakorlo", SHELL: "/bin/bash" }
        };
    }

    // ---------- Útvonalak ----------
    const isWin = sh => sh.os === "win";

    function childKey(sh, dir, name) {
        if (!dir || dir.t !== "d") return undefined;
        if (!isWin(sh)) return Object.prototype.hasOwnProperty.call(dir.c, name) ? name : undefined;
        const l = name.toLowerCase();
        return Object.keys(dir.c).find(k => k.toLowerCase() === l);
    }

    function walk(sh, parts) {
        let n = sh.root;
        const real = [];
        for (const p of parts) {
            const k = childKey(sh, n, p);
            if (k === undefined) return null;
            n = n.c[k];
            real.push(k);
        }
        return { node: n, real };
    }

    function absParts(sh, p) {
        let s = p, base;
        if (isWin(sh)) {
            const m = s.match(/^([a-zA-Z]):/);
            if (m) {
                if (m[1].toUpperCase() !== "C") return null;
                s = s.slice(2);
            }
            base = /^[\\/]/.test(s) ? [] : sh.cwd.slice();
        } else if (s === "~" || s.startsWith("~/")) {
            s = s.slice(1);
            base = HOME.slice();
        } else {
            base = s.startsWith("/") ? [] : sh.cwd.slice();
        }
        for (const seg of s.split(isWin(sh) ? /[\\/]+/ : /\/+/)) {
            if (seg === "" || seg === ".") continue;
            if (seg === "..") base.pop(); else base.push(seg);
        }
        return base;
    }

    function lookup(sh, p) {
        const parts = absParts(sh, p);
        if (!parts) return { parts: [], node: null, bad: true };
        const w = walk(sh, parts);
        return { parts, node: w ? w.node : null, real: w ? w.real : null };
    }

    function getDir(sh, parts) {
        const w = walk(sh, parts);
        return w && w.node.t === "d" ? w.node : null;
    }

    // Létrehozáshoz: melyik mappába, milyen néven kerülne az új elem
    function target(sh, p) {
        const r = lookup(sh, p);
        if (r.bad || !r.parts.length) return { parent: null, node: r.node, parts: r.parts, name: "" };
        return {
            parent: getDir(sh, r.parts.slice(0, -1)),
            name: r.real ? r.real[r.real.length - 1] : r.parts[r.parts.length - 1],
            node: r.node,
            parts: r.parts
        };
    }

    function pathStr(sh, parts) {
        return isWin(sh) ? "C:\\" + parts.join("\\") : "/" + parts.join("/");
    }

    function fixCwd(sh) {
        while (sh.cwd.length && !walk(sh, sh.cwd)) sh.cwd.pop();
    }

    function prompt(sh) {
        if (isWin(sh)) return pathStr(sh, sh.cwd) + ">";
        const inHome = HOME.every((h, i) => sh.cwd[i] === h);
        const shown = inHome ? "~" + (sh.cwd.length > 2 ? "/" + sh.cwd.slice(2).join("/") : "") : pathStr(sh, sh.cwd);
        return C.green + "diak@gyakorlo" + C.reset + ":" + C.blue + shown + C.reset + "$ ";
    }

    function globToRegex(pat, ci) {
        const s = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
        return new RegExp("^" + s + "$", ci ? "i" : "");
    }

    function expandGlob(sh, word) {
        if (!/[*?]/.test(word)) return [word];
        const m = word.match(isWin(sh) ? /^(.*[\\/])?([^\\/]*)$/ : /^(.*\/)?([^/]*)$/);
        const dirPart = m[1] || "", pat = m[2];
        const dir = lookup(sh, dirPart || ".");
        if (!dir.node || dir.node.t !== "d") return [word];
        const re = globToRegex(pat, isWin(sh));
        const names = Object.keys(dir.node.c)
            .filter(n => re.test(n) && (isWin(sh) || n[0] !== "." || pat[0] === "."))
            .sort();
        return names.length ? names.map(n => dirPart + n) : [word];
    }

    // ---------- Értelmezés ----------
    function envGet(sh, name) {
        if (isWin(sh)) {
            if (name.toUpperCase() === "CD") return pathStr(sh, sh.cwd);
            const k = Object.keys(sh.env).find(x => x.toLowerCase() === name.toLowerCase());
            return k === undefined ? null : sh.env[k];
        }
        if (name === "PWD") return pathStr(sh, sh.cwd);
        if (name === "?") return String(sh.status);
        return sh.env[name] !== undefined ? sh.env[name] : "";
    }

    function subst(sh, line, i) {
        if (isWin(sh)) {
            if (line[i] !== "%") return null;
            const end = line.indexOf("%", i + 1);
            if (end < 0) return null;
            const v = envGet(sh, line.slice(i + 1, end));
            return v === null ? null : { v, end };
        }
        if (line[i] !== "$") return null;
        let m;
        if ((m = /^\$\{(\w+)\}/.exec(line.slice(i)))) return { v: envGet(sh, m[1]), end: i + m[0].length - 1 };
        if ((m = /^\$(\w+|\?)/.exec(line.slice(i)))) return { v: envGet(sh, m[1]), end: i + m[0].length - 1 };
        return null;
    }

    function tokenize(sh, line) {
        const win = isWin(sh), toks = [];
        let word = null, q = null;
        const add = (s, quoted) => {
            if (!word) word = { w: "", quoted: false };
            word.w += s;
            if (quoted) word.quoted = true;
        };
        const flush = () => { if (word) { toks.push(word); word = null; } };

        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) {
                if (c === q) { q = null; continue; }
                if (q === '"') {
                    const r = subst(sh, line, i);
                    if (r) { add(r.v, true); i = r.end; continue; }
                }
                add(c, true);
                continue;
            }
            if (c === '"' || (c === "'" && !win)) { q = c; add("", true); continue; }
            if (c === " " || c === "\t") { flush(); continue; }
            if (c === "|") { flush(); toks.push({ op: "|" }); continue; }
            if (c === ">") {
                flush();
                if (line[i + 1] === ">") { toks.push({ op: ">>" }); i++; } else toks.push({ op: ">" });
                continue;
            }
            if (c === "&") {
                flush();
                if (line[i + 1] === "&") { toks.push({ op: "&&" }); i++; } else toks.push({ op: ";" });
                continue;
            }
            if (c === ";" && !win) { flush(); toks.push({ op: ";" }); continue; }
            if (c === "#" && !win && !word) break;
            if (c === "~" && !win && !word && (line[i + 1] === undefined || line[i + 1] === "/" || line[i + 1] === " ")) {
                add("/" + HOME.join("/"), false);
                continue;
            }
            const r = subst(sh, line, i);
            if (r) { add(r.v, false); i = r.end; continue; }
            add(c, false);
        }
        flush();
        return toks;
    }

    // ---------- Segédek a parancsokhoz ----------
    const ok = (out) => ({ out: out || "", err: "", code: 0 });
    const fail = (err) => ({ out: "", err: err.endsWith("\n") ? err : err + "\n", code: 1 });

    function opts(args, win) {
        const flags = {}, ops = [];
        let end = false;
        for (const a of args) {
            if (!end && a === "--") { end = true; continue; }
            if (!end && !win && /^-[A-Za-z]+$/.test(a)) { for (const ch of a.slice(1)) flags[ch] = true; continue; }
            if (!end && win && /^\/[A-Za-z?]$/.test(a)) { flags[a[1].toLowerCase()] = true; continue; }
            ops.push(a);
        }
        return { flags, ops };
    }

    const lines = text => {
        const l = text.split("\n");
        if (l.length && l[l.length - 1] === "") l.pop();
        return l;
    };
    const joinLines = arr => (arr.length ? arr.join("\n") + "\n" : "");
    const pad2 = n => String(n).padStart(2, "0");
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fmtLinuxDate = ts => { const d = new Date(ts); return MONTHS[d.getMonth()] + " " + String(d.getDate()).padStart(2, " ") + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
    const fmtWinDate = ts => {
        const d = new Date(ts), h = d.getHours();
        return pad2(d.getMonth() + 1) + "/" + pad2(d.getDate()) + "/" + d.getFullYear() + "  " + pad2(h % 12 || 12) + ":" + pad2(d.getMinutes()) + " " + (h < 12 ? "AM" : "PM");
    };
    const sizeOf = n => (n.t === "d" ? 4096 : new TextEncoder().encode(n.d).length);

    function sortedNames(sh, dir) {
        const names = Object.keys(dir.c);
        if (isWin(sh)) {
            return names.sort((a, b) => (dir.c[a].t === dir.c[b].t ? a.localeCompare(b, "en", { sensitivity: "base" }) : dir.c[a].t === "d" ? -1 : 1));
        }
        return names.sort((a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, ""), "en", { sensitivity: "base" }));
    }

    function removeNode(sh, parts) {
        const parent = getDir(sh, parts.slice(0, -1));
        const w = walk(sh, parts);
        if (parent && w) delete parent.c[w.real[w.real.length - 1]];
        fixCwd(sh);
    }

    function mkdirs(sh, parts) {
        let n = sh.root;
        for (const p of parts) {
            let k = childKey(sh, n, p);
            if (k === undefined) { n.c[p] = D(); k = p; }
            n = n.c[k];
            if (n.t !== "d") return false;
        }
        return true;
    }

    // Egy elem bemásolása/áthelyezése. Visszaad egy hibakódot, vagy null-t.
    function place(sh, srcNode, destPath, srcName, moveFrom) {
        const t = target(sh, destPath);
        let dir, name;
        if (t.node && t.node.t === "d") { dir = t.node; name = srcName; }
        else if (t.parent) { dir = t.parent; name = t.name; }
        else return "nodest";
        const existing = childKey(sh, dir, name);
        if (existing !== undefined && dir.c[existing] === srcNode) return "same";
        if (existing !== undefined) name = existing;
        dir.c[name] = moveFrom ? srcNode : structuredClone(srcNode);
        return null;
    }

    function commonPrefix(list) {
        if (!list.length) return "";
        let p = list[0];
        for (const s of list) while (!s.startsWith(p)) p = p.slice(0, -1);
        return p;
    }

    function makeRegex(pat, ci) {
        try { return new RegExp(pat, ci ? "i" : ""); }
        catch (e) { return new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ci ? "i" : ""); }
    }

    function treeLines(node, prefix, out, count) {
        const names = Object.keys(node.c).filter(n => n[0] !== ".").sort();
        names.forEach((n, i) => {
            const last = i === names.length - 1;
            const child = node.c[n];
            out.push(prefix + (last ? "└── " : "├── ") + n);
            if (child.t === "d") { count.d++; treeLines(child, prefix + (last ? "    " : "│   "), out, count); } else count.f++;
        });
    }

    function winTree(node, prefix, files, out) {
        const names = Object.keys(node.c);
        const dirs = names.filter(n => node.c[n].t === "d").sort();
        const fl = files ? names.filter(n => node.c[n].t === "f").sort() : [];
        fl.forEach(f => out.push(prefix + (dirs.length ? "|   " : "    ") + f));
        if (fl.length) out.push(prefix + (dirs.length ? "|" : ""));
        dirs.forEach((d, i) => {
            const last = i === dirs.length - 1;
            out.push(prefix + (last ? "\\---" : "+---") + d);
            winTree(node.c[d], prefix + (last ? "    " : "|   "), files, out);
        });
    }

    function readTexts(sh, names, cmd, res, win) {
        const out = [];
        for (const n of names) {
            const r = lookup(sh, n);
            if (!r.node) { res.err += win ? "The system cannot find the file specified.\n" : cmd + ": " + n + ": No such file or directory\n"; res.code = 1; continue; }
            if (r.node.t === "d") { res.err += win ? "Access is denied.\n" : cmd + ": " + n + ": Is a directory\n"; res.code = 1; continue; }
            out.push({ name: n, text: r.node.d });
        }
        return out;
    }

    // ---------- Linux parancsok ----------
    const MAN = {
        ls: "ls [-l] [-a] [mappa]  A mappa tartalmát írja ki. A -l részletes listát ad, az -a a rejtett fájlokat is mutatja.",
        cd: "cd [mappa]  Belép egy mappába. A 'cd ..' egy szinttel feljebb lép, a 'cd ~' hazavisz.",
        pwd: "pwd  Kiírja, melyik mappában vagy éppen.",
        cat: "cat fájl  Kiírja a fájl tartalmát.",
        echo: "echo szöveg  Kiírja a szöveget. Az 'echo szia > a.txt' fájlba írja.",
        mkdir: "mkdir [-p] név  Új mappát csinál. A -p a hiányzó közbenső mappákat is létrehozza.",
        touch: "touch fájl  Üres fájlt csinál, vagy frissíti a meglévő idejét.",
        rm: "rm [-r] név  Töröl. Mappához kell a -r.",
        rmdir: "rmdir mappa  Üres mappát töröl.",
        cp: "cp [-r] forrás cél  Másol. Mappához kell a -r.",
        mv: "mv forrás cél  Átnevez vagy áthelyez.",
        head: "head [-n szám] fájl  A fájl első sorait írja ki (alapból 10-et).",
        tail: "tail [-n szám] fájl  A fájl utolsó sorait írja ki (alapból 10-et).",
        wc: "wc [-l] [-w] [-c] fájl  Sorokat, szavakat és bájtokat számol.",
        grep: "grep [-i] [-n] [-v] [-c] minta fájl  A mintát tartalmazó sorokat keresi meg.",
        sort: "sort [-r] [-n] fájl  Sorba rendezi a sorokat.",
        uniq: "uniq [-c] fájl  Az egymás melletti azonos sorokból egyet hagy meg.",
        find: "find [hely] -name minta  Fájlokat keres név szerint.",
        tree: "tree  A mappák fa szerkezetét rajzolja ki.",
        chmod: "chmod 755 fájl  Jogosultságot állít. Például: chmod +x fájl.",
        history: "history  A korábbi parancsok listája.",
        clear: "clear  Törli a képernyőt."
    };

    const LIN = {
        help: () => ok(
            "Ezeket a parancsokat ismeri a gyakorló terminál:\n" +
            "  ls cd pwd cat echo mkdir touch rm rmdir cp mv\n" +
            "  head tail wc grep sort uniq find tree chmod\n" +
            "  whoami hostname uname date id history man clear\n" +
            "Használhatod a | (cső), a > és >> (fájlba írás) jeleket, és a * karaktert is.\n" +
            "A man parancs röviden elmagyarázza a többit, például: man ls\n"),

        man: (sh, a) => {
            if (!a.length) return fail("What manual page do you want?");
            return MAN[a[0]] ? ok(MAN[a[0]] + "\n") : fail("No manual entry for " + a[0]);
        },

        pwd: sh => ok(pathStr(sh, sh.cwd) + "\n"),
        whoami: () => ok("diak\n"),
        hostname: () => ok("gyakorlo\n"),
        id: () => ok("uid=1000(diak) gid=1000(diak) groups=1000(diak)\n"),
        uname: (sh, a) => ok(a.includes("-a") ? "Linux gyakorlo 6.8.0-gyakorlo #1 SMP x86_64 GNU/Linux\n" : "Linux\n"),
        date: () => {
            const d = new Date();
            const wk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
            return ok(wk + " " + MONTHS[d.getMonth()] + " " + d.getDate() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) + " CEST " + d.getFullYear() + "\n");
        },
        clear: () => ({ out: "", err: "", code: 0, clear: true }),
        exit: () => ok("Ez a gyakorló terminál nem zárható be. Válts másik fülre, ha végeztél.\n"),
        sudo: () => fail("diak is not in the sudoers file.  This incident will be reported."),
        history: sh => ok(sh.history.map((h, i) => String(i + 1).padStart(5) + "  " + h).join("\n") + "\n"),

        echo: (sh, a) => {
            const noNl = a[0] === "-n";
            return ok((noNl ? a.slice(1) : a).join(" ") + (noNl ? "" : "\n"));
        },

        ls: (sh, a, inp, tty) => {
            const { flags, ops } = opts(a, false);
            const targets = ops.length ? ops : ["."];
            const res = ok();
            const name = (n, node) => (tty ? (node.t === "d" ? C.blue + n + C.reset : node.m[2] === "x" ? C.green + n + C.reset : n) : n);
            const row = (n, node) => (flags.l
                ? (node.t === "d" ? "d" : "-") + node.m + " 1 diak diak " + String(sizeOf(node)).padStart(5) + " " + fmtLinuxDate(node.mt) + " " + name(n, node)
                : name(n, node));
            targets.forEach((t, idx) => {
                const r = lookup(sh, t);
                if (!r.node) { res.err += "ls: cannot access '" + t + "': No such file or directory\n"; res.code = 2; return; }
                if (targets.length > 1) res.out += (idx ? "\n" : "") + t + ":\n";
                if (r.node.t === "f") { res.out += row(t, r.node) + "\n"; return; }
                let names = sortedNames(sh, r.node);
                if (!flags.a) names = names.filter(n => n[0] !== ".");
                const items = names.map(n => row(n, r.node.c[n]));
                if (flags.l) res.out += "total " + names.length * 4 + "\n" + joinLines(items);
                else if (items.length) res.out += items.join("  ") + "\n";
            });
            return res;
        },

        cd: (sh, a) => {
            const arg = a[0];
            let parts;
            if (arg === undefined || arg === "~") parts = HOME.slice();
            else if (arg === "-") { if (!sh.oldcwd) return fail("bash: cd: OLDPWD not set"); parts = sh.oldcwd; }
            else {
                const r = lookup(sh, arg);
                if (!r.node) return fail("bash: cd: " + arg + ": No such file or directory");
                if (r.node.t !== "d") return fail("bash: cd: " + arg + ": Not a directory");
                parts = r.real;
            }
            sh.oldcwd = sh.cwd;
            sh.cwd = parts.slice();
            return ok();
        },

        cat: (sh, a, inp) => {
            const { ops } = opts(a, false);
            if (!ops.length) return ok(inp || "");
            const res = ok();
            readTexts(sh, ops, "cat", res, false).forEach(f => { res.out += f.text; });
            return res;
        },

        mkdir: (sh, a) => {
            const { flags, ops } = opts(a, false);
            if (!ops.length) return fail("mkdir: missing operand");
            const res = ok();
            ops.forEach(p => {
                const t = target(sh, p);
                if (t.node) { if (!flags.p) { res.err += "mkdir: cannot create directory '" + p + "': File exists\n"; res.code = 1; } return; }
                if (flags.p) { mkdirs(sh, t.parts); return; }
                if (!t.parent) { res.err += "mkdir: cannot create directory '" + p + "': No such file or directory\n"; res.code = 1; return; }
                t.parent.c[t.name] = D();
            });
            return res;
        },

        touch: (sh, a) => {
            if (!a.length) return fail("touch: missing file operand");
            const res = ok();
            a.forEach(p => {
                const t = target(sh, p);
                if (t.node) { t.node.mt = Date.now(); return; }
                if (!t.parent) { res.err += "touch: cannot touch '" + p + "': No such file or directory\n"; res.code = 1; return; }
                t.parent.c[t.name] = F("");
            });
            return res;
        },

        rm: (sh, a) => {
            const { flags, ops } = opts(a, false);
            if (!ops.length) return fail("rm: missing operand");
            const res = ok();
            ops.forEach(p => {
                const r = lookup(sh, p);
                if (!r.node) { if (!flags.f) { res.err += "rm: cannot remove '" + p + "': No such file or directory\n"; res.code = 1; } return; }
                if (!r.parts.length) { res.err += "rm: it is dangerous to operate recursively on '/'\n"; res.code = 1; return; }
                if (r.node.t === "d" && !flags.r && !flags.R) { res.err += "rm: cannot remove '" + p + "': Is a directory\n"; res.code = 1; return; }
                removeNode(sh, r.real);
            });
            return res;
        },

        rmdir: (sh, a) => {
            if (!a.length) return fail("rmdir: missing operand");
            const res = ok();
            a.forEach(p => {
                const r = lookup(sh, p);
                if (!r.node) { res.err += "rmdir: failed to remove '" + p + "': No such file or directory\n"; res.code = 1; }
                else if (r.node.t !== "d") { res.err += "rmdir: failed to remove '" + p + "': Not a directory\n"; res.code = 1; }
                else if (Object.keys(r.node.c).length) { res.err += "rmdir: failed to remove '" + p + "': Directory not empty\n"; res.code = 1; }
                else removeNode(sh, r.real);
            });
            return res;
        },

        cp: (sh, a) => {
            const { flags, ops } = opts(a, false);
            if (ops.length < 1) return fail("cp: missing file operand");
            if (ops.length < 2) return fail("cp: missing destination file operand after '" + ops[0] + "'");
            const dest = ops[ops.length - 1], res = ok();
            const srcs = ops.slice(0, -1);
            const dt = lookup(sh, dest);
            if (srcs.length > 1 && !(dt.node && dt.node.t === "d")) return fail("cp: target '" + dest + "' is not a directory");
            srcs.forEach(s => {
                const r = lookup(sh, s);
                if (!r.node) { res.err += "cp: cannot stat '" + s + "': No such file or directory\n"; res.code = 1; return; }
                if (r.node.t === "d" && !flags.r && !flags.R) { res.err += "cp: -r not specified; omitting directory '" + s + "'\n"; res.code = 1; return; }
                const e = place(sh, r.node, dest, r.real[r.real.length - 1] || s, false);
                if (e === "nodest") { res.err += "cp: cannot create regular file '" + dest + "': No such file or directory\n"; res.code = 1; }
                if (e === "same") { res.err += "cp: '" + s + "' and '" + dest + "' are the same file\n"; res.code = 1; }
            });
            return res;
        },

        mv: (sh, a) => {
            const { ops } = opts(a, false);
            if (ops.length < 1) return fail("mv: missing file operand");
            if (ops.length < 2) return fail("mv: missing destination file operand after '" + ops[0] + "'");
            const dest = ops[ops.length - 1], res = ok();
            const srcs = ops.slice(0, -1);
            const dt = lookup(sh, dest);
            if (srcs.length > 1 && !(dt.node && dt.node.t === "d")) return fail("mv: target '" + dest + "' is not a directory");
            srcs.forEach(s => {
                const r = lookup(sh, s);
                if (!r.node) { res.err += "mv: cannot stat '" + s + "': No such file or directory\n"; res.code = 1; return; }
                const e = place(sh, r.node, dest, r.real[r.real.length - 1], true);
                if (e === "nodest") { res.err += "mv: cannot move '" + s + "' to '" + dest + "': No such file or directory\n"; res.code = 1; return; }
                if (e === "same") { res.err += "mv: '" + s + "' and '" + dest + "' are the same file\n"; res.code = 1; return; }
                // A régi helyről kivesszük (ha közben nem ugyanoda tettük)
                const parent = getDir(sh, r.real.slice(0, -1));
                const k = r.real[r.real.length - 1];
                if (parent && parent.c[k] === r.node) delete parent.c[k];
                fixCwd(sh);
            });
            return res;
        },

        head: (sh, a, inp) => headTail(sh, a, inp, true),
        tail: (sh, a, inp) => headTail(sh, a, inp, false),

        wc: (sh, a, inp) => {
            const { flags, ops } = opts(a, false);
            const res = ok();
            const sources = ops.length ? readTexts(sh, ops, "wc", res, false) : [{ name: "", text: inp || "" }];
            const any = flags.l || flags.w || flags.c;
            sources.forEach(f => {
                const cnt = [];
                if (!any || flags.l) cnt.push((f.text.match(/\n/g) || []).length);
                if (!any || flags.w) cnt.push(f.text.split(/\s+/).filter(Boolean).length);
                if (!any || flags.c) cnt.push(new TextEncoder().encode(f.text).length);
                res.out += cnt.join(" ") + (f.name ? " " + f.name : "") + "\n";
            });
            return res;
        },

        grep: (sh, a, inp) => {
            const { flags, ops } = opts(a, false);
            if (!ops.length) return fail("Usage: grep [OPTION]... PATTERNS [FILE]...");
            const re = makeRegex(ops[0], flags.i);
            const files = ops.slice(1);
            const res = ok();
            const sources = files.length ? readTexts(sh, files, "grep", res, false) : [{ name: "", text: inp || "" }];
            let total = 0;
            sources.forEach(f => {
                const pre = files.length > 1 ? f.name + ":" : "";
                let n = 0;
                lines(f.text).forEach((line, i) => {
                    if (re.test(line) === !flags.v) {
                        n++;
                        if (!flags.c) res.out += pre + (flags.n ? (i + 1) + ":" : "") + line + "\n";
                    }
                });
                if (flags.c) res.out += pre + n + "\n";
                total += n;
            });
            if (!total && !res.err) res.code = 1;
            return res;
        },

        sort: (sh, a, inp) => {
            const { flags, ops } = opts(a, false);
            const res = ok();
            const sources = ops.length ? readTexts(sh, ops, "sort", res, false) : [{ text: inp || "" }];
            let all = [];
            sources.forEach(f => { all = all.concat(lines(f.text)); });
            all.sort(flags.n ? (x, y) => parseFloat(x) - parseFloat(y) : (x, y) => x.localeCompare(y, "en"));
            if (flags.r) all.reverse();
            if (flags.u) all = all.filter((l, i) => i === 0 || l !== all[i - 1]);
            res.out += joinLines(all);
            return res;
        },

        uniq: (sh, a, inp) => {
            const { flags, ops } = opts(a, false);
            const res = ok();
            const sources = ops.length ? readTexts(sh, ops, "uniq", res, false) : [{ text: inp || "" }];
            sources.forEach(f => {
                const out = [];
                lines(f.text).forEach(l => {
                    if (out.length && out[out.length - 1].l === l) out[out.length - 1].n++;
                    else out.push({ l, n: 1 });
                });
                res.out += joinLines(out.map(o => (flags.c ? String(o.n).padStart(7) + " " : "") + o.l));
            });
            return res;
        },

        find: (sh, a) => {
            let start = ".", name = null, type = null;
            for (let i = 0; i < a.length; i++) {
                if (a[i] === "-name") name = a[++i];
                else if (a[i] === "-type") type = a[++i];
                else if (!a[i].startsWith("-")) start = a[i];
            }
            const r = lookup(sh, start);
            if (!r.node) return fail("find: '" + start + "': No such file or directory");
            const re = name ? globToRegex(name, false) : null;
            const out = [];
            const visit = (node, path, nm) => {
                if ((!re || re.test(nm)) && (!type || (type === "d") === (node.t === "d"))) out.push(path);
                if (node.t === "d") sortedNames(sh, node).forEach(k => visit(node.c[k], path.replace(/\/$/, "") + "/" + k, k));
            };
            visit(r.node, start, r.real && r.real.length ? r.real[r.real.length - 1] : start);
            return ok(joinLines(out));
        },

        tree: (sh, a) => {
            const r = lookup(sh, a[0] || ".");
            if (!r.node || r.node.t !== "d") return fail((a[0] || ".") + " [error opening dir]");
            const out = [a[0] || "."], count = { d: 0, f: 0 };
            treeLines(r.node, "", out, count);
            out.push("", count.d + " directories, " + count.f + " files");
            return ok(joinLines(out));
        },

        chmod: (sh, a) => {
            if (a.length < 2) return fail("chmod: missing operand");
            const mode = a[0], res = ok();
            a.slice(1).forEach(p => {
                const r = lookup(sh, p);
                if (!r.node) { res.err += "chmod: cannot access '" + p + "': No such file or directory\n"; res.code = 1; return; }
                let m = r.node.m, x;
                if (/^[0-7]{3}$/.test(mode)) {
                    m = [...mode].map(d => { const n = +d; return (n & 4 ? "r" : "-") + (n & 2 ? "w" : "-") + (n & 1 ? "x" : "-"); }).join("");
                } else if ((x = /^([ugoa]*)([+-])([rwx]+)$/.exec(mode))) {
                    const who = x[1] === "" || x[1].includes("a") ? "ugo" : x[1];
                    const arr = m.split("");
                    for (const w of who) for (const p2 of x[3]) arr["ugo".indexOf(w) * 3 + "rwx".indexOf(p2)] = x[2] === "+" ? p2 : "-";
                    m = arr.join("");
                } else { res.err += "chmod: invalid mode: '" + mode + "'\n"; res.code = 1; return; }
                r.node.m = m;
            });
            return res;
        }
    };

    function headTail(sh, a, inp, isHead) {
        let n = 10;
        const files = [];
        for (let i = 0; i < a.length; i++) {
            let m;
            if (a[i] === "-n") n = parseInt(a[++i], 10) || 0;
            else if ((m = /^-n(\d+)$/.exec(a[i])) || (m = /^-(\d+)$/.exec(a[i]))) n = parseInt(m[1], 10);
            else files.push(a[i]);
        }
        const res = ok();
        const cmd = isHead ? "head" : "tail";
        const sources = files.length ? readTexts(sh, files, cmd, res, false) : [{ name: "", text: inp || "" }];
        sources.forEach((f, i) => {
            if (files.length > 1) res.out += (i ? "\n" : "") + "==> " + f.name + " <==\n";
            const l = lines(f.text);
            res.out += joinLines(isHead ? l.slice(0, n) : l.slice(Math.max(0, l.length - n)));
        });
        return res;
    }

    // ---------- Windows parancsok ----------
    const WIN_HELP =
        "Ezeket a parancsokat ismeri a gyakorló terminál:\n" +
        "  dir cd cls echo type mkdir (md) rmdir (rd) del copy move ren\n" +
        "  findstr sort more tree set ver date time whoami hostname ipconfig\n" +
        "Használhatod a | (cső), a > és >> (fájlba írás) jeleket, és a * karaktert is.\n";

    const WIN = {
        help: () => ok(WIN_HELP),
        cls: () => ({ out: "", err: "", code: 0, clear: true }),
        ver: () => ok("\nMicrosoft Windows [Version 10.0.19045.3693]\n"),
        whoami: () => ok("gyakorlo\\diak\n"),
        hostname: () => ok("GYAKORLO\n"),
        exit: () => ok("Ez a gyakorló terminál nem zárható be. Válts másik fülre, ha végeztél.\n"),
        more: (sh, a, inp) => WIN.type(sh, a, inp),
        date: (sh, a) => {
            const d = new Date();
            return ok(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + pad2(d.getMonth() + 1) + "/" + pad2(d.getDate()) + "/" + d.getFullYear() + "\n");
        },
        time: () => {
            const d = new Date(), h = d.getHours();
            return ok(pad2(h % 12 || 12) + ":" + pad2(d.getMinutes()) + " " + (h < 12 ? "AM" : "PM") + "\n");
        },
        ipconfig: () => ok(
            "\nWindows IP Configuration\n\nEthernet adapter Ethernet:\n\n" +
            "   Connection-specific DNS Suffix  . :\n" +
            "   IPv4 Address. . . . . . . . . . . : 192.168.1.23\n" +
            "   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n" +
            "   Default Gateway . . . . . . . . . : 192.168.1.1\n"),

        echo: (sh, a) => {
            if (!a.length) return ok("ECHO is on.\n");
            return ok(a.join(" ") + "\n");
        },

        set: (sh, a) => {
            if (!a.length) {
                const keys = Object.keys(sh.env).sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
                return ok(joinLines(keys.map(k => k + "=" + sh.env[k])));
            }
            const s = a.join(" "), i = s.indexOf("=");
            if (i < 0) {
                const hit = Object.keys(sh.env).filter(k => k.toLowerCase().startsWith(s.toLowerCase()));
                return hit.length ? ok(joinLines(hit.map(k => k + "=" + sh.env[k]))) : fail("Environment variable " + s + " not defined");
            }
            const k = s.slice(0, i).trim(), v = s.slice(i + 1);
            const existing = Object.keys(sh.env).find(x => x.toLowerCase() === k.toLowerCase());
            if (v === "") delete sh.env[existing || k]; else sh.env[existing || k] = v;
            return ok();
        },

        cd: (sh, a) => {
            const { flags, ops } = opts(a, true);
            const arg = ops.join(" ");
            if (!arg) return ok(pathStr(sh, sh.cwd) + "\n");
            const r = lookup(sh, arg);
            if (r.bad) return fail("The system cannot find the drive specified.");
            if (!r.node || r.node.t !== "d") return fail("The system cannot find the path specified.");
            sh.cwd = r.real.slice();
            return ok();
        },

        dir: (sh, a) => {
            const { flags, ops } = opts(a, true);
            const targets = ops.length ? ops : ["."];
            const res = ok();
            const rows = [];
            let title = null;
            targets.forEach(t => {
                const r = lookup(sh, t);
                if (!r.node) { res.err += "File Not Found\n"; res.code = 1; return; }
                if (r.node.t === "d") {
                    title = r.real;
                    if (r.real.length) { rows.push({ n: ".", node: r.node }); rows.push({ n: "..", node: r.node }); }
                    sortedNames(sh, r.node).forEach(n => rows.push({ n, node: r.node.c[n] }));
                } else {
                    if (!title) title = r.real.slice(0, -1);
                    rows.push({ n: r.real[r.real.length - 1], node: r.node });
                }
            });
            if (!rows.length) return res;
            if (flags.b) { res.out += joinLines(rows.filter(x => x.n !== "." && x.n !== "..").map(x => x.n)); return res; }
            let nf = 0, nd = 0, bytes = 0;
            let out = " Volume in drive C has no label.\n Volume Serial Number is 1A2B-3C4D\n\n Directory of " + pathStr(sh, title) + "\n\n";
            rows.forEach(x => {
                if (x.node.t === "d") { nd++; out += fmtWinDate(x.node.mt) + "    <DIR>          " + x.n + "\n"; }
                else { nf++; const s = sizeOf(x.node); bytes += s; out += fmtWinDate(x.node.mt) + " " + s.toLocaleString("en-US").padStart(17) + " " + x.n + "\n"; }
            });
            out += String(nf).padStart(16) + " File(s) " + bytes.toLocaleString("en-US").padStart(14) + " bytes\n";
            out += String(nd).padStart(16) + " Dir(s)  87,412,203,520 bytes free\n";
            res.out += out;
            return res;
        },

        type: (sh, a, inp) => {
            const { ops } = opts(a, true);
            if (!ops.length) return ok(inp || "");
            const res = ok();
            readTexts(sh, ops, "type", res, true).forEach(f => { res.out += f.text; });
            return res;
        },

        mkdir: (sh, a) => {
            const { ops } = opts(a, true);
            if (!ops.length) return fail("The syntax of the command is incorrect.");
            const res = ok();
            ops.forEach(p => {
                const t = target(sh, p);
                if (t.node) { res.err += "A subdirectory or file " + p + " already exists.\n"; res.code = 1; return; }
                if (!mkdirs(sh, t.parts)) { res.err += "The system cannot find the path specified.\n"; res.code = 1; }
            });
            return res;
        },

        rmdir: (sh, a) => {
            const { flags, ops } = opts(a, true);
            if (!ops.length) return fail("The syntax of the command is incorrect.");
            const res = ok();
            ops.forEach(p => {
                const r = lookup(sh, p);
                if (!r.node) { res.err += "The system cannot find the file specified.\n"; res.code = 1; }
                else if (r.node.t !== "d") { res.err += "The directory name is invalid.\n"; res.code = 1; }
                else if (Object.keys(r.node.c).length && !flags.s) { res.err += "The directory is not empty.\n"; res.code = 1; }
                else removeNode(sh, r.real);
            });
            return res;
        },

        del: (sh, a) => {
            const { ops } = opts(a, true);
            if (!ops.length) return fail("The syntax of the command is incorrect.");
            const res = ok();
            ops.forEach(p => {
                const r = lookup(sh, p);
                if (!r.node) { res.err += "Could Not Find " + pathStr(sh, r.parts) + "\n"; res.code = 1; return; }
                if (r.node.t === "d") { Object.keys(r.node.c).forEach(k => { if (r.node.c[k].t === "f") delete r.node.c[k]; }); return; }
                removeNode(sh, r.real);
            });
            return res;
        },

        copy: (sh, a) => copyMove(sh, a, false),
        move: (sh, a) => copyMove(sh, a, true),

        ren: (sh, a) => {
            const { ops } = opts(a, true);
            if (ops.length !== 2) return fail("The syntax of the command is incorrect.");
            const r = lookup(sh, ops[0]);
            if (!r.node) return fail("The system cannot find the file specified.");
            if (/[\\/]/.test(ops[1])) return fail("The syntax of the command is incorrect.");
            const parent = getDir(sh, r.real.slice(0, -1));
            if (childKey(sh, parent, ops[1]) !== undefined) return fail("A duplicate file name exists, or the file cannot be found.");
            parent.c[ops[1]] = r.node;
            delete parent.c[r.real[r.real.length - 1]];
            fixCwd(sh);
            return ok();
        },

        findstr: (sh, a, inp) => {
            const { flags, ops } = opts(a, true);
            if (!ops.length) return fail("FINDSTR: Bad command line");
            const words = ops[0].split(" ").filter(Boolean);
            const files = ops.slice(1);
            const res = ok();
            const sources = files.length ? readTexts(sh, files, "findstr", res, true) : [{ name: "", text: inp || "" }];
            const match = line => words.some(w => (flags.i ? line.toLowerCase().includes(w.toLowerCase()) : line.includes(w)));
            let total = 0;
            sources.forEach(f => {
                const pre = files.length > 1 ? f.name + ":" : "";
                lines(f.text).forEach((line, i) => {
                    if (match(line) === !flags.v) { total++; res.out += pre + (flags.n ? (i + 1) + ":" : "") + line + "\n"; }
                });
            });
            if (!total && !res.err) res.code = 1;
            return res;
        },

        sort: (sh, a, inp) => {
            const { flags, ops } = opts(a, true);
            const res = ok();
            const sources = ops.length ? readTexts(sh, ops, "sort", res, true) : [{ text: inp || "" }];
            let all = [];
            sources.forEach(f => { all = all.concat(lines(f.text)); });
            all.sort((x, y) => x.localeCompare(y, "en", { sensitivity: "base" }));
            if (flags.r) all.reverse();
            res.out += joinLines(all);
            return res;
        },

        tree: (sh, a) => {
            const { flags, ops } = opts(a, true);
            const r = lookup(sh, ops[0] || ".");
            if (!r.node || r.node.t !== "d") return fail("Invalid path - " + (ops[0] || "."));
            const out = ["Folder PATH listing", "Volume serial number is 1A2B-3C4D", r.real.length ? pathStr(sh, r.real) : "C:."];
            winTree(r.node, "", !!flags.f, out);
            return ok(joinLines(out));
        }
    };
    WIN.md = WIN.mkdir; WIN.rd = WIN.rmdir; WIN.erase = WIN.del; WIN.chdir = WIN.cd; WIN.rename = WIN.ren;

    function copyMove(sh, a, isMove) {
        const { ops } = opts(a, true);
        if (ops.length < 2) return fail("The syntax of the command is incorrect.");
        const dest = ops[ops.length - 1], srcs = ops.slice(0, -1), res = ok();
        let n = 0;
        srcs.forEach(s => {
            const r = lookup(sh, s);
            if (!r.node) { res.err += "The system cannot find the file specified.\n"; res.code = 1; return; }
            if (r.node.t === "d" && !isMove) { res.err += "Access is denied.\n"; res.code = 1; return; }
            const e = place(sh, r.node, dest, r.real[r.real.length - 1], isMove);
            if (e === "nodest") { res.err += "The system cannot find the path specified.\n"; res.code = 1; return; }
            if (e === "same") { res.err += "The file cannot be copied onto itself.\n"; res.code = 1; return; }
            if (isMove) {
                const parent = getDir(sh, r.real.slice(0, -1)), k = r.real[r.real.length - 1];
                if (parent && parent.c[k] === r.node) delete parent.c[k];
                fixCwd(sh);
            }
            n++;
        });
        if (n) res.out += "        " + n + " file(s) " + (isMove ? "moved" : "copied") + ".\n";
        return res;
    }

    // ---------- Végrehajtás ----------
    function commandTable(sh) { return isWin(sh) ? WIN : LIN; }

    function execCmd(sh, words, stdin, tty) {
        if (!words.length) return ok();
        let name = words[0], args = words.slice(1);
        const win = isWin(sh);
        if (win) {
            let m;
            if (/^[a-zA-Z]:$/.test(name)) return name.toUpperCase() === "C:" ? ok() : fail("The system cannot find the drive specified.");
            if ((m = name.match(/^cd(\.\.|\\)$/i))) { name = "cd"; args = [m[1]]; }
            else if ((m = name.match(/^echo\.(.*)$/i))) return ok((m[1] + (args.length ? " " : "") + args.join(" ")).trim() + "\n");
        }
        const fn = commandTable(sh)[win ? name.toLowerCase() : name];
        if (!fn || !Object.prototype.hasOwnProperty.call(commandTable(sh), win ? name.toLowerCase() : name)) {
            return win
                ? fail("'" + name + "' is not recognized as an internal or external command,\noperable program or batch file.")
                : fail("bash: " + name + ": command not found");
        }
        return fn(sh, args, stdin, tty) || ok();
    }

    function writeRedirect(sh, redir, text) {
        const win = isWin(sh);
        const t = target(sh, redir.target);
        if (t.node && t.node.t === "d") return win ? "Access is denied.\n" : "bash: " + redir.target + ": Is a directory\n";
        if (!t.parent) return win ? "The system cannot find the path specified.\n" : "bash: " + redir.target + ": No such file or directory\n";
        if (t.node) {
            t.node.d = redir.mode === ">>" ? t.node.d + text : text;
            t.node.mt = Date.now();
        } else {
            t.parent.c[t.name] = F(text);
        }
        return "";
    }

    function runPipeline(sh, toks) {
        const win = isWin(sh);
        const cmds = [];
        let cur = { words: [], redir: null };
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (t.op === "|") { cmds.push(cur); cur = { words: [], redir: null }; }
            else if (t.op === ">" || t.op === ">>") {
                const nx = toks[++i];
                if (!nx || nx.op) return { out: win ? "The syntax of the command is incorrect.\n" : "bash: syntax error near unexpected token `newline'\n", code: 1 };
                cur.redir = { mode: t.op, target: nx.w };
            } else cur.words.push(t);
        }
        cmds.push(cur);

        let stdin = null, out = "", code = 0;
        for (let k = 0; k < cmds.length; k++) {
            const c = cmds[k];
            const words = [];
            c.words.forEach((t, j) => {
                if (j > 0 && !t.quoted) words.push(...expandGlob(sh, t.w)); else words.push(t.w);
            });
            const last = k === cmds.length - 1;
            const r = execCmd(sh, words, stdin, last && !c.redir);
            if (r.clear) return { out: "", code: 0, clear: true };
            out += r.err;
            code = r.code;
            if (c.redir) { out += writeRedirect(sh, c.redir, r.out); stdin = ""; }
            else if (last) out += r.out;
            else stdin = r.out;
        }
        return { out, code };
    }

    function runLine(sh, line) {
        const toks = tokenize(sh, line);
        const seqs = [];
        let cur = [], before = ";";
        toks.forEach(t => {
            if (t.op === ";" || t.op === "&&") { seqs.push({ toks: cur, before }); cur = []; before = t.op; }
            else cur.push(t);
        });
        seqs.push({ toks: cur, before });

        let out = "", clear = false, code = 0;
        for (const s of seqs) {
            if (!s.toks.length) continue;
            if (s.before === "&&" && code !== 0) continue;
            const r = runPipeline(sh, s.toks);
            if (r.clear) { clear = true; out = ""; } else out += r.out;
            code = r.code;
        }
        sh.status = code;
        return { out, clear };
    }

    // ---------- Tab kiegészítés ----------
    function completions(sh, word, isFirst) {
        const win = isWin(sh);
        if (isFirst && !/[\\/]/.test(word)) {
            const l = word.toLowerCase();
            return Object.keys(commandTable(sh)).filter(n => n.startsWith(l)).sort().map(n => n + " ");
        }
        const m = word.match(win ? /^(.*[\\/])?([^\\/]*)$/ : /^(.*\/)?([^/]*)$/);
        const dirPart = m[1] || "", base = m[2];
        const dir = lookup(sh, dirPart || ".");
        if (!dir.node || dir.node.t !== "d") return [];
        const sep = win ? "\\" : "/";
        return Object.keys(dir.node.c)
            .filter(n => (win ? n.toLowerCase().startsWith(base.toLowerCase()) : n.startsWith(base)) && (base !== "" || win || n[0] !== "."))
            .sort()
            .map(n => dirPart + n + (dir.node.c[n].t === "d" ? sep : " "));
    }

    // ---------- Súgó a jobb oldalon ----------
    const HELP = {
        linux: {
            cmds: [
                ["pwd", "hol vagy most"],
                ["ls", "mappa tartalma"],
                ["ls -l", "részletes lista"],
                ["ls -a", "rejtett fájlokkal együtt"],
                ["cd dokumentumok", "belépés egy mappába"],
                ["cd ..", "egy szinttel feljebb"],
                ["cd ~", "haza a saját mappádba"],
                ["cat hello.txt", "fájl kiírása"],
                ["mkdir proba", "új mappa"],
                ["touch uj.txt", "üres fájl"],
                ["echo szia > a.txt", "szöveg fájlba írása"],
                ["cp hello.txt masolat.txt", "másolás"],
                ["mv masolat.txt nev.txt", "átnevezés"],
                ["rm nev.txt", "fájl törlése"],
                ["rm -r proba", "mappa törlése"],
                ["grep alma dokumentumok/bevasarlolista.txt", "keresés a fájlban"],
                ["sort dokumentumok/bevasarlolista.txt", "sorba rendezés"],
                ["wc -l adatok.csv", "sorok száma"],
                ["head -n 2 adatok.csv", "az első 2 sor"],
                ["tree", "mappák fa szerkezete"],
                ["find . -name \"*.txt\"", "keresés név szerint"],
                ["chmod +x hello.txt", "futtatási jog"],
                ["history", "korábbi parancsok"],
                ["man ls", "rövid leírás egy parancsról"]
            ],
            tasks: [
                "Menj be a dokumentumok mappába, és írd ki a jegyzet.txt tartalmát.",
                "Csinálj egy proba nevű mappát, és tegyél bele egy üres fájlt.",
                "Számold meg, hány sorban van az alma szó a bevasarlolista.txt fájlban (grep és wc -l együtt, a | jellel).",
                "Másold le az adatok.csv fájlt, és nézd meg a másolat első két sorát.",
                "Keresd meg az összes .txt fájlt a saját mappádban.",
                "Töröld ki a proba mappát."
            ]
        },
        win: {
            cmds: [
                ["cd", "hol vagy most"],
                ["dir", "mappa tartalma"],
                ["dir /b", "csak a nevek"],
                ["cd Documents", "belépés egy mappába"],
                ["cd ..", "egy szinttel feljebb"],
                ["cd \\", "a meghajtó gyökerébe"],
                ["type hello.txt", "fájl kiírása (Desktop mappában van)"],
                ["mkdir proba", "új mappa"],
                ["echo szia > a.txt", "szöveg fájlba írása"],
                ["copy a.txt b.txt", "másolás"],
                ["ren b.txt c.txt", "átnevezés"],
                ["move c.txt proba", "áthelyezés"],
                ["del a.txt", "fájl törlése"],
                ["rmdir /s /q proba", "mappa törlése"],
                ["findstr alma Documents\\bevasarlolista.txt", "keresés a fájlban"],
                ["dir | findstr csv", "kimenet szűrése"],
                ["sort Documents\\bevasarlolista.txt", "sorba rendezés"],
                ["tree /f", "mappák és fájlok fa nézete"],
                ["set", "környezeti változók"],
                ["echo %USERNAME%", "változó kiírása"],
                ["ver", "Windows verzió"],
                ["ipconfig", "hálózati adatok"],
                ["cls", "képernyő törlése"]
            ],
            tasks: [
                "Menj be a Documents mappába, és írd ki a jegyzet.txt tartalmát.",
                "Csinálj egy proba nevű mappát, és másold bele az adatok.csv fájlt.",
                "Keresd meg az alma szót a bevasarlolista.txt fájlban.",
                "Írj egy szöveget egy uj.txt fájlba az echo és a > jel segítségével.",
                "Nézd meg a mappák fa szerkezetét a fájlokkal együtt.",
                "Töröld ki a proba mappát."
            ]
        }
    };

    // ---------- Fül ----------
    Tools.add({
        id: "terminal-workspace",
        title: "Terminál",
        libs: [
            "https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js",
            "https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js"
        ],
        css: ["https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css"],
        html: `
            <div class="left-pane">
                <div class="toolbar">
                    <span>Terminál</span>
                    <div class="group">
                        <div class="seg" role="group" aria-label="Rendszer">
                            <button class="btn" data-os="linux" aria-pressed="true">Linux</button>
                            <button class="btn" data-os="win" aria-pressed="false">Windows</button>
                        </div>
                        <button class="btn" data-act="reset" title="Visszaáll a fájlrendszer és a képernyő">Újrakezdés</button>
                    </div>
                </div>
                <div class="term-host"></div>
            </div>
            <div class="resizer"></div>
            <div class="right-pane">
                <div class="toolbar"><span class="help-title">Parancsok</span></div>
                <div class="side-scroll help"></div>
            </div>`,

        init(ws) {
            const host = ws.querySelector(".term-host");
            const helpBox = ws.querySelector(".help");
            const sessions = { linux: newSession("linux"), win: newSession("win") };
            let current = "linux";
            let sh = sessions.linux;

            const term = new Terminal({
                convertEol: true,
                cursorBlink: true,
                fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
                fontSize: 14,
                scrollback: 2000,
                theme: { background: "#1e1e1e", foreground: "#e6e6e6" }
            });
            const fit = new FitAddon.FitAddon();
            term.loadAddon(fit);
            term.open(host);
            const doFit = () => { if (host.offsetWidth > 0 && host.offsetHeight > 0) { try { fit.fit(); } catch (e) { /* még nem látszik */ } } };
            new ResizeObserver(doFit).observe(host);

            const write = s => term.write(s);
            const redraw = () => {
                write("\r" + ESC + "K" + prompt(sh) + sh.buf);
                const back = sh.buf.length - sh.pos;
                if (back > 0) write(ESC + back + "D");
            };
            const setLine = text => { sh.buf = text; sh.pos = text.length; redraw(); term.focus(); };

            function banner() {
                if (isWin(sh)) {
                    write("Microsoft Windows [Version 10.0.19045.3693]\n(c) Microsoft Corporation. All rights reserved.\n");
                } else {
                    write("Ubuntu 24.04 LTS gyakorló terminál\n");
                }
                write(C.dim + "Ez egy gyakorló terminál. A parancsok csak itt, a böngészőben futnak. Írd be: help\n" + C.reset + "\n");
            }

            function showSession() {
                // A törlés is a kiírási sorba kerül (term.reset() azonnal futna, a még várakozó szöveg előtt)
                write("\x1bc");
                banner();
                redraw();
                renderHelp();
                ws.querySelectorAll("[data-os]").forEach(b => b.setAttribute("aria-pressed", b.dataset.os === current ? "true" : "false"));
                term.focus();
            }

            function renderHelp() {
                const h = HELP[current];
                helpBox.replaceChildren();
                helpBox.appendChild(Tools.mk("h4", null, "Parancsok (kattints egyre, és bekerül a sorba)"));
                h.cmds.forEach(([cmd, desc]) => {
                    const row = Tools.mk("div", "cmd-row");
                    const b = Tools.mk("button", "cmd", cmd);
                    b.addEventListener("click", () => setLine(cmd));
                    row.append(b, Tools.mk("span", null, desc));
                    helpBox.appendChild(row);
                });
                helpBox.appendChild(Tools.mk("h4", null, "Feladatok"));
                const ol = Tools.mk("ol");
                h.tasks.forEach(t => ol.appendChild(Tools.mk("li", null, t)));
                helpBox.appendChild(ol);
                helpBox.appendChild(Tools.mk("h4", null, "Hasznos billentyűk"));
                helpBox.appendChild(Tools.mk("p", null, "Tab: kiegészíti a nevet. Fel és le nyíl: korábbi parancsok. Ctrl+C: megszakítja a sort. Ctrl+L: törli a képernyőt."));
            }

            function enter() {
                write("\n");
                const line = sh.buf;
                sh.buf = ""; sh.pos = 0; sh.hi = -1;
                if (line.trim()) {
                    if (sh.history[sh.history.length - 1] !== line) sh.history.push(line);
                    const r = runLine(sh, line);
                    if (r.clear) write(ESC + "2J" + ESC + "3J" + ESC + "H");
                    else if (r.out) write(r.out.endsWith("\n") ? r.out : r.out + "\n");
                }
                write(prompt(sh));
            }

            function history(dir) {
                if (!sh.history.length) return;
                if (dir < 0) sh.hi = sh.hi < 0 ? sh.history.length - 1 : Math.max(0, sh.hi - 1);
                else if (sh.hi >= 0) sh.hi = sh.hi + 1 >= sh.history.length ? -1 : sh.hi + 1;
                sh.buf = sh.hi < 0 ? "" : sh.history[sh.hi];
                sh.pos = sh.buf.length;
                redraw();
            }

            function complete() {
                const before = sh.buf.slice(0, sh.pos);
                const word = before.match(/(\S*)$/)[1];
                const isFirst = before.slice(0, before.length - word.length).trim() === "";
                const cands = completions(sh, word, isFirst);
                if (!cands.length) return;
                const common = commonPrefix(cands);
                if (common.length > word.length) {
                    sh.buf = before.slice(0, before.length - word.length) + common + sh.buf.slice(sh.pos);
                    sh.pos = before.length - word.length + common.length;
                    redraw();
                } else if (cands.length > 1) {
                    write("\n" + cands.map(c => c.trim()).join("  ") + "\n");
                    redraw();
                }
            }

            function insert(ch) {
                if (sh.pos === sh.buf.length) { sh.buf += ch; sh.pos++; write(ch); }
                else { sh.buf = sh.buf.slice(0, sh.pos) + ch + sh.buf.slice(sh.pos); sh.pos++; redraw(); }
            }

            term.onData(d => {
                if (d.startsWith("\x1b")) {
                    switch (d) {
                        case "\x1b[A": history(-1); break;
                        case "\x1b[B": history(1); break;
                        case "\x1b[C": if (sh.pos < sh.buf.length) { sh.pos++; write(d); } break;
                        case "\x1b[D": if (sh.pos > 0) { sh.pos--; write(d); } break;
                        case "\x1b[H": case "\x1bOH": case "\x1b[1~": sh.pos = 0; redraw(); break;
                        case "\x1b[F": case "\x1bOF": case "\x1b[4~": sh.pos = sh.buf.length; redraw(); break;
                        case "\x1b[3~": if (sh.pos < sh.buf.length) { sh.buf = sh.buf.slice(0, sh.pos) + sh.buf.slice(sh.pos + 1); redraw(); } break;
                    }
                    return;
                }
                let prev = "";
                for (const ch of d) {
                    if (ch === "\r" || (ch === "\n" && prev !== "\r")) enter();
                    else if (ch === "\x7f" || ch === "\b") {
                        if (sh.pos > 0) {
                            sh.buf = sh.buf.slice(0, sh.pos - 1) + sh.buf.slice(sh.pos);
                            sh.pos--;
                            if (sh.pos === sh.buf.length) write("\b " + "\b"); else redraw();
                        }
                    }
                    else if (ch === "\x03") { write("^C\n"); sh.buf = ""; sh.pos = 0; sh.hi = -1; write(prompt(sh)); }
                    else if (ch === "\x0c") { write(ESC + "2J" + ESC + "3J" + ESC + "H"); redraw(); }
                    else if (ch === "\x01") { sh.pos = 0; redraw(); }
                    else if (ch === "\x05") { sh.pos = sh.buf.length; redraw(); }
                    else if (ch === "\x15") { sh.buf = sh.buf.slice(sh.pos); sh.pos = 0; redraw(); }
                    else if (ch === "\t") complete();
                    else if (ch >= " ") insert(ch);
                    prev = ch;
                }
            });

            ws.querySelectorAll("[data-os]").forEach(b => b.addEventListener("click", () => {
                current = b.dataset.os;
                sh = sessions[current];
                showSession();
            }));
            ws.querySelector('[data-act="reset"]').addEventListener("click", () => {
                sessions[current] = newSession(current);
                sh = sessions[current];
                showSession();
            });

            ws._term = { fit: doFit, focus: () => term.focus() };

            // Mentés / betöltés: mindkét rendszer fájljai, mappája, előzményei és változói
            const isDir = n => n && typeof n === "object" && n.t === "d" && n.c && typeof n.c === "object";
            const pack = s => ({ os: s.os, root: s.root, cwd: s.cwd, oldcwd: s.oldcwd, history: s.history, env: s.env });
            ws._state = {
                get: () => ({ current, sessions: { linux: pack(sessions.linux), win: pack(sessions.win) } }),
                set(d) {
                    if (!d || !d.sessions) throw new Error("Ez nem terminál-mentés.");
                    ["linux", "win"].forEach(os => {
                        const src = d.sessions[os];
                        if (!src || !isDir(src.root)) return;
                        const s = newSession(os);
                        s.root = src.root;
                        if (Array.isArray(src.cwd)) s.cwd = src.cwd.map(String);
                        if (Array.isArray(src.oldcwd)) s.oldcwd = src.oldcwd.map(String);
                        if (Array.isArray(src.history)) s.history = src.history.map(String);
                        if (src.env && typeof src.env === "object") s.env = Object.assign({}, src.env);
                        let node = s.root;
                        for (const part of s.cwd) { node = node && node.c && node.c[part]; if (!isDir(node)) { s.cwd = newSession(os).cwd; break; } }
                        sessions[os] = s;
                    });
                    if (d.current === "linux" || d.current === "win") current = d.current;
                    sh = sessions[current];
                    showSession();
                }
            };

            showSession();
        },

        onShow(ws) {
            requestAnimationFrame(() => { if (ws._term) { ws._term.fit(); ws._term.focus(); } });
        },
        onResize(ws) { if (ws._term) ws._term.fit(); }
    });
})();
