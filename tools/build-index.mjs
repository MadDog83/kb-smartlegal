#!/usr/bin/env node
/*
 * Buduje indeks z plików treści. Uruchom: node tools/build-index.mjs
 *
 * Indeks jest produktem ubocznym — nigdy się go nie edytuje ręcznie, zawsze odtwarza
 * z `tresc/`. To aplikacja czyta indeks, nie repozytorium.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TRESC = join(ROOT, "tresc");
const WYJSCIE = join(ROOT, "index", "kb-index.json");

function plikiMd(dir) {
  const out = [];
  for (const wpis of readdirSync(dir)) {
    const p = join(dir, wpis);
    if (statSync(p).isDirectory()) out.push(...plikiMd(p));
    else if (wpis.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

function parsuj(tekst) {
  const m = tekst.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const dane = {};
  for (const linia of m[1].split(/\r?\n/)) {
    const i = linia.indexOf(":");
    if (i < 0) continue;
    const klucz = linia.slice(0, i).trim();
    let wartosc = linia.slice(i + 1).trim();
    if (wartosc.startsWith("[") && wartosc.endsWith("]")) {
      wartosc = wartosc.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      wartosc = wartosc.replace(/^["']|["']$/g, "");
    }
    dane[klucz] = wartosc;
  }
  return { dane, tresc: tekst.slice(m[0].length).trim() };
}

const wpisy = [];
for (const sciezka of plikiMd(TRESC)) {
  const r = parsuj(readFileSync(sciezka, "utf8"));
  if (!r) {
    console.error(`pominięto (brak nagłówka): ${relative(ROOT, sciezka)}`);
    continue;
  }
  const { dane, tresc } = r;
  wpisy.push({
    id: dane.id,
    tytul: dane.tytul,
    ustawa: dane.ustawa || null,
    artykuly: Array.isArray(dane.artykuly) ? dane.artykuly.map(String) : [],
    artykuly_zakazane: Array.isArray(dane.artykuly_zakazane) ? dane.artykuly_zakazane.map(String) : [],
    wyklucza: Array.isArray(dane.wyklucza) ? dane.wyklucza.map(String) : [],
    organ: dane.organ || null,
    zrodlo: dane.zrodlo || null,
    zweryfikowano: dane.zweryfikowano || null,
    ryzyko: dane.ryzyko || "normalne",
    slowa: Array.isArray(dane.slowa) ? dane.slowa : [],
    sciezka: relative(ROOT, sciezka),
    bajty: Buffer.byteLength(tresc, "utf8"),
    tresc,
  });
}

const indeks = {
  zbudowano: new Date().toISOString().slice(0, 10),
  liczbaWpisow: wpisy.length,
  // Mapa artykuł -> ustawa, zbudowana z całej bazy. To ona pozwoli weryfikatorowi
  // sprawdzić nie tylko czy artykuł istnieje, ale czy pasuje do przywołanej ustawy.
  artykulyUstaw: wpisy.reduce((acc, w) => {
    for (const a of w.artykuly) {
      if (!w.ustawa) continue;
      (acc[a] ||= []).push(w.ustawa);
      acc[a] = Array.from(new Set(acc[a]));
    }
    return acc;
  }, {}),
  wpisy,
};

mkdirSync(join(ROOT, "index"), { recursive: true });
writeFileSync(WYJSCIE, JSON.stringify(indeks, null, 1), "utf8");

const kb = (Buffer.byteLength(JSON.stringify(indeks), "utf8") / 1024).toFixed(1);
const wysokie = wpisy.filter((w) => w.ryzyko === "wysokie").length;
console.log(
  `Indeks: ${wpisy.length} wpisów, ${wysokie} wysokiego ryzyka, ` +
    `${Object.keys(indeks.artykulyUstaw).length} artykułów przypisanych do ustaw, ${kb} kB.`,
);
