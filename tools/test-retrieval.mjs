#!/usr/bin/env node
/*
 * Test wyszukiwania. Uruchom: node tools/test-retrieval.mjs
 *
 * Sprawdza sam etap wyszukiwania, w oderwaniu od modelu: czy do promptu trafiłby plik,
 * który faktycznie odpowiada na pytanie. Działa lokalnie, w ułamku sekundy i bez limitów
 * API — w odróżnieniu od pełnego zestawu przez interfejs czatu, który trwa 45 minut.
 *
 * Jeżeli plik nie trafi do wyboru, model nie ma szans odpowiedzieć poprawnie. Ten test
 * oddziela więc "nie znalazł" od "znalazł i źle napisał".
 */
import { readFileSync } from "node:fs";
import { wybierz } from "./retrieve.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const indeks = JSON.parse(readFileSync(ROOT + "index/kb-index.json", "utf8"));
const przypadki = JSON.parse(readFileSync(ROOT + "tools/retrieval-cases.json", "utf8"));

let zaliczone = 0;
let poza = 0;
const problemy = [];

for (const p of przypadki) {
  const { wybrane } = wybierz(indeks.wpisy, p.q);
  const idy = wybrane.map((w) => w.id);

  if (!p.oczekiwane || p.oczekiwane.length === 0) {
    // Poprzednia wersja przepuszczała każdy wynik, jeśli przypadek nie miał pola
    // "zakazane" — test, który nie może się nie udać, niczego nie mierzy. Przywrócenie
    // hasła-magnesu z 20 września przechodziło przez niego niezauważone.
    // Teraz: bez "zakazane" wymagamy prawdziwej pustki; z "zakazane" — tylko nieobecności
    // tego jednego tematu.
    const ok = p.zakazane ? !idy.includes(p.zakazane) : wybrane.length === 0;
    if (ok) zaliczone++;
    else
      problemy.push(
        `${p.id}: BRAK pustki — pytanie ogólnikowe lub spoza zakresu dostało temat ${idy[0]}`,
      );
    continue;
  }

  const pozycja = idy.indexOf(p.oczekiwane[0]);
  if (pozycja === 0) {
    zaliczone++;
  } else if (pozycja > 0) {
    zaliczone++;
    poza++;
    problemy.push(`${p.id}: "${p.oczekiwane[0]}" trafiony, ale dopiero na pozycji ${pozycja + 1}`);
  } else {
    problemy.push(
      `${p.id}: BRAK "${p.oczekiwane[0]}" — wybrano: ${idy.slice(0, 4).join(", ") || "nic"}`,
    );
  }
}

console.log(`\nWyszukiwanie: ${zaliczone}/${przypadki.length} trafionych` +
  (poza ? `, w tym ${poza} poza pierwszą pozycją` : ""));
if (problemy.length) {
  console.log("");
  for (const p of problemy) console.log("  " + p);
}
process.exit(problemy.some((p) => p.includes("BRAK")) ? 1 : 0);
