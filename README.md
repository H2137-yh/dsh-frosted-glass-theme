# dsh-frosted-glass-theme · 磨砂玻璃主题

[English](#english) | 中文

DeepSeek Harness Web UI 的**磨砂玻璃主题**：半透明的白色毛玻璃面板，浮在一层柔和彩色玻璃底图上；浅色 / 深色两套，跟随 DSH 自带的配色切换。

![磨砂玻璃主题](assets/screenshot-1.png)

## 它做什么

- **一整层玻璃底图**：柔和冷色渐变 + 蓝/紫/薄荷/淡黄四团低饱和光斑 + 细噪点，纯 CSS（不加载外部图片、不发任何网络请求）。
- **面板全部玻璃化**：左栏、中栏、右栏、标题栏、输入卡片、下拉菜单、气泡都是半透明白 + `backdrop-filter` 模糊，带白色内高光与细描边。
- **跟随 DSH 配色**：DSH 切深色时自动换成深色玻璃 + 深色底图。
- **纯客户端**：Host 半侧是空 `apply()`，不改 DSH 一行代码，不注册接口、不读写文件。
- **可干净卸载**：插件停用/卸载时，注入的 CSS、底图、class 全部由 `ctx.effect` 清理。

## 环境要求

- DeepSeek Harness `>= 0.2.0`（含 `0.2.2-rc.x` 预发布线；声明见 `engines.dsh`）
- Web 界面（DSH Desktop 桌面端或浏览器版均可）

## 安装

已上架后（npm / GitHub 来源）：

```sh
dsh plugin --profile <你的 profile> add dsh-frosted-glass-theme
```

装完**重启 DSH**（或按 DSH 提示刷新页面）即生效；在 **插件 → 主题** 页里可以一键切换/停用。

本地开发：

```sh
dsh plugin --profile <profile> add link:F:/path/to/dsh-frosted-glass-theme
```

## 怎么用

- 生效后无需任何设置，主题自动应用。
- 想换回默认：在 **插件** 页停用本插件（或 dshmarket 的主题页切到别的主题）。
- 深色模式：DSH 设置里切换「深色」或让系统进入深色，主题自动跟随。

## 工作原理

`client.js`（浏览器半侧，手写 `__ModuleLoader__` bundle，零构建）在启动时：

1. 给 `<html>` 加 `dsh-frosted-glass` class；
2. 往 `<head>` 注入一段样式（DSH `--dsw-*` design token 覆盖 + 外壳/面板的玻璃样式）；
3. 往 `<body>` 最前面插一层 `#dsh-frosted-glass-theme-backdrop` 固定底图；
4. 用 `MutationObserver` 跟随 `body[data-ds-dark-theme]` 切换深色玻璃；
5. 返回清理函数，插件停用即全部撤销。

选择器只用稳定特征（`data-*` 属性、类名后缀如 `sidebarCol`/`centerCol`），不碰构建哈希前缀，DSH 小版本升级不容易坏。没有任何 Host API、网络请求或文件读写。

## 两种玻璃模式

| 模式 | 触发条件 | 效果 |
| --- | --- | --- |
| **模拟玻璃**（默认） | 普通 DSH（未改桌面端） | 一层设计好的柔和彩色玻璃底图 + 半透明模糊面板；看起来像磨砂玻璃，但透不出桌面壁纸 |
| **真·透桌面**（自动） | DSH Desktop 窗口是 Windows 亚克力透明窗 | 页面全透明，由 **Windows DWM 每帧实时合成桌面背景**：桌面是白色就是白磨砂，是彩色壁纸就是彩色磨砂，拖窗口/换壁纸实时跟随 |

真·透桌面模式下主题会自动做三件事：隐藏设计底图、把页面背景设为透明、关掉页面内的 CSS 模糊（模糊交给 Windows 亚克力，避免双重模糊）。

判定方式：宿主窗口打上亚克力补丁后会在 `dom-ready` 时设置 `window.__DSH_NATIVE_GLASS__ = true`（也支持 `#dsh-native-glass` hash 手动强制，调试用）。没打过补丁的宿主永远走模拟模式，主题不会坏。

> ⚠️ 「亚克力透明窗」是 **DeepSeek Harness Desktop 桌面端**的本地修改（Electron `BrowserWindow` 的 `backgroundMaterial: "acrylic"` + 透明 `backgroundColor` + 透明标题栏 overlay），不属于本 npm 包、也不是市场插件能做的事。本机补丁与还原见 `发布说明.md` §10。

## 装好之后：真·透桌面（自动打补丁）

**不需要手动改任何文件。** 主题的 host 半侧（`index.js`）在 DSH Desktop 启动时会自动检查桌面端主进程：

| 情况 | 插件行为 |
| --- | --- |
| 还没打过补丁、且 DSH Desktop 的源码结构和我们验证过的一致 | **自动打补丁**（改前备份成 `main.js.dsh-frosted-glass-backup`），浏览器右下角弹玻璃卡片提示「重启后生效」 |
| 已经打过补丁 | 什么都不做；重启后主题自动切真·透桌面模式 |
| 不是桌面端（`dsh web` 浏览器版） | 不碰任何文件，主题按模拟玻璃工作 |
| DSH Desktop 版本结构不认识 / asar 打包 | 不碰任何文件，只记状态（不会把别人的 DSH 改坏） |

装好后**重启一次 DSH** 即可：窗口变成真亚克力，磨砂玻璃实时采样桌面——桌面白色就是白磨砂，彩色壁纸就是彩色磨砂，换壁纸/拖窗口实时跟随。

- 不想要真透桌面了：状态卡上的「还原补丁」一键还原（或删掉 DSH 安装目录里的 `main.js.dsh-frosted-glass-backup` 旁边的备份文件并覆盖回来）。
- 想关掉自动打补丁：在 profile 的 `cordis.patch.yml` 里给本插件配置 `autoPatch: false`，之后只检测、由状态卡里手动点。
- ⚠️ DSH 每次升级会覆盖 `main.js`：插件下次启动会自动重新检测并打补丁（升级后多重启一次即可）。

## 已知限制

- 「真·透桌面」需要 **DSH Desktop + Windows 11 22H2 以上**（Windows 亚克力窗口）。浏览器版只能模拟。
- 只做配色/材质与桌面窗口材质，不改布局与交互。
- ⚠️ 给桌面端 `main.js` 打补丁属于**修改宿主程序文件**：只在本插件验证过的源码结构上动手、改前备份、可一键还原；但它不是 DSH 官方接口，DSH 版本更新后需要重新适配。上架市场时这一点会如实写在 README 里。

## 开发

```sh
# 直接改 client.js 里的 CSS 数组，然后在 DSH 里刷新页面看效果
```

## 许可

MIT
