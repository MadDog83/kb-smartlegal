#!/usr/bin/env node
/*
 * Walidator bazy wiedzy. Uruchom: node tools/validate.mjs
 *
 * Zamienia dyscyplinę, której dziś pilnuje tylko czyjaś uwaga, w regułę mechaniczną.
 * Kod wyjścia 1 przy błędzie — nadaje się do uruchomienia przy każdej zmianie.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TRESC = join(ROOT, "tresc");
const DZIS = new Date();
const STARE_PO_DNIACH = 180;
const MAX_ZNAKOW = 2500;

const WYMAGANE = ["id", "tytul", "artykuly", "zweryfikowano", "ryzyko", "slowa"];

let bledy = 0;
let ostrzezenia = 0;
const widzianeId = new Map();
const wykluczenia = new Map();

function plikiMd(dir) {
  const out = [];
  for (const wpis of readdirSync(dir)) {
    const p = join(dir, wpis);
    if (statSync(p).isDirectory()) out.push(...plikiMd(p));
    else if (wpis.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Podzbiór YAML, który nam wystarcza: klucz: wartość oraz listy w formie [a, b, c]. */
function parsujNaglowek(tekst, sciezka) {
  const m = tekst.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const dane = {};
  for (const linia of m[1].split(/\r?\n/)) {
    if (!linia.trim() || linia.trimStart().startsWith("#")) continue;
    const dwukropek = linia.indexOf(":");
    if (dwukropek < 0) continue;
    const klucz = linia.slice(0, dwukropek).trim();
    let wartosc = linia.slice(dwukropek + 1).trim();
    if (wartosc.startsWith("[") && wartosc.endsWith("]")) {
      wartosc = wartosc
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      wartosc = wartosc.replace(/^["']|["']$/g, "");
    }
    dane[klucz] = wartosc;
  }
  return { dane, tresc: tekst.slice(m[0].length) };
}

const blad = (sciezka, tekst) => {
  console.error(`BŁĄD      ${relative(ROOT, sciezka)}: ${tekst}`);
  bledy++;
};
const ostrzez = (sciezka, tekst) => {
  console.warn(`ostrzeż.  ${relative(ROOT, sciezka)}: ${tekst}`);
  ostrzezenia++;
};

for (const sciezka of plikiMd(TRESC)) {
  const surowy = readFileSync(sciezka, "utf8");
  const rozbior = parsujNaglowek(surowy, sciezka);
  if (!rozbior) {
    blad(sciezka, "brak nagłówka --- ... ---");
    continue;
  }
  const { dane, tresc } = rozbior;

  for (const pole of WYMAGANE) {
    if (dane[pole] === undefined) blad(sciezka, `brak wymaganego pola "${pole}"`);
  }

  if (dane.id) {
    if (!/^[a-z0-9-]+$/.test(dane.id)) blad(sciezka, `id "${dane.id}" nie jest kebab-case`);
    if (widzianeId.has(dane.id))
      blad(sciezka, `id "${dane.id}" już użyte w ${relative(ROOT, widzianeId.get(dane.id))}`);
    widzianeId.set(dane.id, sciezka);
  }

  if (dane.ryzyko && !["normalne", "wysokie"].includes(dane.ryzyko))
    blad(sciezka, `ryzyko musi być "normalne" albo "wysokie", jest "${dane.ryzyko}"`);

  const artykuly = Array.isArray(dane.artykuly) ? dane.artykuly.map(String) : [];
  const zakazane = Array.isArray(dane.artykuly_zakazane)
    ? dane.artykuly_zakazane.map(String)
    : [];

  for (const a of zakazane) {
    if (artykuly.map((x) => x.toLowerCase()).includes(String(a).toLowerCase()))
      blad(sciezka, `art. ${a} jest jednocześnie w "artykuly" i "artykuly_zakazane"`);
  }

  // Reguła, dla której ten walidator w ogóle powstał: artykuł użyty w treści,
  // ale nieopisany w nagłówku, to dokładnie ten błąd, który wypuścił art. 321
  // do zdania o 14-dniowym odwołaniu. Artykuły wymienione po to, żeby ich ZAKAZAĆ,
  // liczą się jako opisane — ale w drugiej liście, nie w tej pierwszej.
  const znane = new Set(
    [...artykuly, ...zakazane].map((x) => String(x).toLowerCase()),
  );
  const uzyte = new Set(
    [...tresc.matchAll(/art\.\s?(\d+[a-z]?)/gi)].map((x) => x[1].toLowerCase()),
  );
  for (const a of uzyte) {
    if (!znane.has(a))
      blad(
        sciezka,
        `art. ${a} użyty w treści, ale nie ma go ani w "artykuly", ani w "artykuly_zakazane"`,
      );
  }
  if (artykuly.length && !dane.ustawa)
    blad(sciezka, "są artykuły, ale nie podano pola \"ustawa\"");

  // Kwota bez źródła to najczęstsza droga do nieaktualnej informacji.
  const maKwote = /\d[\d\s]*\s*(zł|zl|PLN)\b/i.test(tresc);
  if (maKwote && !dane.zrodlo) blad(sciezka, "treść zawiera kwotę, ale brak pola \"zrodlo\"");

  if (dane.zweryfikowano) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dane.zweryfikowano)) {
      blad(sciezka, `zweryfikowano "${dane.zweryfikowano}" nie jest datą RRRR-MM-DD`);
    } else {
      const wiek = Math.floor((DZIS - new Date(dane.zweryfikowano)) / 86400000);
      if (wiek > STARE_PO_DNIACH)
        ostrzez(sciezka, `zweryfikowano ${wiek} dni temu — warto potwierdzić u źródła`);
    }
  }

  if (Array.isArray(dane.slowa) && dane.slowa.length < 3)
    ostrzez(sciezka, "mniej niż 3 hasła — wyszukiwanie może nie trafić w ten plik");

  // Polski odmienia: "pomocy prawnej" nie pasuje do wzorca "pomoc prawn", a "prawnej"
  // nie pasuje do "prawni". Ten sam blad kosztowal nas wczesniej trafnosc wyszukiwarki
  // bota, wiec tu od razu dopuszczamy koncowki. Wzorzec celowo wymaga frazy, a nie
  // samego rdzenia "prawn", ktory wystepuje takze w "tytul prawny" czy "akt prawny".
  const KIERUJE_DO_PRAWNIKA =
    /(adwokat\w*|radc\w*\s+prawn\w*|pomoc\w*\s+prawn\w*|prawn\w*\s+pomoc\w*|organizacj\w*\s+pomocy)/i;
  if (dane.ryzyko === "wysokie" && !KIERUJE_DO_PRAWNIKA.test(tresc))
    blad(sciezka, "ryzyko wysokie, a treść nie kieruje do pomocy prawnej");

  if (tresc.length > MAX_ZNAKOW)
    ostrzez(sciezka, `${tresc.length} znaków — rozważ podział na dwa tematy`);

  if (dane.wyklucza !== undefined && !Array.isArray(dane.wyklucza))
    blad(sciezka, '"wyklucza" musi być listą identyfikatorów');
  wykluczenia.set(dane.id, Array.isArray(dane.wyklucza) ? dane.wyklucza.map(String) : []);
}

// Wykluczenia muszą być wzajemne. Jednostronne dawałoby wynik zależny od tego, który
// temat wypadł wyżej w rankingu — czyli niepowtarzalny i niemożliwy do przetestowania.
for (const [id, lista] of wykluczenia) {
  for (const inny of lista) {
    if (!wykluczenia.has(inny)) {
      blad(widzianeId.get(id), `"wyklucza" wskazuje na nieistniejący temat "${inny}"`);
      continue;
    }
    if (!wykluczenia.get(inny).includes(id)) {
      blad(
        widzianeId.get(id),
        `wykluczenie nie jest wzajemne: "${id}" wyklucza "${inny}", ale nie odwrotnie`,
      );
    }
  }
}

const plikow = widzianeId.size;
console.log(
  `\n${plikow} plików, ${bledy} błędów, ${ostrzezenia} ostrzeżeń.` +
    (bledy ? " Popraw błędy przed scaleniem." : " Baza przechodzi walidację."),
);
process.exit(bledy ? 1 : 0);
