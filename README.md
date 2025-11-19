# Extension Manager

A Chrome extension that lets you quickly enable and disable your installed extensions from a single popup window, using keyboard shortcuts and customizable key mappings.

---

## Features

- **Keyboard‑driven extension toggle**
  - Open the popup with a global shortcut (default: `Alt+M`) and toggle extensions using letter keys.
  - Supports single‑letter and two‑letter keys (`a` … `z`, `aa`, `ab`, … `zz`).

- **Key Mapping tab**
  - View all installed extensions with their icons and current keys.
  - Edit keys directly (1–2 letters `a–z`).
  - When assigning a key that is already in use, shows a confirmation dialog and safely reassigns the key.
  - Independent search bar to quickly find an extension by name.

- **View Options tab**
  - Choose how many cards to show per row (2/3/4 columns).
  - Configure maximum popup height; the popup grows up to that height and then scrolls vertically.
  - All view options are persisted between sessions.

- **Search and filtering**
  - Toggle Keys tab: search installed extensions by name.
  - Key Mapping tab: separate search for the mapping list.
  - `Ctrl+F` / `Cmd+F` focuses the appropriate search box depending on the active tab.

- **Persistent settings**
  - Key mappings, view options, active tab, and theme (light/dark) are stored and restored automatically.
  - Reset button to clear all key mappings and re‑generate them in alphabetical order.


---

## Usage

### Toggle Keys tab

- Search extensions by name using the search field.
- Each card shows:
- Assigned key
- Icon and name
- Enable/Disable button
- Press the assigned key to toggle the extension:
- 1‑letter keys toggle immediately.
- 2‑letter keys:
 - First key press starts a short key sequence window.
 - Press the second letter within the timeout to trigger the 2‑letter key.
 - If no second key is pressed and there is a single‑letter mapping with no longer sequence, that 1‑letter key is triggered.

### Key Mapping tab

- Use the search field to filter the mapping list by extension name.
- Edit keys inline:
- Focus the input, type a new key (`a–z`, length 1–2), press Enter or blur.
- Conflicts show a confirmation dialog before reassigning.
- Use **Reset all keys** to clear all mappings and regenerate keys alphabetically.

### View Options tab

- **Columns per row**: choose 2, 3, or 4.
- **Max popup height**: choose 480px or 600px.
- Changes are applied immediately and saved.

---

## Keyboard Model

### Auto‑assigned keys

When there is no saved mapping, keys are assigned automatically in alphabetical order:

- Single letters first: `a`, `b`, …, `z`
- Then two‑letter sequences: `aa`, `ab`, `ac`, …

Assignments are stable: once a mapping is saved for an extension ID, it is reused on the next load.

### Manual key mapping

In the **Key Mapping** tab:

- Each extension shows:
  - Icon and name
  - Current key label (`Key: a`, `Key: aa`, or `Key: -`)
  - Editable key input (1–2 letters)
- Valid keys:
  - Only `a–z`, length 1–2.
  - Invalid input (numbers, symbols, 3+ letters) is rejected with an inline error:
    - `Key must be 1–2 letters (a–z).`

When you type a key that is already used:

1. The extension looks up other extensions using the same key.
2. A confirmation dialog appears, for example:
```txt
Key 'a' is already used by other extensions.
Replace the key there and assign it to this extension?
```

3. If you confirm:
- The key is removed from the conflicting extension.
- The key is assigned to the current extension.
- A small inline info message shows:
  - `Key reassigned from other extension.`
4. If you cancel:
- No mappings are changed.
- The input reverts to the previous key.


---

## Keyboard Shortcuts

- **Open popup**: `Alt+M` (configured via `manifest.json` → `commands`).
- **Search**
- `Ctrl+F` / `Cmd+F`:
 - On **Toggle Keys**: focuses the main search field.
 - On **Key Mapping**: focuses the mapping search field.
- **Toggle extensions**:
- Press the mapped key while the **Toggle Keys** tab is active and focus is not in a text field.

---

## Project Structure

- `manifest.json` – Extension metadata, permissions, keyboard command.
- `popup.html` – Popup layout and tab structure.
- `popup.css` – Styling and responsive grids for each tab.
- `popup.js` – All popup logic:
- Loading extensions via `chrome.management`
- Rendering Toggle / Mapping / View tabs
- Key mapping management and conflict handling
- View options and theme persistence
- Keyboard shortcut handling (key sequences, Ctrl+F / Cmd+F)

---

## Permissions

This extension uses the following permissions:

- `management` – Required to read the list of installed extensions and enable/disable them.
- `commands` – Required to bind the global shortcut for opening the popup.
- `storage` – Required to persist user settings (key mappings, view options, theme, last active tab).

The extension does **not** access or modify web page content; it only manages browser extensions through the official Chrome APIs.
