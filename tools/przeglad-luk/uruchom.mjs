// Przegląd luk: node tools/przeglad-luk/uruchom.mjs — pokazuje, dokąd trafia każde pytanie z pytania.mjs.
import fs from "node:fs";
import { wybierz, ocen } from "../retrieve.mjs";
import { PYTANIA } from "./pytania.mjs";
const idx = JSON.parse(fs.readFileSync(new URL("../../index/kb-index.json", import.meta.url), "utf8"));
const wiersze = [];
for (const [grupa, q, oczek] of PYTANIA) {
  const o = ocen(idx.wpisy, q).filter(w => w.punkty > 0).sort((a,b) => b.punkty - a.punkty);
  const r = wybierz(idx.wpisy, q);
  const top = o[0];
  wiersze.push({ grupa, q, oczek,
    szczyt: top ? top.punkty : 0,
    pierwszy: r.wybrane[0]?.id || null,
    wybrane: r.wybrane.map(w => w.id) });
}
for (const w of wiersze) {
  let werdykt;
  if (!w.pierwszy) werdykt = "PUSTO";
  else if (w.oczek && w.pierwszy === w.oczek) werdykt = "ok";
  else if (w.oczek && w.wybrane.includes(w.oczek)) werdykt = "ok(dalej)";
  else if (w.oczek) werdykt = "ZLY TEMAT";
  else werdykt = "?";
  w.werdykt = werdykt;
  console.log(werdykt.padEnd(10) + String(w.szczyt.toFixed(1)).padStart(5) + "  " +
    (w.pierwszy || "-").padEnd(32) + "  " + w.q.slice(0, 64));
}
fs.writeFileSync("wynik.json", JSON.stringify(wiersze, null, 1));
const liczba = (x) => wiersze.filter(w => w.werdykt === x).length;
console.log(`\nok: ${liczba("ok")+liczba("ok(dalej)")}  pusto: ${liczba("PUSTO")}  zly temat: ${liczba("ZLY TEMAT")}  do oceny recznej: ${liczba("?")}`);
