# Informatika Tanulás

Böngészőben futó programozási gyakorlófelület: HTML, Python, SQL, Markdown, TypeScript, Lua, PHP, Blockly,
játékkészítés, terminál és még sok más. Egyszerű statikus fájlokból áll: nincs építési lépés és nincs szerveroldali kód.

## Fájlok és mappák

- `index.html` – maga az alkalmazás.
- `tools/` – a további fülek (terminál, C / C++ / C#, folyamatábra, titkosítás, képátalakító, felismerők, hálózat,
  kódrészletek).
- `logos/` – a fülek ikonjai (a böngészőfül ikonja a megnyitott fül szerint változik).
- `info_images/` – a HTML fül képválasztójában felkínált képek.
- `assets/fonts/` – a Space Grotesk betűtípus.
- `anyagok/<python|html|sql>/index.html` – a „Tananyagok” menü ezeket az oldalakat nyitja meg. Egyelőre helykitöltők;
  ide kerülhet a valódi tananyag.
- `sajat_fajlok/` – Marcsi saját fájljainak tárhelye. A weboldal nem használja; a részletek a mappa `README.md`
  fájljában vannak.
- `404.html` – ez jelenik meg, ha valaki nem létező címet nyit meg.
- `_headers` – biztonsági és gyorsítótár-fejlécek a Cloudflare számára.

## Közzététel a Cloudflare-en

1. A Cloudflare vezérlőpulton nyisd meg a Workers & Pages részt, hozz létre egy új Pages projektet, és kapcsold össze
   ezzel a GitHub-tárolóval.
2. Framework preset: None. Build command: maradjon üresen. Build output directory: `/` (a tároló gyökere).
3. Indítsd el a telepítést. Ezután minden új feltöltés (commit) után a weboldal magától frissül.

## Jó tudni

- Az oldal a szerkesztőt és a nyelvi könyvtárakat nyilvános CDN-ekről tölti be (cdnjs, jsDelivr, unpkg), ezért
  internetkapcsolat kell hozzá.
- A munkát a böngésző automatikusan menti a saját tárába, és a következő megnyitáskor visszatölti. A „Minden mentése”
  gombbal fájlba is kimenthető.
