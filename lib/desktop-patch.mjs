/**
 * DSH Desktop「真·透桌面」补丁（Windows 亚克力窗口）。
 *
 * 背景：dsh 的网页主题透不出桌面壁纸；要让磨砂玻璃实时采样桌面，必须让 **DSH Desktop 的
 * 主窗口**本身变成 Windows 亚克力透明窗。这一步只能改桌面端 Electron 主进程的 main.js：
 *
 *   1. 主窗口 createWindow 的 win32/primary 选项块：
 *        标题栏 overlay 颜色透明 + backgroundMaterial: "acrylic" + backgroundColor: "#00000000"
 *   2. windowsAppearance IPC 处理器：渲染进程回报标题栏颜色时强制透明，防止被覆盖
 *   3. createMainWindow：dom-ready 时设 window.__DSH_NATIVE_GLASS__ = true，主题据此切真·透桌面模式
 *
 * 安全设计：
 *   - 只有三处锚点都在、且各只出现一次时才改（= 只对我们验证过的源码结构动手，认版本）
 *   - 改之前把原文件备份成 <main.js>.dsh-frosted-glass-backup
 *   - 改之前先检查目标块是否已经被我们改过（幂等）
 *   - 还原 = 备份覆盖回来；没有备份时按同样锚点反向改
 *   - 任何异常都返回 { ok:false }，绝不抛错、绝不写坏文件
 */
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const BACKUP_SUFFIX = '.dsh-frosted-glass-backup'
export const MARKER = '__DSH_NATIVE_GLASS__'

function blocks(eol) {
  const b = (lines) => lines.join(eol) + eol
  return {
    oldWin32: b([
      '\t\t...process.platform === "win32" && primary ? {',
      '\t\t\ttitleBarStyle: "hidden",',
      '\t\t\ttitleBarOverlay: {',
      '\t\t\t\theight: 40,',
      '\t\t\t\tcolor: chromeFallbackFill(),',
      '\t\t\t\tsymbolColor: nativeTheme.shouldUseDarkColors ? "#f9fafb" : "#0f1115"',
      '\t\t\t}',
      '\t\t} : {},',
    ]),
    newWin32: b([
      '\t\t...process.platform === "win32" && primary ? {',
      '\t\t\ttitleBarStyle: "hidden",',
      '\t\t\ttitleBarOverlay: {',
      '\t\t\t\theight: 40,',
      '\t\t\t\tcolor: "#00000000",',
      '\t\t\t\tsymbolColor: nativeTheme.shouldUseDarkColors ? "#f9fafb" : "#0f1115"',
      '\t\t\t},',
      '\t\t\tbackgroundMaterial: "acrylic",',
      '\t\t\tbackgroundColor: "#00000000"',
      '\t\t} : {},',
    ]),
    oldAppearance: b([
      '\t\t\tif (validColor(color) && validColor(symbolColor)) mainWindow.setTitleBarOverlay({',
      '\t\t\t\tcolor,',
      '\t\t\t\tsymbolColor',
      '\t\t\t});',
    ]),
    newAppearance: b([
      '\t\t\tif (validColor(color) && validColor(symbolColor)) mainWindow.setTitleBarOverlay({',
      '\t\t\t\tcolor: "#00000000",',
      '\t\t\t\tsymbolColor',
      '\t\t\t});',
    ]),
    oldMainWindow: b([
      '\t\tconst window = createWindow(appPreload, false, true);',
      '\t\tmainWindow = window;',
    ]),
    newMainWindow: b([
      '\t\tconst window = createWindow(appPreload, false, true);',
      '\t\tmainWindow = window;',
      '\t\tif (process.platform === "win32") {',
      '\t\t\twindow.webContents.on("dom-ready", () => {',
      '\t\t\t\ttry {',
      `\t\t\t\t\twindow.webContents.executeJavaScript("try{window.${MARKER}=true}catch(e){};", true).catch(() => void 0);`,
      '\t\t\t\t} catch {}',
      '\t\t\t});',
      '\t\t}',
    ]),
  }
}

function countOf(text, needle) {
  return needle === '' ? 0 : text.split(needle).length - 1
}

