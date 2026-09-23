// Które tematy dawno nie były sprawdzane u źródła.
// Uruchamiane co tydzień przez zaplanowane zadanie; można też ręcznie:
//   node tools/monitor/przeterminowane.mjs            (progi domyślne: 90 dni, wysokie ryzyko 60)
//   node tools/monitor/przeterminowane.mjs 30 20       (własne progi)
// Czyta indeks, więc widzi dokładnie to, co widzi aplikacja.
import fs from "node:fs";

const [progNormalny = 90, progWysoki = 60] = process.argv.slice(2).map(Number);
const idx = JSON.parse(fs.readFileSync(new URL("../../index/kb-index.json", import.meta.url), "utf8"));
const dzis = new Date();
const dni = (d) => Math.floor((dzis - new Date(d)) / 86400000);

const wiersze = idx.wpisy
  .map((w) => ({ id: w.id, ryzyko: w.ryzyko, data: w.zweryfikowano, wiek: w.zweryfikowano ? dni(w.zweryfikowano) : Infinity }))
  .map((w) => ({ ...w, prog: w.ryzyko === "wysokie" ? progWysoki : progNormalny }))
  .filter((w) => w.wiek > w.prog)
  .sort((a, b) => b.wiek - a.wiek);

console.log(`Tematów w indeksie: ${idx.wpisy.length}. Do ponownego sprawdzenia: ${wiersze.length}` +
  ` (progi: ${progNormalny} dni, wysokie ryzyko ${progWysoki} dni).`);
for (const w of wiersze)
  console.log(`  ${w.id.padEnd(36)} ${w.ryzyko.padEnd(8)} sprawdzony ${w.data ?? "nigdy"} (${w.wiek} dni temu)`);
