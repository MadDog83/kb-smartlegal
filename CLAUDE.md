# Working rules

This repo is the only source of legal content for the Smart Legalization Support assistant
(app repo: `MadDog83/polish-pathfinders`). The app reads `index/kb-index.json` from `main`
via raw.githubusercontent.com and caches it for 6 h: a merge to `main` reaches production
users within hours, with no app deploy. Treat every merge as a production release.

## Git
- `main` is protected: changes go through a pull request, and the `testy` workflow must pass.
- Never put legal content into the app repo, and never copy it there. One source of truth.

## Before every commit
- Run `node tools/validate.mjs`, then `node tools/build-index.mjs`, then
  `node tools/test-retrieval.mjs`. All must exit 0.
- `index/kb-index.json` is generated: never edit it by hand, and always commit it rebuilt
  together with the `tresc/` change (`tools/check-index.mjs` fails otherwise).
- A new or reworded topic needs retrieval cases in `tools/retrieval-cases.json` in
  uk, pl and en. Every case must hit; do not weaken or delete a case to make it pass.

## Content rules (details and reasons in `SCHEMA.md`)
- One file = one topic. Over ~2500 characters means two topics: split it.
- Write content in Polish, answer first, legal basis second. `slowa` must cover uk, pl and en.
- Never invent a fact, fee, deadline, authority or article number. If the sources do not
  say it, write that explicitly in the content: it stops the model from guessing.
- Every article number used in the text must be listed in `artykuly` (or in
  `artykuly_zakazane` when the text names it only to forbid it), with `ustawa` set.
  Never write an article number without the act's name in the same sentence.
- `artykuly: []` is deliberate data ("no article applies"); do not fill it in to look complete.
- Any amount needs `zrodlo` (official URL) and a current `zweryfikowano`. Re-check the
  source before updating `zweryfikowano`; never bump the date without checking.
- `ryzyko: wysokie` (legality of stay at stake) must refer the user to legal help.
- `wyklucza` only for alternative procedures (e.g. the three appeal routes), and always
  mutual: if A excludes B, B excludes A.
- Never change an existing `id`: retrieval cases and the app's selection depend on it.

## Changes that touch the app
- `tools/retrieve.mjs` mirrors topic selection in the app's `src/lib/chat-kb.server.ts`
  (`PROG_*`, `WAGA_*`, `MAX_TEMATOW`, stop words). Change both in step.
- The app schema-checks each index entry (`WpisSchema` in `src/lib/chat-kb.server.ts`).
  Renaming, removing or retyping a field the app reads requires the matching app change
  first, or those entries are dropped in production. New fields are ignored until the app
  reads them.
- `README.md` "Stan" figures and its setup section are historical; trust the tools' output.
