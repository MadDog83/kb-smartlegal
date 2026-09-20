# Schemat pliku treści

Jeden plik = jeden temat = jeden fragment zwracany przez wyszukiwarkę.
Jeśli plik rozrasta się ponad ~2500 znaków, znaczy że mieści dwa tematy — podziel go.

## Nagłówek

```yaml
---
id: oplaty-karta-pobytu
tytul: Opłaty za kartę pobytu
ustawa: rozporządzenie o opłacie skarbowej
artykuly: []
organ: wojewoda
zrodlo: https://www.gov.pl/web/uw-lodzki/...
zweryfikowano: 2026-09-14
ryzyko: normalne
slowa: [opłata, koszt, ile kosztuje, fee, cost, оплата, скільки коштує]
---
```

| pole | wymagane | znaczenie |
|---|---|---|
| `id` | tak | unikalne, kebab-case, stabilne — nie zmieniaj po utworzeniu |
| `tytul` | tak | nagłówek tematu, czytelny dla człowieka |
| `ustawa` | gdy `artykuly` niepuste | pełna nazwa aktu, do którego należą artykuły |
| `artykuly` | tak (może być puste) | **każdy numer artykułu użyty w treści musi tu być** |
| `artykuly_zakazane` | nie | artykuły, których przy tym temacie **nie wolno** cytować |
| `wyklucza` | nie | tematy, których **nie wolno** podać razem z tym — patrz niżej |
| `organ` | nie | organ właściwy, jeśli temat go dotyczy |
| `zrodlo` | gdy treść zawiera kwotę | adres strony urzędowej, z której pochodzi liczba |
| `zweryfikowano` | tak | data ostatniego sprawdzenia u źródła, `RRRR-MM-DD` |
| `ryzyko` | tak | `normalne` albo `wysokie` |
| `slowa` | tak | hasła w trzech językach — po nich trafia wyszukiwanie |

## Dlaczego `artykuly` jest listą, a nie tekstem

To jedyne zabezpieczenie przed błędem, który realnie występował w produkcji: bot doklejał
`art. 321` (7 dni, Straż Graniczna) do zdania o 14-dniowym odwołaniu do Szefa UDSC.
Numer artykułu istniał w bazie, więc weryfikator cytatów go przepuszczał.

Gdy każdy artykuł jest przypisany do pliku, a plik do ustawy, można sprawdzić nie tylko
**czy** artykuł istnieje, ale **czy pasuje do sytuacji, przy której został napisany**.

Puste `artykuly: []` nie jest niedopatrzeniem — to informacja, że temat nie ma oparcia
w numerze artykułu (tak jest z opłatami, które ustala rozporządzenie) i że **nie wolno**
przypisywać go do żadnego artykułu.

`artykuly_zakazane` powstało przy pierwszym uruchomieniu walidatora. Dwa pliki wymieniają
art. 321 **po to, żeby go zakazać** — dopisanie go do `artykuly` powiedziałoby wyszukiwarce
coś dokładnie odwrotnego. Ta druga lista zapisuje zakaz jako dane, więc weryfikator cytatów
będzie mógł go egzekwować twardo: „art. 321 przy odwołaniu od decyzji wojewody" staje się
warunkiem, który da się sprawdzić maszynowo, zamiast zdania w promptcie, które model
zignorował już dwa razy.

## `ryzyko: wysokie`

Oznacza temat, w którym zła odpowiedź może kosztować użytkownika legalność pobytu:
nielegalny pobyt, przekroczony termin, decyzja powrotowa, ścieżki odwoławcze.
Takie pliki muszą zawierać skierowanie do pomocy prawnej i są wciągane do promptu
z pierwszeństwem przed budżetem rozmiaru.

## Zasady pisania treści

- Piszemy po polsku, językiem odpowiedzi, nie językiem ustawy.
- Najpierw wniosek, potem podstawa prawna. Użytkownik pyta „ile kosztuje", nie „co mówi art. 235".
- Nigdy nie pisz numeru artykułu bez nazwy ustawy w tym samym zdaniu.
- Kwota bez `zrodlo` i `zweryfikowano` to błąd, nie niedopatrzenie.
- Jeśli czegoś nie wiemy — zapisz to wprost w treści. „Nie ma w opracowanych źródłach"
  jest lepszą treścią niż cisza, bo powstrzymuje model przed zgadywaniem.


## Pole `wyklucza`

Trzy ścieżki odwoławcze — od odmowy wizy, od decyzji wojewody i od decyzji Straży
Granicznej — są sobie bliskie znaczeniowo, więc wyszukiwanie chętnie podaje je razem.
Model wtedy miesza: przy odmowie wizy krajowej odpowiedział terminem i organem należącymi
do ścieżki wojewódzkiej, choć właściwy temat wygrał ranking z dużą przewagą. Zakaz
napisany w treści pliku („nie nazywać tego odwołaniem do organu wyższego stopnia")
został zignorowany — jak każdy zakaz napisany prozą.

`wyklucza` wyraża to jako dane: kiedy temat wchodzi do promptu, tematy z jego listy są
z tego promptu usuwane. Wykluczenia muszą być **wzajemne** — jeżeli A wyklucza B, to B
musi wykluczać A. Walidator tego pilnuje, bo jednostronne wykluczenie dawałoby wynik
zależny od kolejności rankingu.

Używaj go oszczędnie i tylko dla tematów, które opisują **alternatywne procedury dla
różnych sytuacji**. Tematy, które się uzupełniają, mają iść razem.
