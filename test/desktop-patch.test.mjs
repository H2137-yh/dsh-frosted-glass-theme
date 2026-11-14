// 自测：对原版 main.js 打补丁 → 与当前已打补丁的 main.js 逐字节比对 → 还原 → 与原版比对
import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { applyDesktopPatch, patchStatus, revertDesktopPatch } from '../lib/desktop-patch.mjs'

const ORIG = 'F:/DSH/插件/dsh-frosted-glass-theme/_dsh-patch-backup/main.js.orig'
const PATCHED_CURRENT = 'F:/04_软件/DeepSeek Harness/resources/app/lib/main.js'
const TMP = 'F:/华为极客/_tmp/main-patch-test.js'

let failures = 0
function check(name, cond, extra = '') {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''))
  if (!cond) failures++
}

copyFileSync(ORIG, TMP)
const s0 = patchStatus(TMP)
check('status(unpatched) = unpatched', s0.status === 'unpatched', JSON.stringify(s0))

const applied = applyDesktopPatch(TMP)
check('apply ok', applied.ok === true && applied.status === 'patched', JSON.stringify(applied))

const s1 = patchStatus(TMP)
check('status(patched) = patched', s1.status === 'patched', JSON.stringify(s1))

const origNext = readFileSync(TMP, 'utf8')
const current = readFileSync(PATCHED_CURRENT, 'utf8')
check('generated == currently running patched main.js', origNext === current, `len ${origNext.length} vs ${current.length}`)

const idem = applyDesktopPatch(TMP)
check('apply is idempotent', idem.ok === true && idem.status === 'already-patched', JSON.stringify(idem))

const reverted = revertDesktopPatch(TMP)
check('revert ok', reverted.ok === true && reverted.status === 'reverted', JSON.stringify(reverted))
const back = readFileSync(TMP, 'utf8')
const origText = readFileSync(ORIG, 'utf8')
check('revert == original bytes', back === origText, `len ${back.length} vs ${origText.length}`)

try { rmSync(TMP) } catch {}
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
