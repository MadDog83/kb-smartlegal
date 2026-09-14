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

## Walidacja

```bash
node tools/validate.mjs
```

Sprawdza to, czego dotąd pilnowała tylko czyjaś uwaga:

- artykuł użyty w treści musi być opisany w nagłówku — w `artykuly` albo w
  `artykuly_zakazane`;
- artykuły wymagają nazwy ustawy;
- kwota wymaga adresu źródła;
- temat `ryzyko: wysokie` musi kierować do pomocy prawnej;
- data weryfikacji starsza niż pół roku daje ostrzeżenie;
- identyfikatory są unikalne, pliki nie przerastają jednego tematu.

Kod wyjścia 1 przy błędzie, więc nadaje się do uruchomienia przy każdej zmianie.

## Stan

**35 plików treści**, dziesięć obszarów tematycznych, walidacja bez błędów.
Pokryte są wszystkie rozdziały poprzedniej bazy oraz tematy, których w niej nie było,
a które wyszły w testach na produkcji jako źródło złych odpowiedzi: nielegalny pobyt,
przekroczony termin, właściwy organ, trzy rozdzielone ścieżki odwoławcze i bezczynność.

Do zrobienia w kolejnych etapach: teksty ustaw pocięte na artykuły w `zrodla/`
oraz indeks wektorowy budowany z treści.

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
