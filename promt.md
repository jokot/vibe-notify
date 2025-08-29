# Build a cross‑IDE VS Code extension: **VibeNotify**

You are an AI coding IDE (Trae). Generate a complete, production‑ready VS Code extension named **VibeNotify** that works in VS Code, Cursor, and Trae.

## Goals & Features (must all be implemented)

1. **Notify when AI chat is done**

   * Heuristic idle detector for any “chat-like” editor (Copilot Chat, Cursor/Trae chat panes, generic chat docs).
   * Detect continuous text changes; when the document becomes idle for `silenceMs` (default 1500 ms), fire a notification.

2. **Notify when a terminal run is likely needed**

   * After a chat finishes, scan the newly produced text for shell code blocks (` ```bash|sh|zsh|powershell|pwsh|cmd `) or fenced code preceded by words like “run”, “execute”, “command”.
   * If found, show an actionable notification offering **Run in Terminal**. Selecting it executes the extracted commands.

3. **Open IDE/from notification & focus the right tab**

   * Clicking the notification must focus the IDE (if already running) and reveal the chat/editor that triggered it (`window.showTextDocument`).
   * Provide a **Show Chat** action that focuses the source document.

4. **Execute terminal from notification**

   * Implement a `TerminalRunner` that creates or reuses a named terminal ("VibeNotify") and sends commands with `sendText(..., true)`.
   * Also support VS Code **Tasks** for better exit-code tracking; expose a command to run the last extracted script via a `ShellExecution`‑backed Task and listen for `onDidEndTaskProcess` to re‑notify success/failure.

5. **Cross‑platform (Windows & macOS)**

   * Use only **stable** VS Code APIs; avoid proposed APIs.
   * Ensure commands run in the user’s default shell. For Windows, handle `powershell`/`cmd` line endings; for Unix shells, assume `bash`/`zsh`.
   * No native modules.

## Non‑Goals / Caveats (document clearly in README)

* Cannot "launch" the IDE from a terminated state. Extension actions run only while the app is open.
* We do **not** parse arbitrary terminal output; we rely on Tasks events and our own executed commands.

---

## Project Structure (generate **all** files with content)

```
.vscodeignore
CHANGELOG.md
README.md
package.json
tsconfig.json
src/extension.ts
src/config.ts
src/notifier.ts
src/detection/chatIdleDetector.ts
src/parse/extractCommands.ts
src/terminal/terminalRunner.ts
src/terminal/taskRunner.ts
media/icon.png (placeholder SVG/PNG)
media/sounds/notify.mp3 (small placeholder tone; optional in settings)
```

### `package.json` (requirements)

* `name`: `vibenotify`
* `displayName`: `VibeNotify – AI Reply & Terminal Notifier`
* `publisher`: `yourid`
* `engines.vscode`: `^1.86.0` or newer
* Activation events: `onStartupFinished`, the contributed commands, and `*` file watchers (`workspaceContains:*` not needed).
* **Contributes → commands**:

  * `vibenotify.toggle`
  * `vibenotify.testNotification`
  * `vibenotify.runLastExtractedInTerminal`
  * `vibenotify.showSource`
* **Contributes → configuration** (`vibenotify.*`):

  * `enabled` (bool, default `true`).
  * `silenceMs` (number, default `1500`).
  * `chatMatchers` (array of objects): each `{ languageIdRegex: string, schemeRegex: string, titleRegex: string }`. Provide defaults that cover common chat buffers: `copilot-chat`, `chat`, `markdown` with “Chat” in title, etc.
  * `notifyWithSound` (bool, default `false`).
  * `soundFile` (string path, default `"media/sounds/notify.mp3"`).
  * `showStatusBar` (bool, default `true`).
  * `terminalName` (string, default `"VibeNotify"`).
  * `useTasks` (bool, default `true`) – when true, prefer tasks for execution.

### `src/config.ts`

* Helper to read/update configuration and expose typed getters.

### `src/notifier.ts`

* Wrapper around `window.showInformationMessage` that:

  * Accepts message + actions: `Show Chat`, `Run in Terminal`.
  * Focuses the IDE window and routes to handlers.
  * Optionally plays a short sound (if `notifyWithSound=true`) using an `Audio` object via a hidden webview‑panel or by spawning OS sound using `process.platform` safe methods (if feasible without native deps). If complex, keep sound off by default and document the caveat.

### `src/detection/chatIdleDetector.ts`

* Class that registers `workspace.onDidChangeTextDocument`.
* Maintains a `Map<string, { timeout: NodeJS.Timeout; lastLength: number; lastVersion: number; source: TextDocument; }>`.
* If a changed document matches any `chatMatchers`, debounce by `silenceMs`. On timeout, fire an event `{ document, reason: 'idle' }`.

### `src/parse/extractCommands.ts`

* Export a function that takes the **diff text** (recently added text) or entire document and returns:
  `{ commands: string[], languageHint: 'bash'|'sh'|'zsh'|'powershell'|'cmd'|null }`.
* Parse fenced code blocks with regex:

  * `/`(\[a-zA-Z]*)\n(\[\s\S]*?)`/g`
* Filter only shells listed above. Trim prompts like `$ `, `PS> `.

### `src/terminal/terminalRunner.ts`

* Create or reuse a named terminal via `window.createTerminal`.
* `run(commands: string[])` sends each line with `sendText(cmd, true)`.
* Expose `lastExtracted` buffer in `Memento` global state.

### `src/terminal/taskRunner.ts`

* Build a `Task` with `ShellExecution` joining commands by `\n`.
* Listen on `tasks.onDidEndTaskProcess` and re‑notify on success/failure.

### `src/extension.ts`

* `activate(ctx)` wires everything:

  * Instantiate `Config`, `Notifier`, `ChatIdleDetector`.
  * On idle, call `extractCommands()` on recent text; if commands found → notification with actions: **Show Chat** (reveals `document`) and **Run in Terminal** (stores commands and executes via `taskRunner` or `terminalRunner`). Otherwise show a simple “AI reply finished” notification with **Show Chat**.
  * Register commands:

    * `vibenotify.toggle`: flips `enabled` and updates listeners.
    * `vibenotify.testNotification`: shows a sample notification from the active editor.
    * `vibenotify.showSource`: focuses last source document.
    * `vibenotify.runLastExtractedInTerminal`: executes stored commands again.
  * Optional status bar item that turns to `$(check) AI ✓` when a finish event happens; clicking opens the last source.
* `deactivate()` disposes listeners.

### `README.md` (include the following sections)

* What it does; quick demo GIF placeholders.
* Why heuristic is used (works across Copilot/Cursor/Trae).
* Settings reference table.
* Security note: we only run commands you explicitly click to run.
* Known limitations and how to broaden `chatMatchers`.

### `CHANGELOG.md`

* `0.0.1` initial release.

### `tsconfig.json`

* Standard strict TS targeting `ES2020` with module `commonjs`.

### `.vscodeignore`

* Exclude dev artifacts, `**/*.map`, screenshots, node\_modules that aren’t needed, etc.

---

## Implementation Notes & Must‑Haves

* **Stable APIs only:** `workspace.onDidChangeTextDocument`, `window.showInformationMessage`, `window.showTextDocument`, `window.createTerminal`, `commands.executeCommand`, `tasks.onDidStartTask`, `tasks.onDidEndTaskProcess`.
* **No proposed APIs** (e.g., `onDidWriteTerminalData`).
* **Configurable Matchers** default set (examples):

```json
{
  "vibenotify.chatMatchers": [
    { "languageIdRegex": "^(copilot-chat|chat)$", "schemeRegex": ".*", "titleRegex": ".*" },
    { "languageIdRegex": "^markdown$", "schemeRegex": ".*", "titleRegex": "(?i)(chat|assistant|reply)" }
  ]
}
```

* **Debounce logic:** reset timer on any change; only fire after no changes for `silenceMs`.
* **Command extraction:** prefer most recent fenced block; if multiple, present a QuickPick allowing the user to choose (include language label). Running without confirmation must be opt‑in via setting.
* **Cross‑IDE:** avoid marketplace‑only APIs; support `.vsix` sideload. Keep Node version compatibility broad.

---

## Deliverables

1. A complete project folder with the files and code above.
2. Build instructions: `npm i && npm run compile && npx vsce package`
3. Installation guidance for VS Code, Cursor, and Trae (Install from VSIX).
4. A short QA checklist in README.

---

## QA Checklist (automate where possible)

* [ ] Idle detection triggers after AI stops typing for \~1.5s.
* [ ] Notification includes **Show Chat** and (when applicable) **Run in Terminal**.
* [ ] **Show Chat** focuses the correct editor tab.
* [ ] **Run in Terminal** executes the extracted code in a single terminal named by `vibenotify.terminalName`.
* [ ] If `useTasks=true`, success/failure is re‑notified with exit code.
* [ ] Works on Windows 11 (PowerShell) and macOS (zsh).
* [ ] Settings changes apply without reload.
* [ ] No proposed API usage; extension loads in Cursor and Trae.

---

## Bonus (nice‑to‑have if quick)

* Status bar pulse animation while chat is generating; solid check when done.
* Telemetry‑free; no external network calls.
* Setting: `autoRevealOnFinish` to auto‑focus the chat tab on completion.

> Produce all files with code now. Ensure the project compiles with `npm run compile` and packages with `vsce package`. Provide the final file tree and key code listings inline in your response.
