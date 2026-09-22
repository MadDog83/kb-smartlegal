/*
 * Wyszukiwanie w bazie wiedzy. Ten sam kod trafi później do aplikacji.
 *
 * Różnica wobec poprzedniego rozwiązania: plik sam deklaruje, po czym ma być znaleziony
 * (pole `slowa`, hasła w trzech językach), zamiast liczyć na to, że w prozie przypadkiem
 * znajdzie się słowo z pytania. Ręczny słownik tłumaczeń rdzeni przestaje być potrzebny.
 */

const WAGA_SLOWA = 3; // trafienie w zadeklarowane hasło pliku
const WAGA_TYTUL = 2; // trafienie w tytuł
const WAGA_TRESC = 1; // trafienie w treść
const BONUS_RYZYKO = 5; // plik wysokiego ryzyka, który w ogóle pasuje, ma pierwszeństwo

/*
 * Premia za trafienie w wielowyrazowe hasło. Takie hasła były dotąd martwe: tokenizacja
 * rozbija "how much" na dwa słowa funkcyjne i wyrzuca oba, więc deklaracja autora nie
 * miała żadnego wpływu. A to właśnie fraza niesie intencję pytania — "How much does
 * a temporary residence card cost?" trafiało dotąd we wpis o opłatach jednym słowem
 * ("cost") i przegrywało z plikami, które trafiały trzema słabymi ("card", "resid").
 */
const WAGA_FRAZY = 5;

/*
 * Do promptu idą tematy, które naprawdę odpowiadają na pytanie, a nie tyle, ile wejdzie
 * w budżet. Wypełnianie budżetu szkodziło podwójnie: zjadało limit zapytania u dostawcy
 * (odpowiedzi kończyły się błędem 413) i podsuwało modelowi cudzą treść — na pytanie
 * o utratę statusu UKR bot opisał kartę CUKR, choć właściwy temat był pierwszy.
 *
 * Próg 0,35 i limit czterech tematów to środek obszaru, w którym wszystkie 44 przypadki
 * przechodzą; sprawdzone dla progu 0,30-0,40 i limitu 3-5. Budżet bajtów jest twardą
 * granicą: przy 4500 B dwa przypadki wypadają, bo duży poprawny plik się nie mieści.
 */
const PROG_ISTOTNOSCI = 0.35;
const MAX_TEMATOW = 4;

/*
 * Wykluczenie działa dopiero przy wyraźnej przewadze. Bez tego progu remis rozstrzygał
 * tie-breaker — przy pytaniu „wojewoda odmówił mi zezwolenia" oba tematy miały po 13,8
 * punktu, wygrywał mniejszy plik i uciszał właściwy. Przy remisie lepiej podać oba
 * i zostawić wybór modelowi, niż wyciąć poprawną odpowiedź na podstawie rozmiaru pliku.
 */
const PRZEWAGA_WYKLUCZENIA = 1.25;

/*
 * Podłoga. Bez niej jeden pospolity rdzeń wystarczał, żeby temat „wygrał" ranking, a bot
 * odpowiadał z pełnym przekonaniem: pytanie „co mam zrobić?" zostawia rdzeń „zrobi",
 * trafiało w hasło wpisu o utracie karty i użytkownik dostawał instrukcję zgłoszenia
 * kradzieży, o którą nie pytał.
 *
 * Wartość z pomiaru, nie z głowy: 46 prawdziwych pytań testowych daje najniższy wynik
 * 14,1 przy medianie 24,4, a pytania ogólnikowe i spoza zakresu mieszczą się w 1–10,4.
 * Dwanaście leży w tej przerwie. Poniżej progu nie podajemy żadnego tematu — lepiej, żeby
 * bot poprosił o doprecyzowanie, niż żeby pewnie odpowiedział na niezadane pytanie.
 */
export const PROG_MINIMALNY = 12;

export const DOMYSLNY_BUDZET_BAJTOW = 5000;

const bezOgonkow = (s) =>
  s
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e").replace(/ł/g, "l")
    .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s")
    .replace(/ź/g, "z").replace(/ż/g, "z");

/*
 * Rdzeń pięcioznakowy. Sześć znaków wygląda bezpieczniej, ale gubi typową parę
 * "czekajac" (pytanie) / "czeka" (plik): rdzeń "czekaj" nie mieści się w "czeka".
 * Szum, który przez to wchodzi, odsiewa ważenie rzadkości.
 */
