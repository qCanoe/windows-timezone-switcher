# Windows 时区切换

[English](README.md) · **简体中文**

一个简约的 Windows 托盘工具，支持搜索城市、预览当地时间，并快速切换系统时区。

<img src="docs/screenshot.png" alt="Windows 时区切换面板" width="320">

## 开始使用

从 [Releases](https://github.com/qCanoe/windows-timezone-switcher/releases/latest) 下载 `TimezoneTray-Windows-x64.zip`，解压后运行 `Timezone Tray.exe`。请保留整个解压目录，无需安装或另装 Node.js。

- 点击托盘图标，选择时区，再点击切换按钮。
- 右键图标可快速切换常用时区或退出。
- 按 Esc、点击 × 或面板外部可收起窗口。
- 在设置中切换中文 / English，或开启开机自动启动。

程序离线运行，采用黑白灰浅色界面，支持多屏，面板在任务栏上方打开。面板隐藏时暂停时间更新。

如果 Windows 将时区自动改回，请在系统设置中关闭“自动设置时区”。权限不足时可通过界面使用管理员权限重试。

## 开发

在 Windows 上使用 Node.js 22+：

```powershell
npm ci
npm run build
npm start
```

执行 `npm run package:dir`，便携版输出到 `release/win-unpacked/`。

使用 Electron、React、TypeScript 和 shadcn/ui 构建。
