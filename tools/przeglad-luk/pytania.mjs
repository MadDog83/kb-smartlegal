// Realne pytania w zakresie legalizacji, pogrupowane tematycznie.
// "oczekiwany" to temat w bazie, który POWINIEN odpowiadać — albo null, gdy
// podejrzewam, że takiego tematu nie ma. Wynik pokaże, czy mam rację.
export const PYTANIA = [
  // --- praca
  ["praca", "Jak dostac zezwolenie na prace typu A?", "praca-zezwolenie"],
  ["praca", "Co to jest oswiadczenie o powierzeniu pracy cudzoziemcowi?", "praca-oswiadczenie"],
  ["praca", "Czy moge pracowac w Polsce na wizie turystycznej?", "praca-zezwolenie"],
  ["praca", "Чи можу я працювати в Польщі на візі?", "praca-zezwolenie"],
  ["praca", "Stracilem prace, a mam karte pobytu na prace. Ile mam czasu na nowa?", "utrata-pracy"],
  ["praca", "Втратив роботу, а в мене карта побуту через роботу. Що робити?", "utrata-pracy"],
  ["praca", "Czy moge pracowac zdalnie dla firmy z zagranicy mieszkajac w Polsce?", null],
  ["praca", "Czy pracodawca musi zglosic ze zatrudnia Ukrainca?", "praca-powiadomienie"],
  // --- rodzina
  ["rodzina", "Jak sprowadzic zone i dzieci do Polski?", "pobyt-czasowy-rodzina"],
  ["rodzina", "Moje dziecko urodzilo sie w Polsce. Jaki dokument pobytowy musi dostac?", null],
  ["rodzina", "Wzielismy rozwod. Czy trace karte pobytu z malzenstwa?", null],
  ["rodzina", "Моя дитина народилася в Польщі. Який дозвіл на перебування їй потрібен?", null],
  // --- studia
  ["studia", "Czy student moze pracowac w Polsce?", "pobyt-czasowy-studia"],
  ["studia", "Skonczylem studia w Polsce. Czy moge zostac i szukac pracy?", null],
  ["studia", "Чи може студент працювати в Польщі без дозволу?", "pobyt-czasowy-studia"],
  // --- biznes
  ["biznes", "Jak dostac karte pobytu na prowadzenie dzialalnosci gospodarczej?", "pozostale-kategorie"],
  ["biznes", "Czy moge zalozyc firme w Polsce jako obywatel Ukrainy?", null],
  // --- dokumenty i formalnosci
  ["dokumenty", "Czy musze miec ubezpieczenie zdrowotne zeby dostac karte pobytu?", null],
  ["dokumenty", "Jak sie zameldowac w Polsce?", null],
  ["dokumenty", "Як отримати PESEL, якщо я не українець?", null],
  ["dokumenty", "Czy dokumenty do wniosku musza byc przetlumaczone przez tlumacza przysieglego?", null],
  ["dokumenty", "Paszport mi wygasa, a karta pobytu jest wazna. Co robic?", null],
  ["dokumenty", "Jakie zdjecie do karty pobytu?", null],
  // --- procedura
  ["procedura", "Jak sprawdzic status mojej sprawy o karte pobytu?", "mos-inpol"],
  ["procedura", "Dostalem wezwanie do uzupelnienia brakow. Co to znaczy?", null],
  ["procedura", "Zmienilem adres. Czy musze zawiadomic urzad?", null],
  ["procedura", "Czy moge przedluzyc wize bez wyjazdu z Polski?", null],
  ["procedura", "Ile dni moge byc w Polsce bez wizy?", null],
  ["procedura", "Czy z karta pobytu moge podrozowac do innych krajow Unii?", "dokumenty-i-karta"],
  ["procedura", "Чи можу я з картою побуту їздити в інші країни ЄС?", "dokumenty-i-karta"],
  ["procedura", "Czy moge zlozyc wniosek przez pelnomocnika?", null],
  ["procedura", "Kiedy trzeba zlozyc wniosek o kolejna karte, zeby nie stracic legalnosci?", "pobyt-czasowy-termin-i-legalnosc"],
  // --- pobyt staly / rezydent
  ["staly", "Czy z Karta Polaka dostane pobyt staly?", "pobyt-staly-podstawy"],
  ["staly", "Ile moge byc za granica majac status rezydenta UE?", "rezydent-ue-warunki"],
  // --- obywatelstwo
  ["obywatelstwo", "Jaki certyfikat jezyka polskiego potrzebuje do obywatelstwa?", "jezyk-polski-obywatelstwo"],
  ["obywatelstwo", "Яке підтвердження знання польської мови потрібне для громадянства?", "jezyk-polski-obywatelstwo"],
  // --- UKR
  ["ukr", "Czy Ukrainiec z ochrona czasowa moze wyjechac na Ukraine i wrocic?", "ukr-ochrona-czasowa"],
  ["ukr", "Моїй дитині потрібен PESEL UKR. Як оформити?", "pesel-ukr"],
];
