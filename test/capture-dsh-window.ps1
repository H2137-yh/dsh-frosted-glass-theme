# 截取本机 DSH（DeepSeek Harness Desktop，F:\04_软件 那套）的主窗口。
# 用法:
#   pwsh -File capture-dsh-window.ps1 -Out F:\...\assets\screenshot-1.png
#   pwsh -File capture-dsh-window.ps1 -List          # 只列窗口
# 不抢焦点（PrintWindow 直接抓窗口内容）；找不到就报 WINDOW_NOT_FOUND。
param(
  [string]$Out = 'F:\DSH\插件\dsh-frosted-glass-theme\assets\screenshot-1.png',
  [switch]$List,
  [string]$TitleLike = 'DeepSeek Harness',
  [string]$ExeLike = '04_软件'
)
Add-Type -AssemblyName System.Drawing
$sig = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class DshWin {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr param);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT rect, int size);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static List<string> rows = new List<string>();
  public static IntPtr last;
  public static void Scan() {
    rows.Clear(); last = IntPtr.Zero;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      string t = sb.ToString();
      if (t.Length == 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      rows.Add(pid + "\t" + h.ToString() + "\t" + t);
      return true;
    }, IntPtr.Zero);
    last = IntPtr.Zero;
  }
  public static IntPtr Find(string like, string exeLike) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, 512);
      string t = sb.ToString();
      if (t.Length == 0) return true;
      if (t.IndexOf(like, StringComparison.OrdinalIgnoreCase) < 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      string path = "";
      try { path = System.Diagnostics.Process.GetProcessById((int)pid).MainModule.FileName; } catch { }
      if (exeLike.Length > 0 && path.IndexOf(exeLike, StringComparison.OrdinalIgnoreCase) < 0) return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }
  public static RECT Rect(IntPtr h) {
    RECT r; DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT)));
    return r;
  }
}
'@
Add-Type -TypeDefinition $sig -ReferencedAssemblies System.Drawing

[DshWin]::Scan()
if ($List) {
  foreach ($row in [DshWin]::rows) { Write-Host $row }
  exit 0
}
$h = [DshWin]::Find($TitleLike, $ExeLike)
if ($h -eq [IntPtr]::Zero) { Write-Host "WINDOW_NOT_FOUND"; exit 2 }
$r = [DshWin]::Rect($h)
$w = $r.Right - $r.Left; $hh = $r.Bottom - $r.Top
Write-Host "RECT $($r.Left),$($r.Top) ${w}x${hh}"
if ($w -le 0 -or $hh -le 0) { Write-Host "BAD_RECT (window minimized?)"; exit 3 }
$bmp = New-Object System.Drawing.Bitmap $w, $hh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [DshWin]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
Write-Host "PRINTWINDOW=$ok"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Out) | Out-Null
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "SAVED $Out ${w}x${hh}"
