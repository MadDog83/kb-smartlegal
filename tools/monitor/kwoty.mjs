// Czy kwoty z tematów nadal widnieją na ich stronie źródłowej.
// Uruchamiane co tydzień przez zaplanowane zadanie; można też ręcznie:
//   node tools/monitor/kwoty.mjs            porównuje z odciski-kwot.json
//   node tools/monitor/kwoty.mjs --zapisz   zapisuje stan bieżący (po sprawdzeniu tematów)
//
// Dla każdego tematu z polem `zrodlo` (poza ISAP — tam są ustawy, nie cenniki) pobiera stronę
// i sprawdza, które kwoty „NNN zł" z treści tematu na niej widnieją. Zgłasza tylko kwotę,
// która przy zapisie była na stronie, a teraz jej nie ma — wtedy urząd mógł zmienić stawkę.
// Porównanie z zapisem, a nie z samą treścią, bo tematy celowo zawierają kwoty, których na
// stronie nie ma: sumy (640 + 100 = 740 zł), stawki nieaktualne podane jako ostrzeżenie
// (219 zł) i stawki drugiej drogi (1669 zł obok 1000 zł).
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const PLIK = new URL("./odciski-kwot.json", import.meta.url);
const zapisz = process.argv.includes("--zapisz");
const zapisane = fs.existsSync(PLIK) ? JSON.parse(fs.readFileSync(PLIK, "utf8")).tematy : {};
const stan = { ...zapisane };

const idx = JSON.parse(fs.readFileSync(new URL("../../index/kb-index.json", import.meta.url), "utf8"));
const KWOTA = /(\d{1,3}(?:[  ]\d{3})*|\d+)\s*zł/g;
const liczba = (s) => s.replace(/[  ]/g, "");

/** Tekst strony bez znaczników, ze spacjami tysięcy usuniętymi tak samo jak w tematach. */
function tekstStrony(url) {
  // curl, nie fetch: w środowisku zaplanowanego zadania ruch idzie przez proxy.
  const html = execFileSync("curl", ["-sS", "-f", "--http1.1", "-A", "Mozilla/5.0", "-m", "60", url], {
    maxBuffer: 32 << 20,
  }).toString("utf8");
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const strony = new Map();
const braki = [];
const bledy = [];
let tematy = 0;
let kwoty = 0;

for (const w of idx.wpisy) {
  if (!w.zrodlo || /isap\.sejm\.gov\.pl/.test(w.zrodlo)) continue;
  const wTemacie = [...new Set([...w.tresc.matchAll(KWOTA)].map((m) => liczba(m[1])))];
  if (!wTemacie.length) continue;
  tematy++;
  let tekst = strony.get(w.zrodlo);
  if (tekst === undefined) {
    try {
      tekst = tekstStrony(w.zrodlo);
    } catch (e) {
      tekst = null;
      bledy.push(`${w.id}: ${w.zrodlo} — ${String(e.message).split("\n")[0]}`);
    }
    strony.set(w.zrodlo, tekst);
  }
  if (tekst === null) continue;
  const naStronie = new Set([...tekst.matchAll(KWOTA)].map((m) => liczba(m[1])));
  const obecne = wTemacie.filter((k) => naStronie.has(k));
  kwoty += wTemacie.length;
  stan[w.id] = { zrodlo: w.zrodlo, obecne };
  const przedtem = zapisane[w.id]?.zrodlo === w.zrodlo ? zapisane[w.id].obecne : [];
  for (const k of przedtem)
    if (wTemacie.includes(k) && !naStronie.has(k)) braki.push(`${w.id}: ${k} zł zniknęło z ${w.zrodlo}`);
}

if (zapisz) {
  // Strona, której nie udało się pobrać, zachowuje poprzedni zapis.
  fs.writeFileSync(PLIK, JSON.stringify({ zapisano: new Date().toISOString().slice(0, 10), tematy: stan }, null, 2) + "\n");
  console.log(`Zapisano kwoty ${Object.keys(stan).length} tematów.` + (bledy.length ? ` Nie pobrano: ${bledy.length}.` : ""));
  process.exit(0);
}

console.log(`Kwoty: sprawdzono ${kwoty} w ${tematy} tematach (${strony.size} stron). Brakujące: ${braki.length}.`);
for (const [tytul, lista] of [["KWOTA ZNIKNĘŁA ZE STRONY", braki], ["BŁĄD POBIERANIA", bledy]]) {
  if (!lista.length) continue;
  console.log(`${tytul}:`);
  for (const l of lista) console.log(`  ${l}`);
}
