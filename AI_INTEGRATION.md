# QuickMemo AI CLI Integration

QuickMemo exposes a **Named Pipe server** that allows AI tools (Claude Code, PiAgent, Codex, etc.) to read and write notes programmatically.

## Pipe Name

```
\\.\pipe\QuickMemo_AI
```

> **Note:** On Windows, replace `\\.\pipe\` with `\\.\pipe\` literally. In bash/Git Bash, use `//./pipe/QuickMemo_AI`.

---

## Protocol

- **Format**: One JSON command per line, ending with `\n`
- **Response**: One JSON response per line, ending with `\n`
- **Encoding**: UTF-8

---

## Commands

### `list_notes`
Returns all notes (metadata only, no body content).

```json
{"action": "list_notes"}
```

**Response:**
```json
{
  "ok": true,
  "notes": [
    {
      "id": "m5abc123-def456",
      "title": "Meeting Notes",
      "createdAt": "2026-01-15T10:30:00.000Z",
      "updatedAt": "2026-01-15T14:22:00.000Z",
      "hasReminder": true
    }
  ]
}
```

---

### `get_note`
Returns full note content including body.

```json
{"action": "get_note", "noteId": "m5abc123-def456"}
```

**Response:**
```json
{
  "ok": true,
  "note": {
    "id": "m5abc123-def456",
    "title": "Meeting Notes",
    "body": "# Meeting Notes\n\ndiscussed project timeline...",
    "createdAt": "2026-01-15T10:30:00.000Z",
    "updatedAt": "2026-01-15T14:22:00.000Z",
    "notemsKey": null,
    "filePath": null
  }
}
```

---

### `create_note`
Creates a new note.

```json
{"action": "create_note", "noteBody": "# New Note\n\nContent goes here", "noteTitle": "Optional Title"}
```

- `noteBody` — **required**, the markdown content
- `noteTitle` — optional, defaults to first line of body (max 60 chars)

**Response:**
```json
{"ok": true, "note": {"id": "m5xyz789-abc123", "title": "Optional Title"}}
```

---

### `update_note`
Updates an existing note's body and/or title.

```json
{"action": "update_note", "noteId": "m5abc123-def456", "noteBody": "# Updated\n\nNew content", "noteTitle": "New Title"}
```

- `noteId` — **required**
- `noteBody` — **required**, the new markdown content
- `noteTitle` — optional, omit to keep existing title

**Response:**
```json
{"ok": true}
```

---

### `delete_notes`
Deletes one or more notes by ID.

```json
{"action": "delete_notes", "noteIds": ["m5abc123-def456", "m5xyz789-abc123"]}
```

**Response:**
```json
{"ok": true}
```

---

### `search_notes`
Full-text search across note titles and bodies.

```json
{"action": "search_notes", "query": "meeting"}
```

**Response:**
```json
{
  "ok": true,
  "results": [
    {
      "id": "m5abc123-def456",
      "title": "Meeting Notes",
      "snippet": "discussed project timeline and budget..."
    }
  ]
}
```

---

## Usage Examples

### PowerShell

```powershell
# Connect to the pipe
$pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "QuickMemo_AI", [System.IO.Pipes.PipeDirection]::InOut)
$pipe.Connect(5000)
$reader = New-Object System.IO.StreamReader($pipe)
$writer = New-Object System.IO.StreamWriter($pipe)
$writer.AutoFlush = $true

# List all notes
$writer.WriteLine('{"action":"list_notes"}')
$writer.Flush()
$response = $reader.ReadLine() | ConvertFrom-Json
$response.notes | Format-Table

# Get a specific note
$writer.WriteLine('{"action":"get_note","noteId":"m5abc123-def456"}')
$writer.Flush()
$note = (Get-Content -Raw $pipe) | ConvertFrom-Json

# Create a note
$writer.WriteLine('{"action":"create_note","noteBody":"# Hello\n\nWorld","noteTitle":"Greeting"}')
$writer.Flush()
$result = (Get-Content -Raw $pipe) | ConvertFrom-Json

# Update a note
$writer.WriteLine('{"action":"update_note","noteId":"m5abc123-def456","noteBody":"# Updated\n\nNew content"}')
$writer.Flush()
$result = (Get-Content -Raw $pipe) | ConvertFrom-Json

# Search notes
$writer.WriteLine('{"action":"search_notes","query":"project"}')
$writer.Flush()
$results = (Get-Content -Raw $pipe) | ConvertFrom-Json

# Delete notes
$writer.WriteLine('{"action":"delete_notes","noteIds":["m5abc123-def456"]}')
$writer.Flush()
$result = (Get-Content -Raw $pipe) | ConvertFrom-Json

$pipe.Close()
```

### Python

```python
import win32pipe
import win32file
import json
import time

pipe_name = r'\\.\pipe\QuickMemo_AI'

def send_command(cmd):
    pipe = win32file.CreateFile(
        pipe_name,
        win32file.GENERIC_READ | win32file.GENERIC_WRITE,
        0, None,
        win32file.OPEN_EXISTING,
        0, None
    )
    try:
        win32file.WriteFile(pipe, cmd.encode('utf-8') + b'\n')
        # Read response
        result = b''
        while True:
            hr, data = win32file.ReadFile(pipe, 4096)
            result += data
            if b'\n' in data:
                break
        return json.loads(result.decode('utf-8').strip())
    finally:
        win32file.CloseHandle(pipe)

# List notes
print(send_command('{"action":"list_notes"}'))

# Get a note
print(send_command('{"action":"get_note","noteId":"m5abc123-def456"}'))

# Create a note
print(send_command('{"action":"create_note","noteBody":"# Hello\n\nWorld"}'))

# Update a note
print(send_command('{"action":"update_note","noteId":"m5abc123-def456","noteBody":"# Updated"}'))

# Search notes
print(send_command('{"action":"search_notes","query":"meeting"}'))

# Delete notes
print(send_command('{"action":"delete_notes","noteIds":["m5abc123-def456"]}'))
```

### Node.js (Electron main process IPC alternative)

If you're writing an Electron main process module, you can also use the IPC bridge instead of the named pipe directly — the same commands are available via `ipcMain.handle` in main.js.

---

## Error Responses

```json
{"error": "Note not found"}
{"error": "noteId required"}
{"error": "noteBody required"}
{"error": "Invalid JSON"}
{"error": "Unknown action: some_action"}
```