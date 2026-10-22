// Czy zmienił się tekst artykułów, na które powołuje się baza.
// Uruchamiane co tydzień przez zaplanowane zadanie; można też ręcznie:
//   node tools/monitor/artykuly.mjs            porównuje z odciskami w odciski-artykulow.json
//   node tools/monitor/artykuly.mjs --zapisz   zapisuje bieżące odciski (po sprawdzeniu tematów)
//
// Pobiera aktualny tekst każdej ustawy z API Sejmu (ELI): tekst ujednolicony („U"), a gdy go
// nie ma — ogłoszony („O"). Z PDF-u (pdftotext) wycina tylko artykuły wymienione w polu
// `artykuly` tematów i porównuje ich odcisk SHA-256 z zapisanym. Zgłasza też nowe akty
// zmieniające ustawę. Model językowy nie jest tu potrzebny: zmieniony artykuł to sygnał,
// że temat trzeba sprawdzić ponownie — dopiero wtedy czyta go człowiek albo model.
//
// Odciski aktualizuje się tylko po ponownym sprawdzeniu tematów (--zapisz), więc zgłoszenie
// wraca co tydzień, dopóki ktoś się nim nie zajmie.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const AKTY = {
  "ustawa o cudzoziemcach": "DU/2013/1650",
  "ustawa o obywatelstwie polskim": "DU/2012/161",
  "ustawa o udzielaniu cudzoziemcom ochrony na terytorium RP": "DU/2003/1176",
  "ustawa z 12 marca 2022 r. o pomocy obywatelom Ukrainy": "DU/2022/583",
  "ustawa z 23 stycznia 2026 r. o wygaszeniu rozwiązań": "DU/2026/203",
  "ustawa z 21 listopada 2025 r. o zmianie ustawy o cudzoziemcach": "DU/2025/1794",
  "ustawa o warunkach dopuszczalności powierzania pracy cudzoziemcom": "DU/2025/621",
};
const API = "https://api.sejm.gov.pl/eli/acts/";
const PLIK = new URL("./odciski-artykulow.json", import.meta.url);
const zapisz = process.argv.includes("--zapisz");

const idx = JSON.parse(fs.readFileSync(new URL("../../index/kb-index.json", import.meta.url), "utf8"));

// akt -> artykuł -> tematy, które się na niego powołują
const potrzebne = {};
for (const w of idx.wpisy) {
  const eli = AKTY[w.ustawa];
  if (!eli) continue;
  for (const a of w.artykuly || []) ((potrzebne[eli] ??= {})[String(a)] ??= []).push(w.id);
}

// Nagłówki stron, numery stron i daty wydruku Kancelarii Sejmu zmieniają się przy każdym
// nowym wydruku, a nie są treścią przepisu.
const SZUM = /^(©Kancelaria Sejmu.*|s\. \d+\/\d+|Dz\. ?U\. .*poz\. \d+|\d{4}-\d{2}-\d{2}|Opracowano na|podstawie:.*)$/;

/** Artykuły z tekstu ustawy. Brzmienie oczekujące „<…>" zastępuje dotychczasowe „[…]". */
function artykuly(tekst) {
  const linie = tekst.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() && !SZUM.test(l.trim()));
  const out = {};
  for (const czesc of linie.join("\n").split(/\n(?=[[<]?Art\. \d+[a-z]*\. )/)) {
    const m = czesc.match(/^([[<]?)Art\. (\d+[a-z]*)\. /);
    if (!m) continue;
    const tresc = czesc.replace(/\s+/g, " ").trim();
    if (m[1] === "<" || !(m[2] in out)) out[m[2]] = tresc;
  }
  return out;
}

// Przez curl, nie fetch: w środowisku zaplanowanego zadania ruch idzie przez proxy, a fetch
// z Node go nie używa.
const curl = (url, ...opcje) =>
  execFileSync("curl", ["-sS", "-f", "--http1.1", "-A", "Mozilla/5.0", "-m", "180", ...opcje, url], {
    maxBuffer: 64 << 20,
  });

const odcisk = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const zapisane = fs.existsSync(PLIK) ? JSON.parse(fs.readFileSync(PLIK, "utf8")).akty : {};
const nowe = {};
const zmienione = [];
const brakujace = [];
const noweZmieniajace = [];
const bledy = [];
let sprawdzone = 0;

for (const [eli, arts] of Object.entries(potrzebne)) {
  const nazwa = Object.keys(AKTY).find((k) => AKTY[k] === eli);
  try {
    const meta = JSON.parse(curl(API + eli).toString("utf8"));
    const teksty = Object.fromEntries((meta.texts || []).map((t) => [t.type, t.fileName]));
    const typ = teksty.U ? "U" : "O";
    const pdf = path.join(os.tmpdir(), eli.replaceAll("/", "_") + ".pdf");
    curl(`${API}${eli}/text/${typ}/${teksty[typ]}`, "-o", pdf);
    const art = artykuly(execFileSync("pdftotext", [pdf, "-"], { maxBuffer: 64 << 20 }).toString("utf8"));

    const zmieniajace = (meta.references?.["Akty zmieniające"] || []).map((x) => x.id).sort();
    nowe[eli] = { nazwa, tekst: `${typ}:${teksty[typ]}`, zmieniajace, artykuly: {} };
    const stare = zapisane[eli];
    if (stare) {
      const dodane = zmieniajace.filter((id) => !stare.zmieniajace.includes(id));
      if (dodane.length) noweZmieniajace.push(`${nazwa}: ${dodane.join(", ")}`);
    }
    for (const [a, tematy] of Object.entries(arts)) {
      sprawdzone++;
      if (!art[a]) {
        brakujace.push(`${nazwa}, art. ${a} — nie ma go w tekście (uchylony?) → ${tematy.join(", ")}`);
        continue;
      }
      nowe[eli].artykuly[a] = odcisk(art[a]);
      const poprzedni = stare?.artykuly?.[a];
      if (poprzedni && poprzedni !== nowe[eli].artykuly[a])
        zmienione.push(`${nazwa}, art. ${a} → ${tematy.join(", ")}`);
    }
  } catch (e) {
    bledy.push(`${nazwa}: ${String(e.message).split("\n")[0]}`);
  }
}

if (zapisz && bledy.length) {
  // Niepełne odciski oznaczałyby, że część artykułów nie byłaby już pilnowana.
  console.log(`Nie zapisano odcisków — błędy pobierania:\n  ${bledy.join("\n  ")}`);
  process.exit(1);
} else if (zapisz) {
  fs.writeFileSync(PLIK, JSON.stringify({ zapisano: new Date().toISOString().slice(0, 10), akty: nowe }, null, 2) + "\n");
  console.log(`Zapisano odciski: ${sprawdzone} artykułów w ${Object.keys(nowe).length} aktach.`);
} else {
  console.log(`Artykuły: sprawdzono ${sprawdzone} w ${Object.keys(potrzebne).length} aktach` +
    ` (odciski z ${fs.existsSync(PLIK) ? JSON.parse(fs.readFileSync(PLIK, "utf8")).zapisano : "—"}).` +
    ` Zmienione: ${zmienione.length}. Nowe akty zmieniające: ${noweZmieniajace.length}.`);
  for (const [tytul, lista] of [["ZMIENIONY TEKST", zmienione], ["BRAK ARTYKUŁU", brakujace],
    ["NOWE AKTY ZMIENIAJĄCE", noweZmieniajace], ["BŁĄD POBIERANIA", bledy]]) {
    if (!lista.length) continue;
    console.log(`${tytul}:`);
    for (const l of lista) console.log(`  ${l}`);
  }
}
