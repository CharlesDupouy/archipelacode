<!-- @format -->

# ArchipelaCode (Chrome Extension & Archipelago World)

ArchipelaCode connects **LeetCode** with the **Archipelago Multiworld Randomizer**. Solve LeetCode problems directly on [leetcode.com](https://leetcode.com) while unlocking programming language syntax, control structures, and libraries through Archipelago checks!

---

## Why a Chrome Extension?

The original VS Code extension suffered from Cloudflare bot challenges (HTTP 403 Forbidden) and brittle regex parsing. Moving ArchipelaCode into a native Chrome Extension (Manifest V3) runs directly inside your authenticated browser session on `leetcode.com`:

- **Zero Cloudflare Blocks**: Submissions and test runs use native browser cookies, TLS fingerprints, and session tokens.
- **Native Side Panel**: Problem explorer, item inventory, filter controls, and live Archipelago chat inside Chrome (`chrome.sidePanel`).
- **In-Page Pre-Submission Interception**: Wraps LeetCode's submission pipeline directly in the browser page to validate your code before it reaches LeetCode, preventing accidental submissions with locked features.
- **AST-Level Tokenizer**: Lexical token parsing for Python 3 that accurately distinguishes operators, keywords, identifiers, string literals, comments, and function signatures.
- **Optional Archipelago Traps & DeathLink**: Configurable DeathLink and Trap items supported directly in the APWorld and extension.

---

## Installation

### 1. Archipelago APWorld Setup

1. Build the `.apworld` bundle:
   ```bash
   npm run build:apworld
   ```
2. Copy `dist/archipelacode.apworld` into your Archipelago installation's `custom_worlds/` or `lib/worlds/` directory.
3. Configure your YAML (e.g. `DeathLink`, `EnableTraps`, `Difficulty`) and generate your multiworld game.

### 2. Chrome Extension Setup

1. Build the extension:
   ```bash
   yarn install
   npm run compile
   ```
2. Open Google Chrome (or any Chromium browser) and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` directory in this repository.
5. (Optional) Alternatively, build the distribution zip using `npm run package:extension` and extract `archipelacode-chrome-extension.zip`.

---

## How to Play

1. Navigate to [leetcode.com/problems](https://leetcode.com/problems).
2. Click the ArchipelaCode extension icon in Chrome toolbar to open the **ArchipelaCode Side Panel**.
3. Enter your Archipelago connection details:
   - **Host**: e.g., `archipelago.gg` or `localhost`
   - **Port**: e.g., `38281`
   - **Slot Name**: Your player slot name
   - **Password**: Room password (if set)
4. Click **Connect**. Once connected:
   - Your assigned problems appear in the **Problems** tab with Easy/Medium/Hard tags.
   - Click any problem to navigate immediately to its LeetCode page.
   - A floating status badge will appear directly on the problem page.
   - When you click LeetCode's native **Submit** button, ArchipelaCode checks your code against your unlocked features. If unauthorized features are detected, submission is blocked with an informative message.
   - When accepted, ArchipelaCode automatically dispatches the location check to the Archipelago server!

---

## Development & Build Commands

- `npm run compile` - Compiles the Chrome extension bundles via Webpack into `dist/`.
- `npm run watch` - Watches source files and recompiles automatically.
- `npm run test` - Runs Python lexer unit tests.
- `npm run lint` - Runs ESLint across all source files.
- `npm run prettier:fix` - Auto-formats source files according to Prettier standards.
- `npm run build:apworld` - Packages `apworld/archipelacode/` into `dist/archipelacode.apworld`.
- `npm run package:extension` - Compiles and packages `archipelacode-chrome-extension.zip`.
- `npm run package:all` - Runs both `build:apworld` and `package:extension`.

---

## License & Credits

- Built upon the original ArchipelaCode concept by [ShackledMars261](https://github.com/ShackledMars261/archipelacode).
- LeetCode is a registered trademark of LeetCode, LLC.
- Archipelago Multiworld is created and maintained by the [Archipelago Multiworld team](https://archipelago.gg).