/** DSH Desktop 安装在哪里：优先用 Electron 的 resourcesPath；<resources>/app/lib/main.js 是桌面主进程。 */
export function desktopMainPath(resourcesPath = process.resourcesPath) {
  if (typeof resourcesPath !== 'string' || resourcesPath === '') return null
  const main = join(resourcesPath, 'app', 'lib', 'main.js')
  return existsSync(main) ? main : null
}

/** 桌面端是不是 asar 打包（改不了）。 */
export function hasAsar(resourcesPath = process.resourcesPath) {
  if (typeof resourcesPath !== 'string' || resourcesPath === '') return false
  return existsSync(join(resourcesPath, 'app.asar'))
}

/**
 * 补丁状态。
 * status: 'unsupported-web'（不是桌面端）| 'unsupported-asar' | 'unsupported-layout'（版本结构不认）
 *       | 'unpatched' | 'patched'
 * compatible: 当前文件是否可以被本补丁安全修改（或已经改过）
 */
export function patchStatus(mainPath) {
  if (!mainPath) {
    return { status: hasAsar() ? 'unsupported-asar' : 'unsupported-web', compatible: false, path: null }
  }
  try {
    const text = readFileSync(mainPath, 'utf8')
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const { oldWin32, oldAppearance, oldMainWindow } = blocks(eol)
    const patched = text.includes(`backgroundMaterial: "acrylic"`) && text.includes(MARKER)
    if (patched) {
      return { status: 'patched', compatible: true, path: mainPath, backup: existsSync(mainPath + BACKUP_SUFFIX) }
    }
    const compatible =
      countOf(text, oldWin32) === 1 && countOf(text, oldAppearance) === 1 && countOf(text, oldMainWindow) === 1
    return { status: compatible ? 'unpatched' : 'unsupported-layout', compatible, path: mainPath }
  } catch (error) {
    return { status: 'error', compatible: false, path: mainPath, error: String(error && error.message ? error.message : error) }
  }
}

/** 打补丁（幂等）。改前备份。 */
export function applyDesktopPatch(mainPath) {
  try {
    const before = patchStatus(mainPath)
    if (before.status === 'patched') return { ok: true, changed: false, status: 'already-patched' }
    if (!before.compatible) return { ok: false, changed: false, status: before.status, error: '当前 DSH Desktop 版本的结构不在本补丁支持范围内，未修改' }
    const text = readFileSync(mainPath, 'utf8')
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const { oldWin32, newWin32, oldAppearance, newAppearance, oldMainWindow, newMainWindow } = blocks(eol)
    const next = text.replace(oldWin32, newWin32).replace(oldAppearance, newAppearance).replace(oldMainWindow, newMainWindow)
    if (next === text) return { ok: false, changed: false, status: before.status, error: '锚点替换后无变化' }
    copyFileSync(mainPath, mainPath + BACKUP_SUFFIX)
    writeFileSync(mainPath, next, 'utf8')
    return { ok: true, changed: true, status: 'patched', backup: mainPath + BACKUP_SUFFIX }
  } catch (error) {
    return { ok: false, changed: false, status: 'error', error: String(error && error.message ? error.message : error) }
  }
}

/** 还原补丁（优先备份，其次反向替换）。 */
export function revertDesktopPatch(mainPath) {
  try {
    if (!mainPath) return { ok: false, changed: false, status: 'unsupported' }
    const backup = mainPath + BACKUP_SUFFIX
    if (existsSync(backup)) {
      copyFileSync(backup, mainPath)
      try { rmSync(backup) } catch { /* 备份删不掉也无所谓 */ }
      return { ok: true, changed: true, status: 'reverted' }
    }
    const text = readFileSync(mainPath, 'utf8')
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const { oldWin32, newWin32, oldAppearance, newAppearance, oldMainWindow, newMainWindow } = blocks(eol)
    const next = text.replace(newWin32, oldWin32).replace(newAppearance, oldAppearance).replace(newMainWindow, oldMainWindow)
    if (next === text) return { ok: true, changed: false, status: 'not-patched-or-no-backup' }
    writeFileSync(mainPath, next, 'utf8')
    return { ok: true, changed: true, status: 'reverted' }
  } catch (error) {
    return { ok: false, changed: false, status: 'error', error: String(error && error.message ? error.message : error) }
  }
}
