# Zestaw testowy bota

Mierzy jakość odpowiedzi bota **na produkcji**, przez prawdziwy interfejs czatu.
Dzięki temu widzi dokładnie to, co widzi użytkownik — razem z komunikatem awaryjnym,
gdy backend zawiedzie.

Po co: dopóki nie ma pomiaru, nie da się stwierdzić, czy zmiana coś poprawiła,
a regresje wykrywa się przypadkiem, klikając w czat. Trzy razy w trakcie tej pracy
postawiona „na oko" diagnoza okazała się błędna i dopiero pomiar pokazał prawdziwą
przyczynę.

Ten zestaw testuje **czat jako całość**: bazę wiedzy, wyszukiwanie, prompt, kaskadę
modeli i sanityzację cytatów naraz. Sprawdzanie samego wyszukiwania, bez sieci i bez
modelu, robi `tools/test-retrieval.mjs`.

## Uruchomienie

1. Otwórz `https://smart-legalization.lovable.app/` i **otwórz okno czatu**.
2. Otwórz konsolę przeglądarki (F12 → Console).
3. Wklej zawartość `przypadki.json` poprzedzoną przypisaniem:

   ```js
   window.__KB_CASES = /* tu wklej tablicę z przypadki.json */;
   ```

4. Wklej całą zawartość `runner.js`.
5. Postęp: `__kbStatus()`
6. Wynik: `__kbReport()` — tabela w konsoli.
   Pełne odpowiedzi: `copy(JSON.stringify(__kb.results, null, 2))`

Przebieg trwa 25–45 minut, zależnie od liczby ponowień. **Zostaw kartę na wierzchu.**
Chrome zamraża karty w tle i przerywa pętlę w losowym miejscu — objawia się to tym,
że `__kbStatus()` stoi w miejscu, a `Date.now() - __kb.beat` rośnie ponad minutę.

## Dlaczego tak wolno

Model z wyszukiwarką (`groq/compound-mini`) ma dobowy limit zapytań i 60-sekundowy
cooldown po odmowie. Puszczone seriami pytania wracają komunikatem awaryjnym po
ułamku sekundy — pomiar mierzy wtedy limit, a nie jakość odpowiedzi. Dlatego
`GAP = 25000` i jedno ponowienie po 60 sekundach. **Nie zmniejszaj tych wartości.**

To zresztą samo w sobie jest ustaleniem: bot nie znosi serii zapytań. W przebiegu
z 16 września 9 z 30 pytań wróciło komunikatem awaryjnym, co zaniżyło wynik o tyle,
że liczba przestała cokolwiek znaczyć. Runner ponawia je teraz samodzielnie.

## Struktura przypadku

```json
{
  "id": "sg-powrot-pl",
  "lang": "pl",
  "q": "Straz Graniczna wydala mi decyzje o zobowiazaniu do powrotu. Gdzie sie odwolac?",
  "must":    ["7 dni", "Komendant", "321"],
  "mustNot": ["Szefa Urz", "14 dni"],
  "order":   ["440", "340"]
}
```

- `must` — wyrażenia regularne, które **muszą** wystąpić w odpowiedzi
- `mustNot` — takie, których **nie wolno**; tu mieszczą się konkretne błędy
  zaobserwowane na produkcji
- `order` — dwie wartości, pierwsza musi paść przed drugą (kolejność opłat 440 / 340)
- `lang` — oczekiwany język odpowiedzi; runner wykrywa język i porównuje

Pytania są pisane **bez polskich znaków diakrytycznych**. To celowe: tak pisze
znaczna część użytkowników i to zarazem sprawdza wykrywanie języka, które nie może
opierać się wyłącznie na ogonkach.

## Skąd wzięły się przypadki

Każdy `mustNot` odpowiada realnej złej odpowiedzi zaobserwowanej na produkcji:

| przypadek | co sprawdza |
|---|---|
| `nielegalny-pobyt-pl` / `-ua` | bot doradzał wniosek o pobyt czasowy, choć nielegalny pobyt jest przesłanką odmowy (art. 99, 100); osobno — przedstawiał ochronę międzynarodową jako „pierwszy krok" do legalizacji |
| `overstay-en` | bot zapewniał, że w trakcie rozpatrywania wniosku wolno zostać — nieprawda po przekroczeniu terminu |
| `odwolanie-wojewoda-pl`, `sg-powrot-pl`, `wiza-odmowa-pl` | trzy różne ścieżki odwoławcze, mieszane przez bota (art. 321 przy 14-dniowym odwołaniu do Szefa UDSC) |
| `obywatelstwo-malzenstwo-pl` | bot podawał „2 lata małżeństwa" zamiast 3 lat — liczby z dwóch różnych warunków |
| `gdzie-zlozyc-pl` / `-ua` | bot odsyłał do UDSC zamiast do wojewody |
| `oplaty-*` | kolejność 440 przed 340 |
| `oplata-obywatelstwo-pl` | stawka 1000 zł, nie dawna 219 zł |
| `nostryfikacja-pl` | temat spoza bazy — bot ma przyznać brak potwierdzenia, nie podać kwoty z pamięci |
| `wyjazd-w-trakcie-pl` | bot wskazywał „FAQ" jako źródło prawa |
| `scope-guard-pl` | pytanie poza zakresem |

## Ograniczenia

- Mierzy przez interfejs, więc jest wolny i wymaga otwartej karty na wierzchu.
- Model bywa niedeterministyczny — pojedynczy przypadek może raz przejść, raz nie.
  Do porównania „przed / po" liczy się wynik zbiorczy, nie pojedyncza pozycja.
- Wykrywanie języka jest heurystyczne (cyrylica, lista słów funkcyjnych obu języków).
  Sama obecność polskich znaków nie wystarcza: poprawna angielska odpowiedź cytuje
  „Komendant Główny Straży Granicznej" i bywała uznawana za polską.
- Sprawdzacz porównuje wzorce, nie rozumie treści. Odpowiedź może przejść wszystkie
  wzorce i nadal być zła — dlatego `__kb.results` zachowuje pełne teksty do przejrzenia.
