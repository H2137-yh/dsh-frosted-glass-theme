/**
 * dsh-frosted-glass-theme —— Host 半侧。
 *
 * 做两件事，全部「尽力而为、绝不抛错」（Host 插件加载失败会让整个 DSH 起不来）：
 *
 * 1. **给 DSH Desktop 自动打「真·透桌面」亚克力补丁**
 *    用户装了主题只是第一步：网页主题默认只能模拟玻璃，要让磨砂玻璃实时采样真实桌面，
 *    必须让 DSH Desktop 主窗口变成 Windows 亚克力透明窗（见 lib/desktop-patch.mjs）。
 *    所以插件启动时（以及安装后第一次加载时）会自动检测桌面端 main.js：
 *      - 没打过、且源码结构和我们验证过的一致 → 自动打补丁（改前备份，可一键还原）
 *      - 已经打过 → 什么都不做
 *      - 版本结构不认 / 不是桌面端（dsh web 浏览器版）/ asar 打包 → 不动，只记状态
 *    补丁写入后需要**重启一次 DSH** 才会生效；浏览器半侧会弹一张玻璃小卡片提示。
 *
 * 2. 在 DSH 的 webServer 上挂同源接口，给浏览器半侧的状态卡用：
 *      GET  /api/frosted-glass-theme/status → 补丁状态（patched / unpatched / unsupported-*）
 *      POST /api/frosted-glass-theme/apply  → 手动打补丁（幂等）
 *      POST /api/frosted-glass-theme/revert → 还原补丁（备份覆盖）
 *
 * 配置（profile cordis.patch.yml 里同 id 覆盖，写在 config: 下）：
 *   autoPatch  启动时是否自动打补丁，默认 true；设为 false 则只检测、由用户在状态卡里手动点
 *   logDir     日志目录，默认 <插件目录>/logs
 */
import { appendFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyDesktopPatch,
  desktopMainPath,
  hasAsar,
  patchStatus,
  revertDesktopPatch,
} from './lib/desktop-patch.mjs'

export const name = 'frosted-glass-theme'

export const inject = ['webServer']

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const API_PREFIX = '/api/frosted-glass-theme'
const MAX_LOG_BYTES = 512 * 1024

function safeString(value) {
  try {
    return value instanceof Error ? value.message : String(value)
  } catch {
    return 'unknown'
  }
}

function makeLogger(config) {
  const dir = config && typeof config.logDir === 'string' && config.logDir !== '' ? config.logDir : join(PLUGIN_DIR, 'logs')
  return function log(level, message) {
    try {
      mkdirSync(dir, { recursive: true })
      const file = join(dir, 'theme.log')
      try {
        if (statSync(file).size > MAX_LOG_BYTES) return
      } catch {
        /* ignore */
      }
      appendFileSync(file, `${new Date().toISOString()} ${level}: ${message}\n`, 'utf8')
    } catch {
      /* 日志失败不影响任何功能 */
    }
  }
}

function sendJson(res, status, body) {
  try {
    const data = JSON.stringify(body)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(data)
  } catch {
    try { res.end('{}') } catch { /* ignore */ }
  }
}

function sameOrigin(req) {
  try {
    const origin = req.headers && req.headers.origin
    if (!origin) return true
    const host = (req.headers && req.headers.host) || ''
    const parsed = new URL(origin)
    if (parsed.host === host) return true
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  } catch {
    return false
  }
}

function snapshot(mainPath, autoPatch) {
  const status = patchStatus(mainPath)
  return {
    ok: true,
    autoPatch,
    desktop: !!mainPath,
    asar: hasAsar(),
    platform: process.platform,
    ...status,
  }
}

export function apply(ctx, config) {
  try {
    const cfg = config && typeof config === 'object' ? config : {}
    const autoPatch = cfg.autoPatch !== false
    const log = makeLogger(cfg)
    let mainPath = null
    try {
      mainPath = desktopMainPath()
    } catch (error) {
      log('warn', `resolve desktop main.js failed: ${safeString(error)}`)
    }
    log('info', `boot: ${JSON.stringify(snapshot(mainPath, autoPatch))}`)

    // 自动打补丁：延迟 1.5s，等宿主稳定；不阻塞启动。
    try {
      const timer = setTimeout(() => {
        try {
          const status = patchStatus(mainPath)
          if (status.status === 'patched') {
            log('info', 'auto-patch: already patched')
            return
          }
          if (!autoPatch) {
            log('info', `auto-patch disabled; status=${status.status}`)
            return
          }
          if (status.status !== 'unpatched' || !status.compatible) {
            log('warn', `auto-patch skipped: ${status.status}`)
            return
          }
          const result = applyDesktopPatch(mainPath)
          log(result.ok ? 'info' : 'warn', `auto-patch: ${JSON.stringify(result)}`)
        } catch (error) {
          log('error', `auto-patch failed: ${safeString(error)}`)
        }
      }, 1500)
      if (timer && typeof timer.unref === 'function') timer.unref()
    } catch (error) {
      log('warn', `schedule auto-patch failed: ${safeString(error)}`)
    }

    // 同源接口（给浏览器半侧的状态卡用）
    try {
      let webServer = null
      if (ctx && typeof ctx.get === 'function') webServer = ctx.get('webServer')
      if (!webServer && ctx && ctx.webServer) webServer = ctx.webServer
      if (!webServer || typeof webServer.register !== 'function') {
        log('warn', 'webServer unavailable; status card API disabled')
        return
      }

      const handler = async (req, res) => {
        try {
          const rawUrl = typeof req.url === 'string' ? req.url : API_PREFIX
          const url = new URL(rawUrl, 'http://localhost')
          let route = url.pathname
          if (route.startsWith(API_PREFIX)) route = route.slice(API_PREFIX.length)
          if (route === '') route = '/'
          const method = (req.method || 'GET').toUpperCase()
          if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, error: 'only local same-origin requests' })

          if (route === '/status' && method === 'GET') return sendJson(res, 200, snapshot(mainPath, autoPatch))

          if (route === '/apply' && (method === 'POST' || method === 'GET')) {
            const result = applyDesktopPatch(mainPath)
            log(result.ok ? 'info' : 'warn', `manual apply: ${JSON.stringify(result)}`)
            return sendJson(res, result.ok ? 200 : 400, { ...snapshot(mainPath, autoPatch), result })
          }

          if (route === '/revert' && (method === 'POST' || method === 'GET')) {
            const result = revertDesktopPatch(mainPath)
            log(result.ok ? 'info' : 'warn', `manual revert: ${JSON.stringify(result)}`)
            return sendJson(res, result.ok ? 200 : 400, { ...snapshot(mainPath, autoPatch), result })
          }

          return sendJson(res, 404, { ok: false, error: `unknown endpoint: ${method} ${route}` })
        } catch (error) {
          return sendJson(res, 500, { ok: false, error: safeString(error) })
        }
      }

      const dispose = webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
      if (typeof dispose === 'function' && ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => () => {
          try { dispose() } catch { /* ignore */ }
        })
      }
      log('info', `api registered: ${API_PREFIX}`)
    } catch (error) {
      log('warn', `register api failed: ${safeString(error)}`)
    }
  } catch (error) {
    /* 绝对不能抛错：抛错会让宿主启动失败 */
    try {
      console.error('[dsh-frosted-glass-theme]', safeString(error))
    } catch { /* ignore */ }
  }
}
