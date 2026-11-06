# Change Log

All notable changes to the "archipelacode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.3] - 2026-11-06

### Added
- Monorepo integration of Archipelago World generator (`apworld/`) with `npm run build:apworld` script.
- Real-time in-editor diagnostics provider (`src/diagnostics.ts`) that underlines locked language features with squiggly lines as you type.
- Tree View Difficulty Filter command (`archipelacode.setDifficultyFilter`) and view title bar action with Easy/Medium/Hard filtering and counts.
- Archipelago DeathLink integration: opt-in via room options or extension settings, sending deaths on failed LeetCode submissions and receiving deaths in VS Code.
- Archipelago Trap items support (Syntax Error Trap, Runtime Error Trap, Time Limit Exceeded Trap).
- Automatic WebSocket reconnection logic on connection drops.
- `npm run package:vsix` script for clean `.vsix` packaging.

### Changed
- Migrated code submission to a Cloudflare-safe browser-assisted submission flow with GraphQL polling (`recentSubmissions` and `submissionDetails`).
- Automatically copies solution to the clipboard upon clicking submit.
- Authoritatively verifies the code actually judged by LeetCode against unlocked Archipelago items before sending checks.
- Lowered minimum VS Code engine requirement from `^1.103.0` to `^1.85.0` to fix installation issues on earlier VS Code versions.

### Fixed
- Replaced fragile regex verification with a zero-dependency lexical tokenizer for Python (`src/languages/pythonLexer.ts`):
  - Fixed bitshift operators (`>>`, `<<`) falsely triggering comparison operators (`>`, `<`).
  - Fixed comments, docstrings, and strings falsely triggering keyword and operator checks.
  - Fixed variable identifiers (e.g. `is_valid`, `for_loop`) falsely matching keywords.
  - Fixed `match` / `case` statement detection.
  - Fixed starter code method signature default parameters (`val: int = 0`) falsely requiring the assignment operator.
- Fixed `fill_slot_data` and `LanguageChoice` option in the APWorld to prevent `AttributeError` and empty problem selectors.

## [0.0.2] - 2026-01-05
- Windows path fix.

## [0.0.1] - 2026-01-01
- Initial release.
