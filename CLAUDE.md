# QuickMemo Project Structure

## Overview
Electron desktop memo app with Win11 acrylic style. Local-first, JSON storage.

## File Map

| File | Lines | Role |
|------|-------|------|
| main.js | 869 | Electron main process: window, IPC, tray, AI pipe, Tokdash |
| preload.js | ~55 | contextBridge: exposes electronAPI to renderer |
| src/index.html | ~560 | Main page DOM structure + settings panels |
| src/renderer.js | 2368 | All UI logic: notes CRUD, sidebar, editor, themes, settings |
| src/styles.css | ~2300 | Win11 acrylic theme system + layout |
| data/notes.json | - | Local persistence: notes, reminders, settings |

## main.js Structure

### Global State
- mainWindow, tray, reminderTimers
- tokdashProcess, TOKDASH_PORT (55423) — Python stats server
- aiServer, AI_PIPE_NAME — Named Pipe for external AI tools

### Data Layer
- ensureDataFile() / readData() / writeData() — JSON file I/O
- DATA_FILE = data/notes.json

### Window Management
- createWindow() — frameless, transparent, rounded corners
- toggleWindow() — global shortcut toggle
- Window events: maximize, unmaximize, close (hide to tray)

### IPC Handlers (33 total)
- Data: load-data, save-data
- Reminders: set-reminder, cancel-reminder  
- Window: minimize, maximize, unmaximize, close, is-maximized
- Theme: get/set-theme, get/set-mode, get/set-appearance
- Settings: get/set-shortcut, get/set-panel-alpha
- Files: save-file, export-markdown-file, open-external
- Tokdash: start-tokdash-server, tokdash-fetch
- AI: call-llm, encrypt-string, decrypt-string
- Note.ms: notems-get, notems-put

### Tokdash Integration
- startTokdash() — spawns Python: py -m tokdash.cli --port 55423
- killTokdashPort() — netstat + process.kill
- stopTokdash() — cleanup on quit
- Auto-start: 1.5s delay after app ready

### AI CLI (Named Pipe)
- Listens on \\.\pipe\QuickMemo_AI
- Commands: list_notes, get_note, create_note, update_note, search_notes
- JSON-line protocol

## renderer.js Structure

### Global State
- state: { notes, reminders, selectedId, multiSelected }
- settings: { theme, appearance, panelAlpha, ... }
- aiSettings: { base_url, api_key, model_name, autoTitle }
- Various UI state variables (calDate, isDark, etc.)

### Key Functions (85 total)

**Init & Setup**
- init() — entry point, loads data, sets up all modules
- setupSettings(), setupTitlebar(), setupEditor()
- setupFileOpen(), setupDragDrop(), setupContextMenu()

**Note CRUD**
- selectNote(), buildNoteItem(), renderSidebar()
- autoTitle() — first-line-as-title sync
- deleteNote(), deleteMultiNotes()

**Editor**
- renderEditor() — loads note into editor
- registerEditorCallbacks() — markdown change handlers
- scheduleSave() — 500ms debounced auto-save

**Settings Panel**
- openSettings() / closeSettings()
- Theme/mode/appearance switching
- Custom CSS, shortcut config

**Calendar & Reminders**
- renderCalendar(), setupCalendar()
- Time wheel picker for reminders

**Usage Stats (Tokdash)**
- showUsage() — auto-detects server status
- renderUsage() — displays token/cost/model charts
- Heatmap grid (CSS Grid full-year)

**Note.ms Cloud Sync**
- openNotemsDialog() — fetch by identifier
- Auto-upload on Ctrl+S for notems notes

## Data Format (notes.json)

```json
{
  "notes": [{ "id", "title", "body", "createdAt", "updatedAt", "notemsKey?", "filePath?", "_autoTitled?" }],
  "reminders": [{ "id", "noteId", "time", "done" }],
  "settings": { "theme", "mode", "appearance", "panelAlpha", "shortcut", "sidebarWidth", "customCSS", "aiSettings?" }
}
```

## Key Conventions
- IPC channels: kebab-case ('get-accent-color')
- Data I/O: readData()/writeData() in main, scheduleSave() in renderer
- Log prefix: [QuickMemo] (unified)
- Theme colors: CSS variables (--accent, --bg, --text-primary, etc.)
- Notes stored as plain array, no indexing
- Deletion has confirmation dialog
- Tokdash Python deps: fastapi, uvicorn (auto-installed via npm postinstall)