export const rdzen = (w) => (w.length > 5 ? w.slice(0, 5) : w);

/*
 * Słowa funkcyjne trzech języków. Bez tej listy ważenie rzadkości działa na opak:
 * ukraiński przyimek "для" występuje w tej polskojęzycznej bazie w dwóch plikach,
 * więc wychodzi na BARDZO rzadki i dostaje najwyższą wagę. W teście wygrał w ten sposób
 * z właściwą odpowiedzią i dodatkowo wyzwolił premię za wysokie ryzyko.
 * Rzadkość w korpusie nie równa się nośności informacji.
 *
 * Uwaga: słowa pytające o ILOŚĆ celowo NIE są tu wymienione. "ile" i "скільки" są
 * częścią haseł ("ile kosztuje", "скільки коштує") i ich usunięcie psuło wyszukiwanie.
 */
const SLOWA_FUNKCYJNE = new Set([
  // polski
  "jak", "jaki", "jaka", "jakie", "jakiego", "jakim", "czy", "gdzie", "kiedy",
  "kto", "cos", "dla", "przy", "pod", "nad", "tak", "ale", "lub", "ten", "tego", "juz",
  "jeszcze", "byc", "bylo", "bedzie", "trzeba", "moge", "mozna", "mam", "mnie", "chce",
  "jest", "sie", "nie", "oraz", "przez", "bez", "jestem", "potrzebne", "potrzebuje",
  "musze", "musza", "musi", "musimy", "moze", "moga", "powinien", "powinienem", "moj", "moja", "swoje", "teraz", "dalej", "znowu", "bardzo", "tylko",
  // ukraiński
  "які", "яка", "яке", "яко", "що", "чи", "де", "коли", "мені", "мене", "для",
  "при", "про", "від", "над", "під", "так", "але", "або", "цей", "вже", "ще", "бути",
  "буде", "було", "треба", "можу", "можна", "маю", "має", "хочу", "мій", "моя", "зараз",
  // angielski
  "how", "what", "when", "where", "which", "who", "why", "the", "and", "for", "with",
  "from", "about", "can", "may", "must", "need", "does", "did", "are", "was", "were",
  "will", "would", "should", "you", "your", "this", "that", "long", "many", "much",
  "take", "get", "have", "has", "there", "then", "still", "now",
]);

export function tokenizuj(pytanie) {
  const slowa = bezOgonkow(String(pytanie).toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SLOWA_FUNKCYJNE.has(w));
  return Array.from(new Set(slowa.map(rdzen).filter((r) => !SLOWA_FUNKCYJNE.has(r))));
}

const PROG_POSPOLITOSCI = 0.5; // powyżej połowy plików rdzeń nie niesie już nic

/**
 * Waga rdzenia zależy od tego, w ilu plikach występuje. "Коштує" siedzi w jednym pliku
 * i praktycznie wskazuje odpowiedź; "карта" w czterech i nie rozróżnia prawie niczego.
 * Filtr binarny tego nie oddawał — oba liczyły się tak samo, więc właściwy plik remisował
 * z trzema innymi i przegrywał alfabetycznie. Stąd waga ciągła: log(N / df).
 */
function wagiRdzeni(wpisy, rdzenie) {
  const korpus = wpisy.map((w) =>
    bezOgonkow(((w.slowa || []).join(" ") + " " + w.tytul + " " + w.tresc).toLowerCase()),
  );
  const N = korpus.length;
  const wagi = new Map();
  for (const r of rdzenie) {
    const df = korpus.reduce((n, t) => n + (t.includes(r) ? 1 : 0), 0);
    // df = 0 to słowo spoza bazy (np. angielskie "how"), df ponad połowa to wypełniacz.
    wagi.set(r, df === 0 || df > N * PROG_POSPOLITOSCI ? 0 : Math.log(N / df));
  }
  return wagi;
}

