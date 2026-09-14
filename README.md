# legal-kb — baza wiedzy o legalizacji pobytu w Polsce

Źródło prawdy dla treści prawnej używanej przez asystenta Smart Legalization Support.
Niezależne od aplikacji: aplikacja czyta z tej bazy indeks, ale nie zawiera treści.

Dzięki temu aktualizacja przepisu nie wymaga wdrożenia aplikacji ani kredytów Lovable,
a tej samej bazy może używać więcej niż jeden projekt.

## Układ

```
tresc/        treść pisana ręcznie — to z niej powstają odpowiedzi
  oplaty/
  odwolania/
  procedura/
  problemy/
zrodla/       (etap 2) teksty ustaw pocięte na artykuły — wyłącznie do weryfikacji
tools/
  validate.mjs
SCHEMA.md     format pliku treści i uzasadnienie każdego pola
```

**Jeden plik = jeden temat = jeden fragment** zwracany przez wyszukiwarkę. Format pliku
opisuje `SCHEMA.md` — przeczytaj go przed dopisaniem czegokolwiek.

## Narzędzia

```bash
node tools/validate.mjs        # dyscyplina treści
node tools/build-index.mjs     # tresc/ -> index/kb-index.json
node tools/test-retrieval.mjs  # czy właściwy plik trafiłby do promptu
```

**`validate.mjs`** sprawdza to, czego dotąd pilnowała tylko czyjaś uwaga: artykuł użyty
w treści musi być opisany w nagłówku (w `artykuly` albo w `artykuly_zakazane`), artykuły
wymagają nazwy ustawy, kwota wymaga adresu źródła, temat `ryzyko: wysokie` musi kierować
do pomocy prawnej, data weryfikacji starsza niż pół roku daje ostrzeżenie.

**`build-index.mjs`** buduje `index/kb-index.json` — produkt uboczny, nigdy nie edytowany
ręcznie. Zawiera też mapę artykuł → ustawa zbudowaną z całej bazy; to na jej podstawie
weryfikator cytatów będzie mógł sprawdzić nie tylko czy artykuł istnieje, ale czy pasuje
do przywołanej ustawy.

**`test-retrieval.mjs`** mierzy sam etap wyszukiwania, w oderwaniu od modelu: czy plik,
który odpowiada na pytanie, w ogóle trafiłby do promptu. Działa lokalnie w ułamku sekundy,
bez limitów API — w odróżnieniu od pełnego zestawu przez interfejs czatu, który trwa
45 minut. Oddziela "nie znalazł" od "znalazł i źle napisał".

Wszystkie trzy kończą się kodem 1 przy błędzie, więc nadają się do uruchomienia przy
każdej zmianie.

## Stan

**39 plików treści**, jedenaście obszarów tematycznych. Walidacja bez błędów,
**wyszukiwanie 44/44** na zestawie kontrolnym w trzech językach.

Pokryte są wszystkie rozdziały poprzedniej bazy, tematy, których w niej nie było,
a które wyszły w testach na produkcji jako źródło złych odpowiedzi (nielegalny pobyt,
przekroczony termin, właściwy organ, trzy rozdzielone ścieżki odwoławcze, bezczynność),
oraz obywatelstwo — którego stara baza świadomie nie obejmowała, mimo że jest jedną
z czterech głównych usług serwisu.

Do zrobienia: podłączenie aplikacji do indeksu i weryfikator cytatów korzystający
z pól `artykuly` oraz `artykuly_zakazane`.

## Jak to trafi na GitHub

```bash
git init
git add .
git commit -m "Baza wiedzy: schemat, walidator i pierwsza partia treści"
git branch -M main
git remote add origin git@github.com:<konto>/legal-kb.git
git push -u origin main
```

Repozytorium może być prywatne — indeks budowany z treści i tak jest publikowany osobno.

## Zasada, która nie podlega negocjacji

Treść zmienia się **tylko tutaj**. Nic nie dopisujemy bezpośrednio w kodzie aplikacji —
inaczej po kilku tygodniach znów będą dwa źródła prawdy, które się rozjadą.
