# **Revolver Tabs**

Rewritten of [original Revolver Tabs extension project](https://code.google.com/archive/p/revolver-chrome-extensions/) chromium-based to new Manifest v3.

## **Overview**

**Revolver Tabs** is a Chrome extension that automatically rotates through your open browser tabs at a custom interval. This improved version has:

- Clean, modular structure
- Compatibility with **Manifest V3**
- Robust options (base and advanced)
- Dark/Light theme toggle with persistent preference
- Ignore Tab Groups new feature

---

## **Key differences — Original vs. Final Version**

| Area                     | Original Version                   | Final Version                                                                                                    |
| ------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Settings Storage**     | Used `localStorage` only           | Uses `chrome.storage.local` or `sync` for persistent, isolated config                                            |
| **Options ↔ Background** | Accessed `backgroundPage` directly | Uses `chrome.runtime.sendMessage` for async sync                                                                 |
| **Tab Rotation**         | Mixed logic inside `background.js` | Clean separation with a **Service Worker** (`background_script.js`) and new feature `Ignore Tab Groups`.                                              |
| **Advanced Settings**    | Rendered with raw `innerHTML`      | Uses DOM API (`createElement`, `appendChild`) with safe deduplication                                            |
| **Theme Support**        | None                               | Uses `:root` CSS Variables with `@media (prefers-color-scheme: dark)` plus manual toggle saved in `localStorage` |
| **UX Blocking**          | Inputs always editable             | Fields like “Seconds” and “Reload” disabled if “Custom” is unchecked                                             |
| **Manifest Standard**    | Manifest V2                        | Structured and tested for **Manifest V3**                                                                        |

---

## **Technologies and patterns used**

**Chrome Extension APIs**

- `chrome.storage.local` / `chrome.storage.sync` for settings
- `chrome.runtime.sendMessage` for runtime communication
- `chrome.tabs.query`, `chrome.windows.getCurrent` to manage tab lists
- `chrome.alarms` to handle periodic tasks under Manifest V3

**Manifest V3**

- Uses `background service_worker`
- Uses `tabs`, `idle`, `storage` and `alarms` permissions
- Uses `action` instead of `browser_action`

**DOM API best practices**

- Creates elements with `createElement` + `appendChild` (safe DOM construction)
- Resets containers to prevent duplicates
- Defensive validation: skips broken blocks to avoid runtime errors

**Theme switch**

- CSS Variables: `--body-bg`, `--text-color` etc. managed under `:root`
- Fallback to `@media (prefers-color-scheme: dark)`

**UX Enhancements**

- Uses `disabled` effect for inactive fields
- Custom checkboxes toggle input states live

---

## **Installation**

1\. Open Chrome Extensions Page: Type `chrome://extensions` in the address bar and press Enter.  
2\. Enable Developer Mode: Locate the "Developer mode" toggle switch (usually in the top right corner) and turn it on.  
3\. Load Unpacked: Click the "Load unpacked" button.  
4\. Select Extension Folder: In the file browser that opens, navigate to the folder containing your unpacked extension files (the one with the `manifest.json` file).  
5\. Confirm Selection: Click "Select Folder" or "Open".

The extension should now be installed and enabled.
