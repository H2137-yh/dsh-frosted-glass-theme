/**
 * dsh-frosted-glass-theme —— 浏览器半侧（手写 __ModuleLoader__ bundle，零构建）。
 *
 * 把 DeepSeek Harness 的 Web UI 变成「磨砂玻璃」主题：
 *   1. 在页面最底层插一层设计好的玻璃底图（柔和冷色渐变 + 几团低饱和彩色光斑 + 细噪点）；
 *   2. 覆盖 DSH 的 --dsw-* design token，让画布/面板/菜单/气泡/输入框都变成半透明白；
 *   3. 给左栏、中栏、右栏、输入卡片加 backdrop-filter，做出真正的毛玻璃模糊质感；
 *   4. 跟随 DSH 的浅色/深色（body[data-ds-dark-theme]）自动切一套深色玻璃；
 *   5. 禁用插件（dshmarket 切主题）时 ctx.effect 的清理函数会把 CSS/底图/class 全部撤掉。
 *
 * 不依赖 React，不改 DSH 一行代码；只用稳定选择器（data-* 属性 + 类名后缀），
 * 升级 DSH 小版本也不容易坏。
 */

window.__ModuleLoader__.load({
  id: 'dsh-frosted-glass-theme',

  factory: function () {
    var STYLE_ID = 'dsh-frosted-glass-theme-style'
    var BACKDROP_ID = 'dsh-frosted-glass-theme-backdrop'
    var STRIP_ID = 'dsh-frosted-glass-theme-titlebar'
    var CORNER_ID = 'dsh-frosted-glass-theme-corner'
    var CORNER_RADIUS = 8
    var cornerObserver = null
    var cornerTimer = null
    var ROOT_CLASS = 'dsh-frosted-glass'
    var DARK_CLASS = 'dsh-frosted-glass-dark'
    var NATIVE_CLASS = 'dsh-frosted-glass-native'

    // ---- 玻璃底图（纯 CSS：渐变 + 光斑 + SVG 噪点） -------------------------
    var BACKDROP_LIGHT =
      'radial-gradient(1200px 760px at 8% -6%, rgba(126,172,255,.62), rgba(126,172,255,0) 68%),' +
      'radial-gradient(1000px 680px at 96% 2%, rgba(178,142,250,.52), rgba(178,142,250,0) 70%),' +
      'radial-gradient(1200px 780px at 84% 104%, rgba(104,214,196,.46), rgba(104,214,196,0) 72%),' +
      'radial-gradient(900px 640px at 6% 96%, rgba(255,214,140,.38), rgba(255,214,140,0) 72%),' +
      'linear-gradient(152deg,#f4f8ff 0%,#eaeff9 44%,#e6ecf6 100%)'
    var BACKDROP_DARK =
      'radial-gradient(1200px 760px at 8% -6%, rgba(66,104,214,.44), rgba(66,104,214,0) 68%),' +
      'radial-gradient(1000px 680px at 96% 2%, rgba(126,86,208,.38), rgba(126,86,208,0) 70%),' +
      'radial-gradient(1200px 780px at 84% 104%, rgba(38,150,150,.30), rgba(38,150,150,0) 72%),' +
      'linear-gradient(152deg,#12161f 0%,#0f131a 50%,#0d1117 100%)'

    var NOISE =
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
      "<feColorMatrix type='saturate' values='0'/></filter>" +
      "<rect width='180' height='180' filter='url(%23n)' opacity='0.5'/></svg>\")"

    var CSS = [
      '/* ============================================================',
      '   dsh-frosted-glass-theme · 磨砂玻璃主题',
      '   画布：透明 → 露出底图；面板：半透明白 + backdrop-filter 模糊',
      '   浅色 / 深色两套，跟随 body[data-ds-dark-theme]',
      '   ============================================================ */',
      '',
      '/* ---- 画布/底图 ------------------------------------------------------ */',
      'html.' + ROOT_CLASS + '{background-color:#eef3fb}',
      'html.' + ROOT_CLASS + ' body{background:transparent !important}',
      'html.' + ROOT_CLASS + ' #root{position:relative;z-index:1;background:transparent !important}',
      'html.' + ROOT_CLASS + ' #root > div{background:transparent !important}',
      'html.' + ROOT_CLASS + ' #' + BACKDROP_ID + '{',
      '  position:fixed;inset:0;z-index:0;pointer-events:none;',
      '  background-color:#eef3fb;background-image:' + BACKDROP_LIGHT + ';',
      '  background-size:cover;background-repeat:no-repeat;',
      '}',
      'html.' + ROOT_CLASS + ' #' + BACKDROP_ID + '::before{',
      '  content:"";position:absolute;inset:-12%;pointer-events:none;',
      '  background:radial-gradient(620px 420px at 30% 32%,rgba(255,255,255,.55),rgba(255,255,255,0) 70%),radial-gradient(520px 380px at 72% 66%,rgba(255,255,255,.40),rgba(255,255,255,0) 72%);',
      '  filter:blur(12px);',
      '}',
      'html.' + ROOT_CLASS + ' #' + BACKDROP_ID + '::after{',
      '  content:"";position:absolute;inset:0;opacity:.26;mix-blend-mode:soft-light;',
      '  background-image:' + NOISE + ';background-size:180px 180px;',
      '}',
      '',
      '/* ---- DSH token：浅色玻璃面 ----------------------------------------- */',
      'html.' + ROOT_CLASS + ' body{',
      '  --dsw-alias-bg-base:rgba(255,255,255,.24);',
      '  --dsw-alias-bg-layer-1:rgba(255,255,255,.28);',
      '  --dsw-alias-bg-layer-2:rgba(255,255,255,.34);',
      '  --dsw-alias-bg-layer-3:rgba(255,255,255,.46);',
      '  --dsw-alias-bg-overlay:rgba(255,255,255,.20);',
      '  --dsw-specific-sidebar-fill:rgba(255,255,255,.34);',
      '  --dsw-specific-menu:rgba(255,255,255,.48);',
      '  --dsw-menu-backdrop-filter:blur(calc(14px + var(--fg-blur) * 0.6)) saturate(170%);',
      '  --dsw-specific-bubble:rgba(255,255,255,.40);',
      '  --dsw-specific-tip:rgba(255,255,255,.34);',
      '  --dsw-specific-selector:rgba(255,255,255,.34);',
      '  --dsw-specific-input-major:rgba(255,255,255,.80);',
      '  --dsw-alias-border-l1:rgba(255,255,255,.60);',
      '  --dsw-alias-border-l2:rgba(158,176,204,.34);',
      '  --dsw-alias-border-l3:rgba(150,168,196,.30);',
      '  --dsw-alias-border-l4:rgba(140,158,186,.26);',
      '  --dsw-alias-interactive-bg-hover:rgba(255,255,255,.16);',
      '  --dsw-alias-interactive-bg-active:rgba(255,255,255,.26);',
      '  --dsw-alias-scrollbar-bg-l1:rgba(88,108,140,.16);',
      '  --dsw-alias-scrollbar-bg-l2:rgba(88,108,140,.20);',
      '  --dsw-elevation-panel:0 10px 30px rgba(37,55,84,.10),0 1px 2px rgba(37,55,84,.06);',
      '  --dsw-elevation-prominent:0 18px 46px rgba(37,55,84,.16),0 1px 2px rgba(37,55,84,.08);',
      '  --dsw-elevation-soft:0 6px 22px rgba(37,55,84,.08);',
      '}',
      '',
      '/* ---- 可调参数：玻璃白度 / 模糊强度（右上角小面板控制）---------------- */',
      'html.' + ROOT_CLASS + '{--fg-rgb:255 255 255;--fg-a:.16;--fg-blur:22px}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + '{--fg-rgb:30 35 46;--fg-a:.22}',
      'html.' + NATIVE_CLASS + '{--fg-blur:0px}',
      'html.' + ROOT_CLASS + ' [class*="centerCol"]{',
      '  background:rgb(var(--fg-rgb) / var(--fg-a)) !important;',
      '  backdrop-filter:blur(var(--fg-blur)) saturate(150%) !important;',
      '  -webkit-backdrop-filter:blur(var(--fg-blur)) saturate(150%) !important;',
      '}',
      'html.' + ROOT_CLASS + ' [class*="an3WzG_root"]{background:rgb(var(--fg-rgb) / calc(var(--fg-a) * 1.5)) !important}',
      'html.' + ROOT_CLASS + ' [class*="sidebarCol"]{',
      '  background:linear-gradient(180deg,rgb(var(--fg-rgb) / calc(var(--fg-a) * 2.6)) 0%,rgb(var(--fg-rgb) / calc(var(--fg-a) * 1.9)) 100%) !important;',
      '}',
      'html.' + ROOT_CLASS + ' [class*="wtg9ga_root"]{background:transparent !important}',
      'html.' + ROOT_CLASS + ' [data-rightbar-col]{background:rgb(var(--fg-rgb) / calc(var(--fg-a) * 1.75)) !important}',
      '/* 失焦保护：Windows 亚克力在窗口失焦时会停掉实时采样、退回纯色（整窗发白）。',
      '   失焦时铺上主题自带的柔和底图（带一点饱和度和压暗，避免整片发白），',
      '   用 opacity 过渡做淡入淡出，不做 display 硬切。 */',
      'html.' + NATIVE_CLASS + ' #' + BACKDROP_ID + '{opacity:0;transition:opacity .28s ease-out}',
      'html.' + NATIVE_CLASS + '.dsh-frosted-glass-unfocused #' + BACKDROP_ID + '{opacity:1 !important;filter:saturate(1.18) brightness(.93)}',
      'html.' + NATIVE_CLASS + '.dsh-frosted-glass-noguard.dsh-frosted-glass-unfocused #' + BACKDROP_ID + '{opacity:0 !important}',
      '',
      '/* ---- 外壳：左栏 / 中栏 / 右栏 / 底栏 --------------------------------- */',
      'html.' + ROOT_CLASS + ' [class*="_frame"]{background:transparent !important}',
      'html.' + ROOT_CLASS + ' [class*="sidebarCol"]{',
      '  backdrop-filter:blur(calc(8px + var(--fg-blur) * 0.8)) saturate(180%);-webkit-backdrop-filter:blur(calc(8px + var(--fg-blur) * 0.8)) saturate(180%);',
      '  border-right:1px solid rgba(255,255,255,.62) !important;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.85),inset -1px 0 0 rgba(255,255,255,.22);',
      '}',
      'html.' + ROOT_CLASS + ' [class*="centerCol"]{',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.55);',
      '}',
      'html.' + ROOT_CLASS + ' [class*="mainPanel"]{background:transparent !important}',
      'html.' + ROOT_CLASS + ' [data-rightbar-col]{',
      '  backdrop-filter:blur(calc(8px + var(--fg-blur) * 0.8)) saturate(175%);-webkit-backdrop-filter:blur(calc(8px + var(--fg-blur) * 0.8)) saturate(175%);',
      '  border-left:1px solid rgba(255,255,255,.55) !important;',
      '}',
      'html.' + ROOT_CLASS + ' [class*="bottomRow"]{background:transparent !important}',
      '',
      '/* ---- 轨迹 / 统计 页：和对话页共用同一层玻璃 ---------------------------',
      '   上游把轨迹页做成「eciBTa_root → xeixwq_split → xeixwq_tablePane → xeixwq_table」',
      '   四层各刷一层 --dsw-alias-bg-layer-1，叠起来接近实白。这里把容器层全部拍透明，',
      '   只留下对话页那层玻璃（centerCol + 视图根）；表头/详情卡给一点点毛玻璃，保证滚动可读。 */',
      'html.' + ROOT_CLASS + ' [class*="eciBTa_root"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_split"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_tablePane"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_table"],',
      'html.' + ROOT_CLASS + ' [class*="Wd4N7W_root"],',
      'html.' + ROOT_CLASS + ' [class*="tzG23a_plot"],',
      'html.' + ROOT_CLASS + ' [class*="tzG23a_labels"]{background:transparent !important}',
      'html.' + ROOT_CLASS + ' [class*="tzG23a_earlierHistory"]{',
      '  background:linear-gradient(to right,rgba(255,255,255,.20) 0,rgba(255,255,255,.20) 38%,transparent 100%) !important;',
      '}',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_table"] th{',
      '  background-color:rgba(255,255,255,.20) !important;background-image:none !important;',
      '  backdrop-filter:blur(20px) saturate(170%);-webkit-backdrop-filter:blur(20px) saturate(170%);',
      '  border-bottom:1px solid rgba(255,255,255,.30) !important;',
      '}',
      'html.' + ROOT_CLASS + ' [class*="Wd4N7W_search"]{background:rgba(255,255,255,.18) !important}',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_turnLabel"]{background:rgba(255,255,255,.44) !important}',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_details"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_overviewHeading"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_overviewPreview"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_programPanel"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_assistantOutput"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_schema"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_promptDiff"],',
      'html.' + ROOT_CLASS + ' [class*="xeixwq_toolCatalogDefinition"]{background:rgba(255,255,255,.14) !important}',
      '/* 右侧边栏（分栏面板）：宿主层透明，玻璃由内容自己那层出 */',
      'html.' + ROOT_CLASS + ' [data-rightbar-col] [class*="_tabHost_"],',
      'html.' + ROOT_CLASS + ' [data-rightbar-col] [class*="_pane_"],',
      'html.' + ROOT_CLASS + ' [data-rightbar-col] [class*="_emptyTabHost_"]{background:transparent !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_table"] th{background-color:rgba(255,255,255,.06) !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="Wd4N7W_search"]{background:rgba(255,255,255,.06) !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_turnLabel"]{background:rgba(255,255,255,.08) !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="tzG23a_earlierHistory"]{',
      '  background:linear-gradient(to right,rgba(255,255,255,.07) 0,rgba(255,255,255,.07) 38%,transparent 100%) !important;',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_details"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_overviewHeading"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_overviewPreview"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_programPanel"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_assistantOutput"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_schema"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_promptDiff"],',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="xeixwq_toolCatalogDefinition"]{background:rgba(255,255,255,.05) !important}',
      '/* 稳定兜底：DSH 重建后 hash 类名（xeixwq_/eciBTa_/tzG23a_/Wd4N7W_）会变，',
      '   这几条靠结构命中轨迹表与它的容器，保证最坏情况下也不会再叠成实白。 */',
      'html.' + ROOT_CLASS + ' table{background-color:transparent !important;background-image:none !important}',
      'html.' + ROOT_CLASS + ' thead th{background-color:rgba(255,255,255,.20) !important;background-image:none !important}',
      'html.' + ROOT_CLASS + ' div:has(> table),',
      'html.' + ROOT_CLASS + ' div:has(> div > table),',
      'html.' + ROOT_CLASS + ' div:has(> div > div > table){background-color:transparent !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' thead th{background-color:rgba(255,255,255,.06) !important}',
      '',
      '/* ---- 输入卡片 / 浮动面板 / 弹层：玻璃质感加强 ------------------------ */',
      'html.' + ROOT_CLASS + ' [data-composer-seat],',
      'html.' + ROOT_CLASS + ' [data-composer-dock]{background:transparent !important}',
      'html.' + ROOT_CLASS + ' [data-message-bubble]{',
      '  border:1px solid rgba(255,255,255,.55) !important;',
      '  box-shadow:0 2px 10px rgba(37,55,84,.06) !important;',
      '  backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);',
      '}',
      '',
      '/* ---- 深色玻璃：跟随 DSH 深色主题 ------------------------------------ */',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + '{background-color:#0f1218}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' #' + BACKDROP_ID + '{',
      '  background-color:#0f1218;background-image:' + BACKDROP_DARK + ';',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' #' + BACKDROP_ID + '::before{',
      '  background:radial-gradient(620px 420px at 30% 32%,rgba(120,150,220,.20),rgba(120,150,220,0) 70%),radial-gradient(520px 380px at 72% 66%,rgba(120,150,220,.14),rgba(120,150,220,0) 72%);',
      '}',
      'html.' + ROOT_CLASS + ' body[data-ds-dark-theme]{',
      '  --dsw-alias-bg-base:rgba(30,35,46,.44);',
      '  --dsw-alias-bg-layer-1:rgba(34,40,52,.48);',
      '  --dsw-alias-bg-layer-2:rgba(38,45,58,.52);',
      '  --dsw-alias-bg-layer-3:rgba(44,52,66,.58);',
      '  --dsw-alias-bg-overlay:rgba(20,24,32,.32);',
      '  --dsw-specific-sidebar-fill:rgba(30,35,46,.46);',
      '  --dsw-specific-menu:rgba(36,42,54,.54);',
      '  --dsw-specific-bubble:rgba(48,56,72,.50);',
      '  --dsw-specific-tip:rgba(48,56,72,.52);',
      '  --dsw-specific-selector:rgba(48,56,72,.52);',
      '  --dsw-specific-input-major:rgba(30,35,46,.80);',
      '  --dsw-alias-border-l1:rgba(255,255,255,.16);',
      '  --dsw-alias-border-l2:rgba(255,255,255,.12);',
      '  --dsw-alias-border-l3:rgba(255,255,255,.10);',
      '  --dsw-alias-border-l4:rgba(255,255,255,.08);',
      '  --dsw-alias-interactive-bg-hover:rgba(255,255,255,.10);',
      '  --dsw-alias-interactive-bg-active:rgba(255,255,255,.16);',
      '  --dsw-elevation-panel:0 12px 34px rgba(0,0,0,.42),0 1px 2px rgba(0,0,0,.30);',
      '  --dsw-elevation-prominent:0 20px 52px rgba(0,0,0,.52),0 1px 2px rgba(0,0,0,.32);',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="sidebarCol"]{',
      '  background:linear-gradient(180deg,rgba(38,44,58,.66) 0%,rgba(28,33,44,.52) 100%) !important;',
      '  border-right:1px solid rgba(255,255,255,.12) !important;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.10);',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [class*="centerCol"]{',
      '  background:rgba(24,29,38,.40) !important;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [data-rightbar-col]{',
      '  background:rgba(30,35,46,.58) !important;',
      '  border-left:1px solid rgba(255,255,255,.10) !important;',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [data-message-bubble]{',
      '  border-color:rgba(255,255,255,.12) !important;',
      '}',
      '',
      '/* ---- 其它小细节 ----------------------------------------------------- */',
      'html.' + ROOT_CLASS + ' ::selection{background:rgba(59,130,246,.26)}',
      'html.' + ROOT_CLASS + ' ::-webkit-scrollbar-thumb{background-color:rgba(88,108,140,.22);border-radius:8px}',
      'html.' + ROOT_CLASS + ' ::-webkit-scrollbar-thumb:hover{background-color:rgba(88,108,140,.32)}',
      'html.' + ROOT_CLASS + ' ::-webkit-scrollbar-track{background:transparent}',
      '',
      '/* ---- 真·透桌面模式（宿主窗口=亚克力透明窗时自动启用） ----------------',
      '   原理：DSH Desktop 的窗口本身是 Windows 亚克力（DWM 每帧实时合成桌面），',
      '   页面全部透明、不做 CSS blur，桌面就直接从玻璃面板后面透出来。',
      '   页面侧不画底图；面板只叠半透明白色。切换由 __DSH_NATIVE_GLASS__ 触发。 */',
      'html.' + NATIVE_CLASS + '{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' body{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' #' + BACKDROP_ID + '{display:block !important}',
      'html.' + NATIVE_CLASS + ' #root{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' #root > div{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' [class*="_frame"]{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' [class*="sidebarCol"]{',
      '  backdrop-filter:none !important;-webkit-backdrop-filter:none !important;',
      '  border-right:1px solid rgba(255,255,255,.55) !important;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.85);',
      '}',
      'html.' + NATIVE_CLASS + ' [class*="centerCol"]{',
      '  border-radius:8px 0 0 0 !important;',
      '  overflow:hidden !important;',
      '  box-shadow:none !important;',
      '}',
      '/* 输入框：正文从后面滚过时不能透出来 —— 提高不透明度 + 轻模糊 */',
      'html.' + NATIVE_CLASS + ' [data-composer-card]{',
      '  background:rgba(255,255,255,.80) !important;',
      '  backdrop-filter:blur(calc(12px + var(--fg-blur) * 0.7)) saturate(165%) !important;-webkit-backdrop-filter:blur(calc(12px + var(--fg-blur) * 0.7)) saturate(165%) !important;',
      '  box-shadow:0 10px 30px rgba(24,45,88,.10),inset 0 0 0 1px rgba(255,255,255,.55);',
      '}',
      'html.' + NATIVE_CLASS + '.' + DARK_CLASS + ' [data-composer-card]{',
      '  background:rgba(30,36,48,.80) !important;',
      '  box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.10);',
      '}',
      '/* 提问卡（ask_user_question）和输入卡片一样要比背景更深一档：',
      '   否则卡片后面的正文会透上来，和卡片里的选项文字糊在一起。 */',
      'html.' + ROOT_CLASS + ' [data-question-key] > section{',
      '  background:rgba(255,255,255,.80) !important;',
      '  backdrop-filter:blur(calc(12px + var(--fg-blur) * 0.7)) saturate(165%);-webkit-backdrop-filter:blur(calc(12px + var(--fg-blur) * 0.7)) saturate(165%);',
      '  box-shadow:0 16px 40px rgba(24,45,88,.16),inset 0 0 0 1px rgba(255,255,255,.62);',
      '}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' [data-question-key] > section{',
      '  background:rgba(30,36,48,.80) !important;',
      '  box-shadow:0 16px 40px rgba(0,0,0,.42),inset 0 0 0 1px rgba(255,255,255,.10);',
      '}',
      'html.' + NATIVE_CLASS + ' [class*="mainPanel"]{background:transparent !important}',
      'html.' + NATIVE_CLASS + ' [data-rightbar-col]{',
      '  border-left:1px solid rgba(255,255,255,.5) !important;',
      '}',
      'html.' + NATIVE_CLASS + ' [class*="bottomRow"]{background:transparent !important}',
      '/* 顶部系统框（Windows 标题栏条 + 菜单行）与左栏同色同透明度 */',
      'html.' + NATIVE_CLASS + ' body{--dsw-specific-sidebar-fill:rgba(255,255,255,.44)}',
      '/* 顶部系统框：贴一层和左栏同色的白色玻璃，压住裸露的亚克力灰调；底部一条极浅分隔线 */',
      '#' + STRIP_ID + '{position:fixed;top:0;left:0;right:0;height:40px;pointer-events:none;z-index:0;display:none}',
      'html.' + NATIVE_CLASS + ' #' + STRIP_ID + '{display:block;background:rgb(var(--fg-rgb) / calc(var(--fg-a) * 3.1)) !important}',
      'html.' + ROOT_CLASS + '.' + DARK_CLASS + ' #' + STRIP_ID + '{background:rgb(var(--fg-rgb) / calc(var(--fg-a) * 2.2)) !important}',
      '/* 顶栏与左栏交界处的小圆角补块（填掉交流区圆角露出的亚克力灰，和窗角一样 8px） */',
      '#' + CORNER_ID + '{position:fixed;pointer-events:none;z-index:2;display:none;width:8px;height:8px;background:rgba(255,255,255,.80);clip-path:polygon(0 0, 8px 0, 4px 1.07px, 1.07px 4px, 0 8px)}',
      'html.' + NATIVE_CLASS + ' #' + CORNER_ID + '{display:block;background:rgba(255,255,255,.80) !important;clip-path:polygon(0 0, 8px 0, 4px 1.07px, 1.07px 4px, 0 8px) !important}',
      'html.' + NATIVE_CLASS + '.' + DARK_CLASS + ' #' + CORNER_ID + '{background:rgba(34,40,52,.66) !important}',
      'html.' + NATIVE_CLASS + '.' + DARK_CLASS + '{background:transparent !important}',
      'html.' + NATIVE_CLASS + '.' + DARK_CLASS + ' [class*="sidebarCol"]{',
      '  border-right:1px solid rgba(255,255,255,.10) !important;',
      '}',
      '',
      '/* ---- 主题设置小面板（玻璃白度 / 模糊强度 / 失焦保护）------------------ */',
      '#dsh-fg-knob{position:fixed;left:10px;top:44%;width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.34);backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);box-shadow:0 6px 18px rgba(24,45,88,.16);color:#2a3a55;display:flex;align-items:center;justify-content:center;font:600 15px/1 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;z-index:2147483000;user-select:none}',
      '#dsh-fg-knob:hover{background:rgba(255,255,255,.55)}',
      'html.' + DARK_CLASS + ' #dsh-fg-knob{background:rgba(30,36,48,.55);color:#e6ecf6;border-color:rgba(255,255,255,.18)}',
      '#dsh-fg-panel{position:fixed;left:52px;top:44%;width:250px;padding:14px 16px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.65);background:rgba(255,255,255,.86);backdrop-filter:blur(26px) saturate(170%);-webkit-backdrop-filter:blur(26px) saturate(170%);box-shadow:0 18px 46px rgba(24,45,88,.22);color:#16233a;font:12px/1.6 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;z-index:2147483000;display:none}',
      'html.' + DARK_CLASS + ' #dsh-fg-panel{background:rgba(30,36,48,.92);color:#e6ecf6;border-color:rgba(255,255,255,.14)}',
      '#dsh-fg-panel.open{display:block}',
      '#dsh-fg-panel h4{margin:0 0 8px;font-size:13px;font-weight:600}',
      '#dsh-fg-panel .row{margin:9px 0}',
      '#dsh-fg-panel .row label{display:flex;justify-content:space-between;margin-bottom:3px;color:#46536b}',
      'html.' + DARK_CLASS + ' #dsh-fg-panel .row label{color:#9fb0c8}',
      '#dsh-fg-panel input[type=range]{width:100%;accent-color:#2563eb}',
      '#dsh-fg-panel .guard{display:flex;align-items:center;gap:8px;margin:10px 0 2px;color:#46536b}',
      'html.' + DARK_CLASS + ' #dsh-fg-panel .guard{color:#9fb0c8}',
      '#dsh-fg-panel .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}',
      '#dsh-fg-panel button{appearance:none;border:0;border-radius:8px;padding:5px 10px;font:inherit;cursor:pointer;color:#16233a;background:rgba(255,255,255,.72);box-shadow:0 0 0 1px rgba(148,164,190,.35)}',
      'html.' + DARK_CLASS + ' #dsh-fg-panel button{background:rgba(255,255,255,.1);color:#e6ecf6}',
      '#dsh-fg-panel .hint{color:#7b8798;font-size:11px;margin-top:6px}',
      '',
    ].join('\n')

    function injectStyle() {
      var old = document.getElementById(STYLE_ID)
      if (old && old.parentNode) old.parentNode.removeChild(old)
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.setAttribute('data-plugin-css', 'dsh-frosted-glass-theme')
      style.textContent = CSS
      ;(document.head || document.documentElement).appendChild(style)
    }

    function injectBackdrop() {
      if (!document.body) return
      if (document.getElementById(BACKDROP_ID)) return
      var backdrop = document.createElement('div')
      backdrop.id = BACKDROP_ID
      backdrop.setAttribute('aria-hidden', 'true')
      document.body.insertBefore(backdrop, document.body.firstChild)
    }

    /** 顶部系统框那一层：贴一条和左栏同色的白玻璃，让标题栏不再露出一块灰亚克力。 */
    function injectStrip() {
      if (!document.body) return
      if (document.getElementById(STRIP_ID)) return
      var strip = document.createElement('div')
      strip.id = STRIP_ID
      strip.setAttribute('aria-hidden', 'true')
      document.body.appendChild(strip)
    }

    /** 顶栏与左栏交界的小圆角补块：跟着交流区左上角走，窗口缩放/侧栏拖宽都跟得上。 */
    function positionCorner() {
      var el = document.getElementById(CORNER_ID)
      if (!el) return
      var col = document.querySelector('[class*="centerCol"]')
      if (!col) { el.style.display = 'none'; return }
      var rect = col.getBoundingClientRect()
      el.style.left = Math.round(rect.left) + 'px'
      el.style.top = Math.round(rect.top) + 'px'
      try {
        col.style.setProperty('border-radius', '8px 0 0 0', 'important')
        col.style.setProperty('overflow', 'hidden', 'important')
      } catch (error) { /* ignore */ }
    }

    function injectCorner() {
      if (!document.body || document.getElementById(CORNER_ID)) return
      var corner = document.createElement('div')
      corner.id = CORNER_ID
      corner.setAttribute('aria-hidden', 'true')
      document.body.appendChild(corner)
      positionCorner()
      try {
        var col = document.querySelector('[class*="centerCol"]')
        if (col && typeof ResizeObserver === 'function') {
          cornerObserver = new ResizeObserver(function () { positionCorner() })
          cornerObserver.observe(col)
          if (col.parentElement) cornerObserver.observe(col.parentElement)
        }
      } catch (error) { /* ignore */ }
      window.addEventListener('resize', positionCorner)
      var ticks = 0
      cornerTimer = setInterval(function () {
        positionCorner()
        if (++ticks > 60) { clearInterval(cornerTimer); cornerTimer = null }
      }, 50)
    }

    function syncDark() {
      var dark = !!(document.body && document.body.hasAttribute('data-ds-dark-theme'))
      document.documentElement.classList.toggle(DARK_CLASS, dark)
      applySettings()
      if (refreshPanelUi) refreshPanelUi()
    }

    /**
     * 宿主窗口是不是「亚克力透明窗」。
     * DSH Desktop 打上亚克力补丁后会在 dom-ready 时设置 window.__DSH_NATIVE_GLASS__=true；
     * 也支持用 URL hash #dsh-native-glass 手动强制（调试用）。
     * 没打补丁的宿主（含普通浏览器）返回 false → 用设计底图的模拟玻璃模式。
     */
    function isNativeGlass() {
      try {
        if (window.__DSH_NATIVE_GLASS__ === true) return true
        return /(?:^|[#&])dsh-native-glass(?:$|[&])/.test(String(location.hash || ''))
      } catch (error) {
        return false
      }
    }

    function syncNative() {
      document.documentElement.classList.toggle(NATIVE_CLASS, isNativeGlass())
      applySettings()
      if (refreshPanelUi) refreshPanelUi()
    }

    // ---- 真·透桌面补丁状态卡 ------------------------------------------------
    var CARD_ID = 'dsh-frosted-glass-theme-patch-card'
    var PATCH_API = '/api/frosted-glass-theme'
    var DISMISS_KEY = 'dsh-frosted-glass-theme:patch-card-dismissed'

    function removePatchCard() {
      var card = document.getElementById(CARD_ID)
      if (card) card.remove()
    }

    function patchRequest(action) {
      return fetch(PATCH_API + '/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
        .then(function (response) { return response.ok ? response.json() : null })
        .catch(function () { return null })
    }

    function button(label, kind) {
      var style = kind === 'primary'
        ? 'appearance:none;border:0;border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;color:#fff;background:#2563eb;box-shadow:0 2px 8px rgba(37,99,235,.28)'
        : 'appearance:none;border:0;border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;color:#16233a;background:rgba(255,255,255,.72);box-shadow:0 0 0 1px rgba(148,164,190,.35)'
      return '<button type="button" data-action="' + kind + '" style="' + style + '">' + label + '</button>'
    }

    /**
     * 补丁状态卡：只在「窗口还不是亚克力（还没重启）」时出现。
     *  - patched   → 提示重启后生效
     *  - unpatched → 一键打补丁（host 半侧改桌面端 main.js，备份可还原）
     */
    function showPatchCard(status) {
      try {
        if (!status || !status.ok || document.getElementById(CARD_ID)) return
        var patched = status.status === 'patched'
        var patchable = status.status === 'unpatched' && status.compatible
        if (!patched && !patchable) return
        if (sessionStorage.getItem(DISMISS_KEY) === '1') return
        var card = document.createElement('div')
        card.id = CARD_ID
        card.style.cssText = [
          'position:fixed;right:18px;bottom:18px;width:320px;z-index:2147483000;',
          'padding:14px 16px;border-radius:14px;color:#16233a;font:12px/1.65 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;',
          'background:linear-gradient(180deg,rgba(255,255,255,.74),rgba(255,255,255,.60));',
          'backdrop-filter:blur(18px) saturate(1.6);-webkit-backdrop-filter:blur(18px) saturate(1.6);',
          'border:1px solid rgba(255,255,255,.72);',
          'box-shadow:0 14px 40px rgba(24,45,88,.20),inset 0 1px 0 rgba(255,255,255,.8);',
        ].join('')
        var title = patched ? '真·透桌面补丁已写入' : '可以开启「真·透桌面」'
        var body = patched
          ? '重启一次 DSH 后，窗口才会变成真·亚克力玻璃：桌面什么颜色，磨砂玻璃就实时渲染什么颜色。'
          : '检测到你这台是 DSH Desktop，但窗口还不是亚克力。现在打上补丁、重启一次 DSH，玻璃就能实时透出你的桌面壁纸。'
        card.innerHTML = [
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">',
          '<span style="width:8px;height:8px;border-radius:50%;background:' + (patched ? '#2563eb' : '#7c9cff') + ';box-shadow:0 0 0 3px rgba(37,99,235,.14)"></span>',
          '<strong style="font-size:13px">' + title + '</strong>',
          '<button type="button" data-action="dismiss" title="关闭" style="margin-left:auto;appearance:none;border:0;background:transparent;color:#6b7789;font-size:16px;line-height:1;cursor:pointer">×</button>',
          '</div>',
          '<div data-role="body" style="color:#46536b;margin-bottom:10px">' + body + '</div>',
          '<div data-role="actions" style="display:flex;gap:8px;justify-content:flex-end">',
          patched ? button('还原补丁', 'secondary') + button('知道了', 'primary') : button('不用', 'secondary') + button('现在打补丁', 'primary'),
          '</div>',
        ].join('')
        card.addEventListener('click', function (event) {
          var target = event.target
          if (!target || !target.getAttribute) return
          var action = target.getAttribute('data-action')
          if (!action) return
          if (action === 'dismiss' || action === 'primary') {
            if (action === 'primary' && !patched) {
              target.textContent = '正在写…'
              target.disabled = true
              patchRequest('apply').then(function (result) {
                if (result && result.status === 'patched') {
                  var bodyEl = card.querySelector('[data-role="body"]')
                  if (bodyEl) bodyEl.textContent = '补丁已写入。重启 DSH 后窗口会变成真·亚克力玻璃（桌面什么颜色就渲染什么颜色）。'
                  var actions = card.querySelector('[data-role="actions"]')
                  if (actions) actions.innerHTML = button('还原补丁', 'secondary') + button('知道了', 'primary')
                } else {
                  target.textContent = '打补丁失败'
                  target.disabled = false
                }
              })
              return
            }
            try { sessionStorage.setItem(DISMISS_KEY, '1') } catch (e) { /* ignore */ }
            removePatchCard()
            return
          }
          if (action === 'secondary') {
            if (patched) {
              target.textContent = '还原中…'
              target.disabled = true
              patchRequest('revert').then(function () {
                try { sessionStorage.removeItem(DISMISS_KEY) } catch (e) { /* ignore */ }
                removePatchCard()
              })
            } else {
              try { sessionStorage.setItem(DISMISS_KEY, '1') } catch (e) { /* ignore */ }
              removePatchCard()
            }
          }
        })
        document.body.appendChild(card)
      } catch (error) {
        /* 状态卡失败不影响主题 */
      }
    }

    function checkPatchCard() {
      try {
        if (isNativeGlass()) {
          removePatchCard()
          return
        }
        fetch(PATCH_API + '/status', { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.ok ? response.json() : null })
          .then(function (status) { showPatchCard(status) })
          .catch(function () { /* 没有接口（网页版/普通宿主）就静默 */ })
      } catch (error) {
        /* ignore */
      }
    }

    /* ---- 可调参数小面板：玻璃白度 / 模糊强度 / 失焦保护 ---------------------
       值存在 localStorage，刷新后保留；不改宿主、不发网络请求。 */
    var KNOB_ID = 'dsh-fg-knob'
    var PANEL_ID = 'dsh-fg-panel'
    var SETTINGS_KEY = 'dsh-frosted-glass-theme:settings'
    var NOGUARD_CLASS = 'dsh-frosted-glass-noguard'
    var UNFOCUSED_CLASS = 'dsh-frosted-glass-unfocused'
    var settings = { alpha: null, blur: null, guard: true, pos: null }
    var refreshPanelUi = null
    var onResizePanel = null

    function loadSettings() {
      try {
        var raw = localStorage.getItem(SETTINGS_KEY)
        if (!raw) return
        var parsed = JSON.parse(raw)
        if (typeof parsed.alpha === 'number') settings.alpha = Math.max(0, Math.min(60, parsed.alpha))
        if (typeof parsed.blur === 'number') settings.blur = Math.max(0, Math.min(40, parsed.blur))
        if (typeof parsed.guard === 'boolean') settings.guard = parsed.guard
        if (parsed.pos && typeof parsed.pos.x === 'number' && typeof parsed.pos.y === 'number') settings.pos = { x: parsed.pos.x, y: parsed.pos.y }
      } catch (error) { /* ignore */ }
    }

    function saveSettings() {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch (error) { /* ignore */ }
    }

    function applySettings() {
      var root = document.documentElement
      if (settings.alpha === null) root.style.removeProperty('--fg-a')
      else root.style.setProperty('--fg-a', String(Math.round(settings.alpha) / 100))
      if (settings.blur === null) root.style.removeProperty('--fg-blur')
      else root.style.setProperty('--fg-blur', Math.round(settings.blur) + 'px')
      root.classList.toggle(NOGUARD_CLASS, settings.guard === false)
    }

    function buildPanel() {
      if (!document.body || document.getElementById(KNOB_ID)) return
      var knob = document.createElement('div')
      knob.id = KNOB_ID
      knob.title = '磨砂玻璃主题设置（可拖动）'
      knob.textContent = '◐'
      document.body.appendChild(knob)

      var panel = document.createElement('div')
      panel.id = PANEL_ID
      panel.innerHTML = [
        '<h4>磨砂玻璃</h4>',
        '<div class="row"><label><span>玻璃白度</span><span data-role="alpha-val"></span></label>',
        '<input type="range" min="0" max="60" step="1" data-role="alpha"></div>',
        '<div class="row"><label><span>磨砂模糊</span><span data-role="blur-val"></span></label>',
        '<input type="range" min="0" max="40" step="1" data-role="blur"></div>',
        '<div class="guard"><input type="checkbox" data-role="guard"><span>失焦保护（窗口失焦时铺柔和底图，避免整窗发白）</span></div>',
        '<div class="btns"><button type="button" data-role="reset">恢复默认</button><button type="button" data-role="close">关闭</button></div>',
        '<div class="hint">「磨砂模糊」作用于输入框、提问卡、菜单等浮层，以及模拟玻璃模式的整窗；真·透桌面时整窗模糊由 Windows 亚克力固定。拖动 ◐ 可换位置（面板会跟着换边）。</div>',
      ].join('')
      document.body.appendChild(panel)

      /* ---- 拖动 ◐ 换位置 + 面板贴着它弹出（默认在左侧栏，不挡右侧滚动条） ---- */
      function clampKnob(x, y) {
        var w = knob.offsetWidth || 34
        var h = knob.offsetHeight || 34
        return {
          x: Math.max(4, Math.min(window.innerWidth - w - 4, x)),
          y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
        }
      }
      function applyKnobPos() {
        var p = settings.pos
        if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
          var def = { x: 10, y: Math.round(window.innerHeight * 0.44) }
          knob.style.left = def.x + 'px'
          knob.style.top = def.y + 'px'
          return
        }
        var c = clampKnob(p.x, p.y)
        knob.style.left = c.x + 'px'
        knob.style.top = c.y + 'px'
      }
      function positionPanel() {
        var kr = knob.getBoundingClientRect()
        var pw = panel.offsetWidth || 250
        var ph = panel.offsetHeight || 220
        var left = kr.right + 6
        if (left + pw > window.innerWidth - 6) left = Math.max(6, kr.left - pw - 6)
        var top = Math.min(Math.max(8, kr.top - 12), window.innerHeight - ph - 8)
        panel.style.left = Math.round(left) + 'px'
        panel.style.top = Math.round(top) + 'px'
      }
      function refreshPanelPos() { applyKnobPos(); if (panel.classList.contains('open')) positionPanel() }

      knob.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return
        var sx = event.clientX
        var sy = event.clientY
        var kr = knob.getBoundingClientRect()
        var ox = sx - kr.left
        var oy = sy - kr.top
        var moved = false
        knob.style.cursor = 'grabbing'
        try { knob.setPointerCapture(event.pointerId) } catch (error) { /* ignore */ }
        function onMove(ev) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true
          var c = clampKnob(ev.clientX - ox, ev.clientY - oy)
          knob.style.left = c.x + 'px'
          knob.style.top = c.y + 'px'
          if (panel.classList.contains('open')) positionPanel()
        }
        function onUp() {
          knob.style.cursor = ''
          knob.removeEventListener('pointermove', onMove)
          knob.removeEventListener('pointerup', onUp)
          if (moved) {
            settings.pos = { x: parseInt(knob.style.left, 10) || 10, y: parseInt(knob.style.top, 10) || 10 }
            saveSettings()
            justDragged = true
          }
        }
        knob.addEventListener('pointermove', onMove)
        knob.addEventListener('pointerup', onUp)
      })
      var justDragged = false
      knob.addEventListener('click', function () {
        if (justDragged) { justDragged = false; return }
        var panelEl = document.getElementById(PANEL_ID)
        if (!panelEl) return
        var willOpen = !panelEl.classList.contains('open')
        panelEl.classList.toggle('open', willOpen)
        if (willOpen) positionPanel()
      })
      onResizePanel = refreshPanelPos
      window.addEventListener('resize', onResizePanel)
      applyKnobPos()

      var alphaInput = panel.querySelector('[data-role="alpha"]')
      var blurInput = panel.querySelector('[data-role="blur"]')
      var guardInput = panel.querySelector('[data-role="guard"]')
      var alphaVal = panel.querySelector('[data-role="alpha-val"]')
      var blurVal = panel.querySelector('[data-role="blur-val"]')

      function nativeOn() { return document.documentElement.classList.contains(NATIVE_CLASS) }
      function darkOn() { return document.documentElement.classList.contains(DARK_CLASS) }
      function defaults() {
        var alphaDefault = darkOn() ? 22 : 16
        return { alpha: alphaDefault, blur: nativeOn() ? 0 : 22 }
      }
      function refreshUi() {
        var d = defaults()
        var alphaNow = settings.alpha === null ? d.alpha : settings.alpha
        var blurNow = settings.blur === null ? d.blur : settings.blur
        alphaInput.value = String(alphaNow)
        blurInput.value = String(blurNow)
        alphaVal.textContent = settings.alpha === null ? alphaNow + '%（默认）' : alphaNow + '%'
        blurVal.textContent = settings.blur === null ? blurNow + 'px（默认）' : blurNow + 'px'
        guardInput.checked = settings.guard !== false
      }

      alphaInput.addEventListener('input', function () {
        settings.alpha = Number(alphaInput.value)
        applySettings(); saveSettings(); refreshUi()
      })
      blurInput.addEventListener('input', function () {
        settings.blur = Number(blurInput.value)
        applySettings(); saveSettings(); refreshUi()
      })
      guardInput.addEventListener('change', function () {
        settings.guard = !!guardInput.checked
        applySettings(); saveSettings(); refreshUi()
      })
      panel.querySelector('[data-role="reset"]').addEventListener('click', function () {
        settings = { alpha: null, blur: null, guard: true, pos: settings.pos }
        applySettings(); saveSettings(); refreshUi()
      })
      panel.querySelector('[data-role="close"]').addEventListener('click', function () {
        panel.classList.remove('open')
      })
      refreshUi()
      refreshPanelUi = refreshUi
    }

    function removePanel() {
      if (onResizePanel) { window.removeEventListener('resize', onResizePanel); onResizePanel = null }
      var knob = document.getElementById(KNOB_ID)
      if (knob) knob.remove()
      var panel = document.getElementById(PANEL_ID)
      if (panel) panel.remove()
      refreshPanelUi = null
    }

    function onWindowBlur() {
      try { document.documentElement.classList.add(UNFOCUSED_CLASS) } catch (error) { /* ignore */ }
    }
    function onWindowFocus() {
      try { document.documentElement.classList.remove(UNFOCUSED_CLASS) } catch (error) { /* ignore */ }
    }

    function start() {
      document.documentElement.classList.add(ROOT_CLASS)
      injectStyle()
      injectBackdrop()
      injectStrip()
      injectCorner()
      loadSettings()
      applySettings()
      buildPanel()
      window.addEventListener('blur', onWindowBlur)
      window.addEventListener('focus', onWindowFocus)

      syncDark()
      syncNative()

      // 打补丁的桌面端在 dom-ready 才置位 __DSH_NATIVE_GLASS__，插件可能先加载 —— 轮询等它。
      var nativePolls = 0
      var nativeTimer = setInterval(function () {
        if (isNativeGlass()) {
          syncNative()
          clearInterval(nativeTimer)
          return
        }
        if (++nativePolls > 60) clearInterval(nativeTimer)
      }, 50)
      var patchCardTimer = setTimeout(checkPatchCard, 2600)
      var observer = new MutationObserver(function () { syncDark() })
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-ds-dark-theme'],
      })
      return { observer: observer, nativeTimer: nativeTimer, patchCardTimer: patchCardTimer }
    }
    return {
      name: 'dsh-frosted-glass-theme',
      apply: function (ctx) {
        ctx.effect(function () {
          var lifecycle = null
          var started = false
          function boot() {
            if (started) return
            if (!document.body) return
            started = true
            lifecycle = start()
          }
          if (document.body) boot()
          else document.addEventListener('DOMContentLoaded', boot, { once: true })
          return function () {
            document.removeEventListener('DOMContentLoaded', boot)
            if (lifecycle) {
              lifecycle.observer.disconnect()
              clearInterval(lifecycle.nativeTimer)
              clearTimeout(lifecycle.patchCardTimer)
            }
            removePatchCard()
            removePanel()
            window.removeEventListener('blur', onWindowBlur)
            window.removeEventListener('focus', onWindowFocus)
            document.documentElement.classList.remove(ROOT_CLASS, DARK_CLASS, NATIVE_CLASS, NOGUARD_CLASS, UNFOCUSED_CLASS)
            document.documentElement.style.removeProperty('--fg-a')
            document.documentElement.style.removeProperty('--fg-blur')
            refreshPanelUi = null
            var style = document.getElementById(STYLE_ID)
            if (style) style.remove()
            var backdrop = document.getElementById(BACKDROP_ID)
            if (backdrop) backdrop.remove()
            var strip = document.getElementById(STRIP_ID)
            if (strip) strip.remove()
            if (cornerObserver) { cornerObserver.disconnect(); cornerObserver = null }
            if (cornerTimer) { clearInterval(cornerTimer); cornerTimer = null }
            window.removeEventListener('resize', positionCorner)
            var cornerEl = document.getElementById(CORNER_ID)
            if (cornerEl) cornerEl.remove()
          }
        })
      },
    }
  },
})




