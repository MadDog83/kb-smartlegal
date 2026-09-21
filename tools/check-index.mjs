#!/usr/bin/env node
/*
 * Czy indeks odpowiada treści? Uruchom: node tools/check-index.mjs
 *
 * Aplikacja czyta index/kb-index.json, a nie pliki z tresc/. Jeżeli ktoś zmieni temat
 * i zapomni przebudować indeks, produkcja po cichu serwuje starą treść — a walidacja
 * i test wyszukiwania dalej przechodzą, bo oba sprawdzają ten stary indeks. Ten skrypt
 * przebudowuje indeks i porównuje go z zatwierdzonym.
 *
 * Pole "zbudowano" jest pomijane: to data przebudowy, więc różni się każdego dnia,
 * nawet przy identycznej treści. Gdyby liczyło się do porównania, test zaczynałby
 * padać od samego upływu czasu.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const PLIK = ROOT + "index/kb-index.json";

const zatwierdzony = readFileSync(PLIK, "utf8");
execFileSync(process.execPath, [ROOT + "tools/build-index.mjs"], { stdio: "ignore" });
const przebudowany = readFileSync(PLIK, "utf8");

const bezDaty = (tekst) => {
  const { zbudowano, ...reszta } = JSON.parse(tekst);
  return reszta;
};
const stary = bezDaty(zatwierdzony);
const nowy = bezDaty(przebudowany);

if (JSON.stringify(stary) === JSON.stringify(nowy)) {
  // Różni się co najwyżej data — przywracamy zatwierdzony plik bajt w bajt, żeby samo
  // uruchomienie sprawdzenia nie zostawiało w repozytorium zmiany do zatwierdzenia.
  writeFileSync(PLIK, zatwierdzony, "utf8");
  console.log(`Indeks zgodny z treścią: ${nowy.wpisy.length} wpisów.`);
  process.exit(0);
}

// Pokaż, co konkretnie się rozjechało, zamiast samego "różni się".
const mapa = (idx) => new Map(idx.wpisy.map((w) => [w.id, JSON.stringify(w)]));
const s = mapa(stary);
const n = mapa(nowy);
const dodane = [...n.keys()].filter((id) => !s.has(id));
const usuniete = [...s.keys()].filter((id) => !n.has(id));
const zmienione = [...n.keys()].filter((id) => s.has(id) && s.get(id) !== n.get(id));

console.log("INDEKS NIEAKTUALNY — treść w tresc/ nie odpowiada index/kb-index.json.");
if (dodane.length) console.log("  nowe tematy, których brak w indeksie: " + dodane.join(", "));
if (usuniete.length) console.log("  tematy w indeksie, których nie ma już w treści: " + usuniete.join(", "));
if (zmienione.length) console.log("  tematy zmienione od ostatniej przebudowy: " + zmienione.join(", "));
console.log("\nNapraw: node tools/build-index.mjs, a potem zatwierdź index/kb-index.json.");
console.log("(Przebudowany indeks już leży na dysku — wystarczy go zatwierdzić.)");
process.exit(1);
