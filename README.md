# Windows Timezone Switcher

**English** · [简体中文](README.zh-CN.md)

A minimal Windows tray app to switch your system time zone. Search cities, preview local times, and switch in a few clicks.

<img src="docs/screenshot.png" alt="Windows Timezone Switcher panel" width="320">

## Get started

Download `TimezoneTray-Windows-x64.zip` from [Releases](https://github.com/qCanoe/windows-timezone-switcher/releases/latest), extract it, and run `Timezone Tray.exe`. Keep the extracted folder intact. No installation or Node.js required.

- Click the tray icon, choose a time zone, and click the switch button.
- Right-click the icon for quick switches or to quit.
- Press Esc, click ×, or click outside the panel to hide it.

Works offline, with a light monochrome interface and multi-monitor support. The panel opens above the taskbar. The app interface is currently in Chinese.

If Windows restores the previous zone, turn off **Set time zone automatically** in system settings. An administrator retry is available when needed.

## Development

On Windows with Node.js 22+:

```powershell
npm ci
npm run build
npm start
```

Run `npm run package:dir` to build a portable app in `release/win-unpacked/`.

Built with Electron, React, TypeScript, and shadcn/ui.
