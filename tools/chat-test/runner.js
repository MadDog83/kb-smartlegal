/*
 * Zestaw testowy bota Smart Legalization Support — runner przeglądarkowy.
 *
 * Uruchamiany w konsoli na https://smart-legalization.lovable.app/ przy OTWARTYM oknie czatu.
 * Steruje prawdziwym interfejsem, więc mierzy dokładnie to, co widzi użytkownik —
 * razem z komunikatem awaryjnym, gdy backend zawiedzie.
 *
 *   1. wklej zawartość przypadki.json jako:   window.__KB_CASES = [ ... ]
 *   2. wklej ten plik
 *   3. postęp:   __kbStatus()
 *   4. wynik:    __kbReport()      (tabela)   /   JSON.stringify(__kb.results)
 *
 * ZOSTAW KARTĘ NA WIERZCHU. Chrome zamraża karty w tle i timery przestają się budzić —
 * pętla staje w losowym miejscu. __kbStatus() pokazuje, ile sekund minęło od ostatniego
 * oznaku życia; powyżej minuty oznacza zamrożenie, nie wolną odpowiedź.
 */
(() => {
  const CASES = window.__KB_CASES || [];
  const TIMEOUT_MS = 60000; // ile czekamy na odpowiedź, zanim uznamy turę za martwą
  // Odstęp jest duży celowo. Model z wyszukiwarką ma dobowy limit i 60-sekundowy
  // cooldown po odmowie — puszczone seriami pytania wpadają w komunikat awaryjny
  // po ułamku sekundy i cały pomiar mierzy wtedy limit, a nie jakość odpowiedzi.
  const GAP_MS = 25000;
  const RETRY_WAIT_MS = 60000; // jedno ponowienie po awarii, gdy cooldown zdąży wygasnąć

  const dlg = () => document.querySelector('[role="dialog"]');
  const scroller = () => dlg() && dlg().querySelector(".overflow-y-auto");
  // Wskaźnik „pisze…" jest zwykłym dzieckiem listy, więc trzeba go odfiltrować —
  // inaczej runner uzna go za odpowiedź i zapisze pusty tekst.
  const bubbles = () =>
    (scroller() ? Array.from(scroller().children) : []).filter(
      (b) => b.getAttribute("aria-live") !== "polite",
    );
  const isUser = (b) => (b.className || "").indexOf("justify-end") >= 0;
  const buttonWith = (needle) =>
    Array.from((dlg() || document).querySelectorAll("button")).find(
      (b) => (b.innerText || "").indexOf(needle) >= 0,
    );

  // Input jest sterowany przez Reacta — zwykłe input.value nie wywoła onChange.
  const setInput = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function ensureChatOpen() {
    if (dlg() && dlg().querySelector("input")) return true;
    const opener =
      buttonWith("Відкрити чат") || buttonWith("Otwórz czat") || buttonWith("Open chat");
    if (opener) {
      opener.click();
      await sleep(1500);
    }
    const back = buttonWith("Повернутися") || buttonWith("Wróć") || buttonWith("Back");
    if (back && !(dlg() && dlg().querySelector("input"))) {
      back.click();
      await sleep(800);
    }
    return !!(dlg() && dlg().querySelector("input"));
  }

  async function resetChat() {
    const end =
      buttonWith("Завершити чат") || buttonWith("Zakończ czat") || buttonWith("End chat");
    if (end) {
      end.click();
      await sleep(500);
      const yes = buttonWith("Так") || buttonWith("Tak") || buttonWith("Yes");
      if (yes) {
        yes.click();
        await sleep(900);
      }
    }
    return ensureChatOpen();
  }

  // Liczenie dymków jest zawodne, bo reset czatu przestawia licznik asynchronicznie.
  // Szukamy dymka użytkownika z naszym pytaniem i bierzemy pierwszy dymek bota po nim.
  function answerAfter(question) {
    const b = bubbles();
    const i = b.findIndex((x) => isUser(x) && (x.innerText || "").trim() === question.trim());
    if (i < 0) return "";
    const next = b[i + 1];
    if (!next || isUser(next)) return "";
    return (next.innerText || "").trim();
  }

  async function ask(question) {
    // Reset czatu przemontowuje okno, więc pole tekstowe bywa nieobecne przez chwilę po
    // zamknięciu rozmowy. Bez tego czekania runner zapisywał pustą odpowiedź i „brak pola",
    // co wyglądało jak awaria bota, a było wyścigiem w narzędziu.
    let input = dlg() && dlg().querySelector("input");
    for (let i = 0; i < 6 && !input; i++) {
      await sleep(1000);
      await ensureChatOpen();
      input = dlg() && dlg().querySelector("input");
    }
    if (!input) return { answer: "", error: "brak pola tekstowego" };
    setInput(input, question);
    await sleep(200);
    const form = input.closest("form");
    if (form) form.requestSubmit();
    else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    const started = Date.now();
    while (Date.now() - started < TIMEOUT_MS) {
      await sleep(800);
      window.__kb.beat = Date.now();
      const a = answerAfter(question);
      if (a.length > 0) {
        await sleep(1000); // markdown dorenderowuje się chwilę
        return { answer: answerAfter(question), ms: Date.now() - started };
      }
    }
    return { answer: answerAfter(question), ms: Date.now() - started, error: "przekroczony czas" };
  }

  // Strona renderuje liczby ze spacją nierozdzielającą ("3<NBSP>lata", "440<NBSP>zł"),
  // więc bez normalizacji wzorce typu "3 lat" czy "60 dni" nigdy nie trafiają.
  const norm = (s) =>
    (s || "")
      .replace(/[   ]/g, " ")
      .replace(/[‑–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  // Detektor języka. Uwaga: sama obecność polskich znaków diakrytycznych NIE wystarcza —
  // poprawna angielska odpowiedź cytuje "Komendant Główny Straży Granicznej" i byłaby
  // fałszywie uznana za polską. Liczymy słowa funkcyjne obu języków.
  function detectLang(t) {
    if (/[Ѐ-ӿ]/.test(t)) return "uk";
    const pl = (t.match(/\b(jest|nie|oraz|lub|wniosek|wniosku|zezwolenie|pobyt|pobytu|urząd|urzędu|możesz|należy|jeśli|dni|lat|lata|przez|dla)\b/gi) || []).length;
    const en = (t.match(/\b(the|you|your|and|for|with|must|can|is|are|within|days|years|apply|residence)\b/gi) || []).length;
    return en > pl ? "en" : "pl";
  }

  const FALLBACKS = [
    "Не знайшов точної відповіді",
    "Nie znalazłem dokładnej odpowiedzi",
    "надто багато запитів",
    "Zbyt wiele zapytań",
    "Too many requests",
  ];
  const isFallback = (t) => FALLBACKS.some((f) => t.indexOf(f) >= 0);

  // Zakazana fraza w zdaniu przeczącym to nie błąd, tylko dokładnie ta odpowiedź, o którą
  // nam chodziło: „NIE należy wysyłać wniosku do Urzędu do Spraw Cudzoziemców" trafiało
  // we wzorzec zakazujący UDSC. Ta pułapka zaniżyła wynik już dwa razy, więc sprawdzacz
  // patrzy teraz na kilkadziesiąt znaków przed trafieniem i odpuszcza, gdy stoi tam
  // przeczenie.
  const PRZECZENIE = /\b(nie|nigdy|zamiast|не|ніколи|замість|not|never|instead)\b[^.]{0,40}$/i;
  const zanegowane = (answer, index) => PRZECZENIE.test(answer.slice(Math.max(0, index - 60), index));

  function check(c, rawAnswer) {
    const answer = norm(rawAnswer);
    const fails = [];
    const hay = answer.toLowerCase();
    for (const m of c.must || []) {
      if (!new RegExp(m, "i").test(answer)) fails.push("brak: " + m);
    }
    for (const m of c.mustNot || []) {
      const hit = answer.match(new RegExp(m, "i"));
      if (hit && !zanegowane(answer, hit.index)) fails.push("zakazane: " + m);
    }
    if (c.order && c.order.length === 2) {
      const a = hay.indexOf(c.order[0].toLowerCase());
      const b = hay.indexOf(c.order[1].toLowerCase());
      if (a < 0 || b < 0 || a > b)
        fails.push("kolejność: " + c.order[0] + " przed " + c.order[1]);
    }
    const lang = detectLang(answer);
    if (c.lang && lang !== c.lang) fails.push("język: " + lang + " zamiast " + c.lang);
    return { fails, lang };
  }

  window.__kb = {
    results: [],
    idx: 0,
    total: CASES.length,
    running: true,
    beat: Date.now(),
    retries: 0,
    startedAt: Date.now(),
  };

  window.__kbStatus = () => {
    const cisza = Math.round((Date.now() - window.__kb.beat) / 1000);
    return (
      `${window.__kb.idx}/${window.__kb.total}` +
      (window.__kb.running ? " — w toku" : " — zakończone") +
      `, zaliczone: ${window.__kb.results.filter((r) => r.pass).length}` +
      `, ponowienia: ${window.__kb.retries}` +
      `, od ostatniego oznaku życia: ${cisza}s` +
      (cisza > 70 && window.__kb.running ? "  ⚠ karta prawdopodobnie zamrożona — przełącz na nią" : "")
    );
  };

  window.__kbReport = () => {
    const r = window.__kb.results;
    const pass = r.filter((x) => x.pass).length;
    const fb = r.filter((x) => x.fallback).length;
    console.log(`\nWYNIK: ${pass}/${r.length} zaliczonych | awarie backendu po ponowieniu: ${fb}\n`);
    console.table(
      r.map((x) => ({
        id: x.id,
        jezyk: x.lang,
        ok: x.pass ? "TAK" : "nie",
        ponowione: x.retried ? "tak" : "",
        awaria: x.fallback ? "tak" : "",
        problemy: x.fails.join(" | "),
      })),
    );
    return `${pass}/${r.length}`;
  };

  (async () => {
    await ensureChatOpen();
    for (const c of CASES) {
      window.__kb.idx++;
      window.__kb.beat = Date.now();

      let res;
      let retried = false;
      try {
        res = await ask(c.q);
      } catch (e) {
        res = { answer: "", error: "wyjątek: " + e.message };
      }

      // Komunikat awaryjny to najczęściej limit zapytań, a nie zła odpowiedź. Jedno
      // ponowienie po cooldownie oddziela jedno od drugiego — bez tego przebieg mierzy
      // obciążenie dostawcy i wynik przestaje cokolwiek znaczyć.
      if (isFallback(res.answer || "")) {
        retried = true;
        window.__kb.retries++;
        try { await resetChat(); } catch (e) {}
        await sleep(RETRY_WAIT_MS);
        try {
          res = await ask(c.q);
        } catch (e) {
          res = { answer: "", error: "wyjątek: " + e.message };
        }
      }

      const answer = res.answer || "";
      const fallback = isFallback(answer);
      const { fails, lang } = check(c, answer);
      if (res.error) fails.unshift(res.error);
      if (fallback) fails.unshift("komunikat awaryjny zamiast odpowiedzi");

      window.__kb.results.push({
        id: c.id,
        lang,
        expectedLang: c.lang,
        question: c.q,
        answer,
        fallback,
        retried,
        fails,
        pass: fails.length === 0,
        ms: res.ms,
      });

      try { await resetChat(); } catch (e) {}
      await sleep(GAP_MS);
    }
    window.__kb.running = false;
    console.log("Zestaw testowy zakończony. Wpisz __kbReport()");
  })();

  return "runner wystartował — sprawdzaj __kbStatus()";
})();