/** Znormalizowane pytanie w jednym kawałku — do dopasowania wielowyrazowych haseł. */
const znormalizuj = (pytanie) =>
  bezOgonkow(String(pytanie).toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function ocen(wpisy, pytanie) {
  const rdzenie = tokenizuj(pytanie);
  const wagi = wagiRdzeni(wpisy, rdzenie);
  const pytanieCiagiem = znormalizuj(pytanie);

  return wpisy.map((wpis) => {
    const hasla = bezOgonkow((wpis.slowa || []).join(" ").toLowerCase());
    const tytul = bezOgonkow(String(wpis.tytul || "").toLowerCase());
    const tresc = bezOgonkow(String(wpis.tresc || "").toLowerCase());

    let punkty = 0;
    let trafieniaHasel = 0;

    for (const r of rdzenie) {
      const waga = wagi.get(r) || 0;
      if (waga === 0) continue;
      if (hasla.includes(r)) {
        punkty += WAGA_SLOWA * waga;
        trafieniaHasel++;
      }
      if (tytul.includes(r)) punkty += WAGA_TYTUL * waga;
      if (tresc.includes(r)) punkty += WAGA_TRESC * waga;
    }

    // Hasło wielowyrazowe dopasowujemy w całości, bo pojedyncze jego słowa są funkcyjne
    // i nie przetrwają tokenizacji. Autor pliku deklaruje frazę świadomie — to mocniejszy
    // sygnał intencji niż przypadkowe trafienie w pojedyncze słowo.
    for (const haslo of wpis.slowa || []) {
      const fraza = bezOgonkow(String(haslo).toLowerCase()).trim();
      if (fraza.includes(" ") && pytanieCiagiem.includes(fraza)) punkty += WAGA_FRAZY;
    }

    // Zła odpowiedź w tych tematach kosztuje użytkownika legalność pobytu, więc plik
    // wysokiego ryzyka, który w ogóle pasuje do pytania, nie może przegrać o włos
    // ani wypaść przez budżet rozmiaru. Decyduje o tym pole w danych, nie reguła w kodzie.
    if (wpis.ryzyko === "wysokie" && trafieniaHasel > 0) punkty += BONUS_RYZYKO;

    return { ...wpis, punkty, trafieniaHasel };
  });
}

export function wybierz(wpisy, pytanie, budzetBajtow = DOMYSLNY_BUDZET_BAJTOW) {
  const ocenione = ocen(wpisy, pytanie)
    .filter((w) => w.punkty > 0)
    // Przy zbliżonym wyniku wygrywa plik, który trafił większą liczbą zadeklarowanych
    // haseł — czyli ten, który sam się do tego pytania przyznaje.
    .sort(
      (a, b) =>
        b.punkty - a.punkty ||
        b.trafieniaHasel - a.trafieniaHasel ||
        a.bajty - b.bajty ||
        a.id.localeCompare(b.id),
    );

  // Nic nie pasuje dostatecznie mocno — oddajemy pustkę zamiast przypadkowego tematu.
  if (!ocenione.length || ocenione[0].punkty < PROG_MINIMALNY)
    return { wybrane: [], bajty: 0, wszystkie: ocenione, ponizejProgu: true };

  const wybrane = [];
  const wykluczone = new Map(); // id wykluczonego -> punkty tematu, który go wyklucza
  let bajty = 0;
  const najlepszy = ocenione.length ? ocenione[0].punkty : 0;
  for (const wpis of ocenione) {
    if (wybrane.length >= MAX_TEMATOW) break;
    // Temat wykluczony przez któryś z już wybranych opisuje ALTERNATYWNĄ procedurę dla
    // innej sytuacji. Podany obok właściwego, jest dla modelu materiałem do pomylenia —
    // przy odmowie wizy krajowej bot odpowiedział terminem i organem ze ścieżki
    // wojewódzkiej, choć właściwy temat wygrał ranking niemal dwukrotnie. Zakaz zapisany
    // w treści pliku tego nie powstrzymał; usunięcie tematu z promptu powstrzymuje.
    const wykluczajacy = wykluczone.get(wpis.id);
    if (wykluczajacy && wykluczajacy >= wpis.punkty * PRZEWAGA_WYKLUCZENIA) continue;
    // Pierwszy temat wchodzi zawsze; kolejne tylko dopóki naprawdę konkurują z najlepszym.
    if (wybrane.length > 0 && wpis.punkty < najlepszy * PROG_ISTOTNOSCI) break;
    const rozmiar = Buffer.byteLength(wpis.tresc, "utf8");
    if (bajty + rozmiar > budzetBajtow) continue;
    wybrane.push(wpis);
    for (const id of wpis.wyklucza || [])
      wykluczone.set(id, Math.max(wykluczone.get(id) || 0, wpis.punkty));
    bajty += rozmiar;
  }
  return { wybrane, bajty, wszystkie: ocenione };
}
