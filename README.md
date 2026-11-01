# Opening Roast

Live report app: https://opening-roast.onrender.com/

Real Chess.com scouting reports for the existing Spline café. Defaults: opponent **FrancisBiz**, you **BlebJeb**.

## Run

Node 22+ (tested on Node 24):

```sh
npm ci --ignore-scripts
npm run build
npm test
npm start
```

Open http://localhost:4173. `dist/index.html` is the standalone report app. It has the full diagnostic UI with a simple analysis form; it does not include the original 3D café scene. `dist/spline-overlay.html` is the live-data overlay for the existing Spline scene and retains its animated coffee machine, cat, globe, book and custom chessboard controls. It needs Spline's injected bridge and cannot run alone.

The current Spline editor can run the overlay immediately. Publishing that scene later preserves the same HTML in Spline runtime exports. For a self-hosted full café, obtain the scene's published runtime URL and embed it; no scene URL was fabricated in this package. The standalone Render deployment remains useful without that export.

## Hosting and budget

Use a **Render Static Site**, with the repository root as root directory:

- Build: `npm ci --ignore-scripts && npm run build`
- Publish directory: `dist`
- No environment variables, API keys, paid worker, paid database or AI subscription.
- `render.yaml` supplies the static-site configuration, with automatic deployments off.

No paid service is required. Stockfish runs on each visitor's device. Render's free included usage is the intended $0 hosting configuration, but this is not an account-wide billing cap: check the account's bandwidth/build usage and spending controls before public launch. Do not add paid instances to this plan. A large viral audience could exceed included hosting allowances.

Repository: `vasilipuck/opening-roast` (private). The project can be deployed through the connected Render account using the static settings above. The connector initially had no repository installation; the repository was created and files uploaded through GitHub's website. The Render GitHub connection must have access to this repository before deployment. Never upload account tokens into the repository or this chat.

## Real-data behavior

- Serial public Chess.com API requests: profile, ratings, monthly archives (newest first).
- Latest N completed standard games with readable legal PGN; variants excluded. Missing or unreadable games are disclosed and skipped. No backfill after time-mode filtering.
- Automatic time-mode selection includes modes representing at least 10% of the actual imported sample; manual rapid/blitz/bullet/daily override is available.
- Opponent games receive full engine analysis of every position, including the final position. Optional own-player games are imported for opening repertoire comparison, not full engine analysis.
- Single-thread Stockfish **19.0.1 lite**, Hash 16 MB, **12,000 nodes per position**. Finite search is approximate; tactical lines and labels can change with deeper analysis. No cloud GPU or paid analysis server.
- Accuracy is the mean of `100 * exp(-6 * loss)` for the player's moves. `loss = max(0, expected_before - expected_after)` in mover perspective. `expected(cp) = 1 / (1 + 10^(-cp / 400))`. It is not Chess.com's proprietary accuracy.
- Labels: loss >= .18 Blunder, >= .08 Mistake, >= .04 Inaccuracy; otherwise matched database prefix Book, engine-first-choice Best, <.005 Excellent, <.015 Good, else Okay. Great/Brilliant are not assigned.
- Elo expectation compares each player's game-time rating to their actual opponent's rating; draws score 0.5. Results show average actual-minus-expected in percentage points.
- Opening names use the longest exact move prefix in the Lichess opening database. Book depth is a database overlap estimate, never proof of memorization. Transpositions outside the prefix are not merged.
- Phase measurements and critical errors come from actual analyzed moves. Recurring recommendations require repeated identical positions; otherwise examples are clearly labeled single-game evidence.
- Full legal board replay, move list, White-positive evaluations, key moments, legal engine alternative from the selected position, result/opening/date/accuracy filters, avatar and JSON report download.

## Persistence, freshness and limits

Keep the page open while analyzing. 100 games may take several minutes or longer on a slow phone. Completed games are cached in IndexedDB by PGN SHA-256 plus engine/search/scoring version. A canceled game's partial analysis is discarded; completed games resume from cache on the next brew. Private/incognito modes and Spline's opaque sandbox may deny storage; the app still works and flags unavailable caching. No accounts, cross-device history, automatic background refresh or payment system are implemented.

A new brew imports public data again and shows retrieval time. Chess.com's API can cache responses; this is recent public data rather than a live feed of a game in progress. 404, rate limits, server failures, malformed PGN, missing history, canceled requests and engine failures have visible error paths. A missing own profile does not discard an otherwise valid opponent report.

## Validation

`npm test` covers legal PGN replay, checkmate, selection denominator, unknown results, Elo expectation, score perspective, classifications, serial import, actual Stockfish forced and terminal mate, full-game analysis and cached replay. A DOM integration test exercises form → brewing → report → filters → board → engine alternative → home. A mocked data pipeline is used only for that UI test.

The build was additionally checked against 100 real games for each supplied username and one full real game analyzed per account. `tests/FrancisBiz.json`, `tests/BlebJeb.json` and `tests/live-results.json` are local optional verification snapshots and are excluded from Git. They are not demo fallbacks. Without snapshots, the test still runs real Stockfish mate checks; fetch current public games for optional live-account validation.

The standalone Render app passed a real browser run: 20 FrancisBiz games imported, 19 mode-qualified games fully analyzed (980 positions), with BlebJeb comparison, profile photo, full checkmate replay, legal engine alternatives, accuracy sorting and JSON download. Hosted engine assets were verified byte-for-byte with the local build. Render showed a Hobby workspace, no card on file, $0 current/projected charges and a $0 monthly build spend limit. The Spline iframe network/worker behavior and published café still need an independent Play-mode check; this deployment serves the report app, while the café remains in the Spline project.

## Third-party notices

Stockfish.js: GPLv3, https://github.com/nmrugg/stockfish.js/tree/v19.0.1 . Its unmodified lite single-thread JavaScript and WASM binaries are in `public/engine`; license is `public/engine/COPYING`; the corresponding exact release source archive is served alongside them as `stockfish-19.0.1-source.tar.gz`, including build instructions. Neural network reference: https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d . Browser-only Spline mode downloads the same pinned release from jsDelivr; the hosted standalone uses local copies.

chess.js 1.4.0: BSD-2-Clause, https://github.com/jhlywa/chess.js/tree/v1.4.0 . Vendored ESM with license at `public/chess.js-LICENSE`.

Opening data: https://github.com/lichess-org/chess-openings, CC0. Snapshot fetched 2026-11-01, with license at `public/openings-COPYING`.

Public player data and avatars come from Chess.com. This app is not affiliated with Chess.com or Lichess.
