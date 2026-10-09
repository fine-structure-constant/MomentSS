# 留白拼图 · 交互改进表单

> 侦察日期：2026-10-09　侦察范围：`C:\MyProgram\pyq` 全量源码 + 部署链路 + 既有文档
> 结论：功能骨架完整、工程纪律良好（三语类型检查、纯本地处理、结构化排版复用），**主要短板集中在「资源生命周期管理」与「图层/文字的增删改路径」两条主线上**。
> 本表只列问题与建议，未改动任何代码。

---

## 0. 侦察结论

### 0.1 项目形态

| 项 | 事实 | 证据 |
| --- | --- | --- |
| 技术栈 | React 19 + TypeScript 7 + Vite 8，纯静态客户端 | `package.json` |
| 数据层 | IndexedDB `liubai-collage`（v2），两个 store：`drafts` / `assets` | `src/lib/storage.ts:4-12` |
| 三个工具 | 长图排版（stitch） / 封面置中（cover） / 4·6·9 切分（grid） | `src/App.tsx:11-15` |
| 国际化 | 简中 / 繁中 / 英，键名类型强约束，构建期校验 | `src/i18n/locales/*.ts` |
| 测试 | vitest，7 个测试文件覆盖 composer / coverLayout / geometry / stitchLayout / imageImport / assetLibrary / i18n | `src/**/*.test.ts` |
| 代码量 | 业务源码约 3 400 行（含 `styles.css` 669 行） | `wc -l` |

### 0.2 自动化部署链路（已跑通，无需改动）

```
push main
  └─ GitHub Actions「Publish MomentSS deployment」
       └─ 构建 dist/ → 打包 momentss.tar.gz + deployment.json → 发布 Release（标 Latest）
            └─ 服务器 systemd timer（~1 分钟）主动拉取 Latest
                 └─ 校验 SHA-256 → 解包 → 原子切换 current
                      └─ Nginx + Cloudflare Tunnel → https://momentss.renschekhe.site
```

- 部署工具是 Python 包 `deploy/server/momentss_deploy`（`download.py` / `update.py` / `config.py`），服务器不需要 Node.js、不需要 SSH 入站。
- 关键约束：**不要手工把其他 Release 标为 Latest**，否则服务器找不到部署清单会静默保持旧站点（`deploy/README.md`）。
- 含义：本表单的所有改动，只要能 `npm test && npm run build` 通过，就自动上线；**没有灰度与回滚 UI，改动需要一次性做对**。

### 0.3 既有文档中与本次改动冲突的规则

| 文档 | 规则 | 与本表的关系 |
| --- | --- | --- |
| `DESIGN.md:127` | **One insertion edge** — 图层列表只在底部新增文字，不在每个图层之间重复插入动作 | 直接导致问题 **A5**（插入文字不便），需修订 |
| `DESIGN.md:75` | 图层条目「只在列表底部提供添加文字与双图横排动作」 | 同上 |
| `PRODUCT.md:28` | 主要使用场景包含触屏手机 | 与问题 **B7**（移动端拖拽排序失效）冲突 |

> `src/styles.css:134-135, 307` 仍保留 `.insert-text`（图层间隙的 hover 显示插入按钮）的完整样式（含移动端 `opacity: 1` 覆盖），但**全仓库已无任何组件引用它**——是一条死样式。说明该交互曾存在，后因上述规则被移除；样式可直接复用，是 A5 的低成本解法。

---

## 1. 问题总表

优先级定义：**P0** = 造成数据丢失或功能静默失效；**P1** = 日常路径上的明显摩擦；**P2** = 体验增强。
规模：**S** ≤ 2 文件；**M** 3–6 文件；**L** 涉及数据结构迁移或多个模块。

| # | 优先级 | 模块 | 问题 | 规模 | 需迁移数据 |
| --- | --- | --- | --- | --- | --- |
| A1 | P1 | 文字 | 新增文字/图片文字不继承上次样式 | S | 否 |
| A2 | P1 | 资源 | 资源面板图多时无限拉长，无搜索/筛选/分页 | M | 否 |
| A3 | P1 | 资源 | 资源与长图均不支持重命名 | S | 是 |
| A4 | P1 | 资源 | 无分组/分类，跨行程素材混在一起 | L | 是 |
| A5 | P1 | 图层 | 文字只能加在末尾，层间插入成本高；移动端无法拖拽排序 | M | 否 |
| A6 | P1 | 图层 | 双图并列只能配对「紧邻的两张」，无法换序、无法 3 图 | L | 是 |
| A7 | P1 | 裁切 | 长图与图片文字编辑器无裁切界面；缩放=1 时焦点滑杆静默失效 | M | 否 |
| B1 | P0 | 全局 | 删除资源/长图无确认、无撤销 | S | 否 |
| B2 | P1 | 图片文字 | 打开编辑器即自动写入文字层，关闭不还原 | S | 否 |
| B3 | P1 | 图层 | 「删除」按钮语义含混（删图层 vs 删资源） | S | 否 |
| B4 | P0 | 导入 | 单次导入超过 40 张被静默截断 | S | 否 |
| B5 | P2 | 导入 | 重复导入同一文件无提示、无去重 | M | 否 |
| B6 | P2 | 全局 | 无撤销 / 重做 | M | 否 |
| B8 | P2 | 切图 | 切换 4/6/9 时裁切取景被重置 | S | 否 |
| B9 | P2 | 切图 | 导出格式与尺寸固定为 JPEG 0.94 / ≤1440，多文件下载依赖浏览器 | M | 否 |
| B10 | P2 | 文字 | 文字块永远占满整宽，无宽度比例/偏移，底色无透明度 | M | 是 |
| B11 | P2 | 持久化 | 每次样式编辑全量重写整个资源库 | M | 是 |
| B12 | P1 | 资源 | 打开已保存长图必然另存为新副本，无法更新原图 | M | 否 |
| B13 | P2 | i18n | 若干错误文案硬编码中文，未走 i18n | S | 否 |
| B14 | P2 | 无障碍 | 图层条目嵌套可交互元素；键盘无法重排 | M | 否 |
| B15 | P2 | 排版 | 字体未就绪时测量，预览与导出换行可能不一致 | S | 否 |
| B16 | P2 | 工程 | 无组件级测试；无 ErrorBoundary | M | 否 |

---

## 2. 用户已提出的 7 项（详述）

### A1 · 插入文字时不保存上次选的配置

**现状证据**

- `src/tools/StitchTool.tsx:138-145` `insertText()` → `createTextBlock(t('text.defaultCard'))`
- `src/lib/defaults.ts:14-30` `createTextBlock` 与 `:32-54` `createPhotoOverlay`：字体、字号、颜色、行距、内边距**全部硬编码**，无外部初值入口。
- 没有任何「最近使用样式」的持久化记录（`storage.ts` 只有 `drafts` / `assets` 两类数据）。

**影响**

- 一张长图通常有 3–8 个文字块。每加一块都要重设字体、字号、颜色、行距 → 单次排版重复 20+ 次操作。
- **副作用放大 A2**：`insertText()` 每次都 `setAssets([...current, text])`（`StitchTool.tsx:141`），每插入一个文字块就往资源库追加一条同质记录。文字块越多，资源列表越长。

**建议**

1. 在 IndexedDB 增加 `prefs` 键，保存 `lastTextStyle` / `lastOverlayStyle`；新增文字块与新增图片文字时以此为初值，编辑后回写。改动集中在 `defaults.ts` + `storage.ts` + 两个调用点，不需要迁移既有数据。
2. 增加「复制图层」「复制样式 / 粘贴样式」两个动作（长图排版的高频需求，且**不产生新资源**）。
3. `insertText` 不再无条件写入资源库；改为显式「存为文字模板」按钮，或在资源侧按内容去重。

**验收**：设好一套样式 → 新增 3 个文字块 → 三块样式一致；刷新页面后新增仍继承；资源库条目不因插入文字而增长。

---

### A2 · 资源管理界面在图多时会很长

**现状证据**

- `src/styles.css:453` `.asset-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }` —— 固定 3 列，容器是 392px 的右侧工作区，单块约 110px。
- `src/components/ResourcePanel.tsx:71-82` 全量 `map` 渲染，无分页、无虚拟滚动、无搜索、无筛选、无分组。
- `src/components/ResourcePanel.tsx:69-95`：已导入资源与已保存长图**在同一个滚动容器内上下堆叠**，两类内容互相挤压。

**量化**：100 张图 ≈ 34 行 ≈ 屏幕高度的 6–8 倍；每块含 1 个 `<img>`、5 个按钮、1 个 objectURL。

**建议**

1. 资源区与「排版好的长图」区改为两个可折叠分段，各自独立滚动。
2. 顶部加**搜索框**（匹配图片名 / 文字内容 / 长图名）与**类型筛选**（图片 / 文字 / 封面组合）。
3. 缩略图列数改为自适应 `repeat(auto-fill, minmax(72px, 1fr))`，并提供 2 列 / 3 列 / 4 列切换。
4. 数量 > 60 时启用窗口化渲染（只渲染视口内条目）。
5. 排序选项：导入时间 / 名称 / 尺寸。

**验收**：导入 200 张图，资源区滚动高度不超过 2 屏；输入关键字能即时收敛到目标项。

---

### A3 · 资源不支持重命名

**现状证据**

- 全仓库检索 `rename` / `重命名` 无任何命中。
- 图片资源名来自 `file.name`（`src/lib/canvas.ts:359`），文字资源名即文字内容（`src/components/ResourcePanel.tsx:42`），长图名由模板自动编号（`StitchTool.tsx:249` `长图 {{number}}`、`CoverTool.tsx:71` `封面长图 {{number}}`）。
- **导出文件名直接取自资源名**：`src/lib/resourceExport.ts:30-33` `resourceFileName()`。

**影响**

- 相机导出文件名形如 `IMG_20260103_141233.jpg`，无法整理成可读名称。
- 多张长图只能叫「长图 1 / 2 / 3」，无法区分是哪次旅行。
- 由于导出文件名继承资源名，**用户连导出文件都无法命名**。

**建议**

1. `ImportedAsset` 与 `SavedComposition` 增加可选 `displayName?: string`（保留原 `name` 作为回退，避免破坏既有导出与 i18n 占位符逻辑）。
2. 资源卡片与长图卡片支持**行内重命名**：双击名称或点铅笔图标 → 就地输入框 → 回车提交 / Esc 取消。
3. 名称校验：去首尾空白、限制 80 字符、禁止路径分隔符（与 `resourceFileName` 的清洗规则对齐）。

**验收**：重命名一张图片为「洱海日落」→ 卡片与导出文件名均为「洱海日落.png」；刷新后保留。

---

### A4 · 无分类管理

**现状证据**

- `src/types.ts:70` `ImportedAsset`、`:110` `SavedComposition` 均无 `groupId` / `tags` 字段。
- `src/lib/storage.ts:94-102` 只按 `composition:` 前缀列出长图，无分组索引。

**影响**

- 一次旅行导入 50–200 张，多次行程的素材全部混在一个网格里。
- 与 A2 是同一个问题的两个根因：**没有分层，只有一条平铺列表**。

**建议**

1. 新增 `ResourceGroup { id, name, createdAt }`，资源与长图各带可选 `groupId`。
2. 资源面板改为「分组 → 资源」两级；分组支持折叠、重命名、删除（**删除分组只解绑，不删资源**）。
3. 导入时可指定目标分组；卡片支持「移动到分组」（含批量）。
4. 旧数据兼容：无 `groupId` 一律归入「未分组」，不写迁移脚本也能读。

**验收**：建两个分组各放 10 张图，折叠其中一个后列表长度减半；删除分组后资源仍在「未分组」中。

---

### A5 · 长图插入文字不方便

**现状证据**

- `src/tools/StitchTool.tsx:379-387` `.layer-bottom-actions`：**只有底部一个**「添加文字」入口。
- `src/lib/stitchLayout.ts:56-83`：排版按 `blocks` 顺序自上而下堆叠，无「插入到第 N 层之后」的入口。
- `src/tools/StitchTool.tsx:161-170` `move()` 每次只与相邻一格交换 → 把第 30 层挪到第 1 位需要点 29 次「上移」。
- `DESIGN.md:127` 明文规定「One insertion edge」，是这条摩擦的设计来源。
- 移动端：`StitchTool.tsx:338-341` 用 HTML5 `draggable`，**触屏不触发**，排序完全依赖上/下按钮。

**建议**

1. 恢复层间插入：在图层列表相邻两层之间显示 hover / focus 时才出现的「+ 插入文字」（样式 `.insert-text` 已存在且移动端已适配，`styles.css:134-135, 307`，仅缺组件引用），并同步修订 `DESIGN.md:127` 为「插入入口按需出现，非常驻」。
2. 调整栏增加「插入到选中图层之后」按钮，覆盖键盘与触屏路径。
3. `move()` 增加「移到顶部 / 移到底部」；长按上下按钮支持连续快速移动。
4. **移动端排序**改为 pointer-based 拖拽（或引入 dnd-kit），并提供「长按 300ms 进入排序模式」的替代路径。

**验收**：在两张图之间插入文字 ≤ 2 次操作；触屏上能把第 1 层拖到末尾。

---

### A6 · 双图并列逻辑不好

**现状证据**

- `src/lib/composer.ts:51-80` `pairPhotoWithNeighbor()`：只在**紧邻**的两张 `photo` 之间成行（优先取下一张，否则取上一张）；否则返回 `row: null`。
- `src/types.ts:54` `photos: [PhotoBlock, PhotoBlock]` —— **固定二元组**，结构上就决定了只能两图。
- `src/lib/composer.ts:74`：新行的 `heightRatio` 写死 `62`、`gap` 写死 `0`。
- 行内两张图**没有换序入口**；不能把两张不相邻的图并排；不能把已有行与另一张图合并；`splitPhotoRow` 只支持拆开。
- `StitchTool.tsx:218-230` `pairSelectedPhoto`：失败时只给一个 toast，不提示为什么。

**影响**：用户想做「第 1 张和第 5 张并排」时，只能先把第 5 张反复上移 4 次；想 3 图并排做不到；想交换左右顺序做不到。

**建议**

1. **多选 + 并列**：图层列表支持 Ctrl/Cmd 点击多选，动作变为「并列所选 N 张」；`photos` 由二元组改为 `PhotoBlock[]`，列数 = 数组长度。
2. 行内支持拖拽换序（与 A5 的排序实现共用）。
3. 行高默认值改为按所选图片的自然宽高比推导，不再写死 62%。
4. 新增布局模式：等分 / 主次（如 2:1 宽窄），作为行容器属性。
5. 失败时给出可操作提示（例如「请先选中两张图片」并高亮可选对象）。

**数据迁移**：`PhotoRowBlock.photos` 二元组 → 数组。旧草稿读取时数组天然兼容，**写入侧需保证长度 ≥ 2**；`DB_VERSION` 2 → 3 时跑一次规范化（把 `photos.length === 1` 的行拆成独立图层，与 `removeAssetFromBlocks` 现有行为一致）。

**验收**：选中第 1 张与第 5 张 → 一次操作成行且保持原有相对顺序；行内可换序；可组成 3 图一行。

---

### A7 · 编辑图片界面没有裁切功能

**现状证据**

- `CropEditor`（含预览 + 缩放/焦点滑杆 + 重置）**只在两处使用**：`src/tools/CoverTool.tsx:109`、`src/tools/GridTool.tsx:77`。
- 长图「调整」栏只有 4 个滑杆，没有可视化裁切：`src/tools/StitchTool.tsx:425-429`（`frameHeight` / `cropZoom` / `cropX` / `cropY`）。
- `PhotoTextEditorModal` 全文无裁切相关代码（左侧只有图片 + 文字框）。

**附带的功能性缺陷（重要）**

- `cropZoom` 上下限被写死为 `min={1} max={4}`（`StitchTool.tsx:427`、`CropEditor.tsx:34`），`geometry.ts:32` 亦 `clamp(crop.zoom, 1, 4)` → **无法缩小到「完整显示 + 留白」**。
- `src/lib/geometry.ts:32-40`：`sw = baseWidth / zoom`，`maxX = sourceWidth - sw`。**当 `zoom === 1` 时 `maxX === 0`，水平/垂直焦点滑杆完全无效**——用户拖动没有任何反馈，也没有提示。这是一个静默失效的控件。

**建议**

1. 把 `CropEditor` 引入 `StitchTool` 的「调整」栏，替换纯滑杆；`PhotoTextEditorModal` 改为「左：图片 + 裁切框叠加层，右：属性面板」的两栏结构。
2. 预览上直接支持 **拖拽平移 + 滚轮/双指缩放**（pointer events + `touch-action: none`），滑杆保留为精调。
3. 解决 zoom 下限问题：引入 `fit: 'cover' | 'contain'` 模式，或把下限放宽到 `0.2`，并在 `contain` 模式下用背景色填充留白。同时让焦点滑杆在无位移空间时禁用并给出说明，而不是静默无效。
4. 增加宽高比预设（原图 / 1:1 / 4:5 / 3:2）与 90° 旋转、水平镜像。
5. `CropEditor` 本身也要补触屏手势（当前仅有滑杆）。

**验收**：在长图里拖动图片即可改变取景；`contain` 模式下能完整看到整张图；焦点滑杆在任何状态下都有可见效果或明确禁用态。

---

## 3. 侦察中额外发现（用户未提）

### B1 · 删除无确认、无撤销（P0）

- `ResourcePanel.tsx:81`：资源卡片删除直接 `library.setAssets(current => current.filter(...))`，无确认。
- `ResourcePanel.tsx:58-61` `removeSaved()`：删除已保存长图，无确认。
- 反差点：`StitchTool.tsx:258, 268` 反而用了原生 `window.confirm`——**交互不一致**，且原生弹窗不符合 `DESIGN.md` 的自定义组件体系。
- 资源里存的是**导入时转换后的 PNG 与全部编辑参数**（裁切、图片文字、样式），删除即不可恢复。

**建议**：统一为自研确认对话框（危险动作走 coral-guide 色）；删除资源后提供 5 秒「撤销」toast；全部 `window.confirm` 替换掉。

### B2 · 打开图片文字编辑器会自动创建文字层（P1）

`StitchTool.tsx:239-242` `openPhotoTextEditor()`：没有 overlay 时先写入 `createPhotoOverlay(...)` 再打开。用户按 Esc 或点关闭 → 文字层已经存在，且已通过 `updatePhoto` → `saveEditedAsset` 同步进资源模板。

**建议**：编辑器内部持有草稿状态，点「完成」才提交；取消即丢弃。

### B3 · 「删除」按钮语义含混（P1）

`StitchTool.tsx:415, 423` 的删除调用 `removeAsset()`，只从画布移除图层，**不删资源**；但按钮文案是 `common.delete`「删除」。用户无法预期结果。

**建议**：改为「从画布移除」；资源侧改为「从资源库删除」；或收敛为一个带说明的删除菜单。

### B4 · 导入超过 40 张被静默截断（P0）

`StitchTool.tsx:125` `files.slice(0, 40)` —— 用户选 60 张只进 40 张，**无任何提示**。

**建议**：改为分批队列导入并显示进度；或至少在截断时 toast「已导入 40 张，其余 20 张未导入」。

### B5 · 重复导入无去重（P2）

同一文件多次导入会生成多份 Blob 与多条资源记录。建议按 `name + size + lastModified` 指纹提示重复，或提供「合并到已有资源」。

### B6 · 无撤销 / 重做（P2）

全仓库无历史栈；滑块拖动、删除、排序全部即时写入并 650ms 防抖落盘（`StitchTool.tsx:98-108`）。建议引入轻量快照栈（`{blocks, settings}`，上限 ~50 步），绑定 `Ctrl/Cmd+Z`、`Shift+Ctrl/Cmd+Z`。

### B8 · 切图切换张数会重置裁切（P2）

`GridTool.tsx:82` 的 `onClick` 里 `setCount(value); setCrop(DEFAULT_CROP)` —— 在 4 / 6 / 9 之间比较效果时每次取景都归零。建议保留 crop，仅在比例变化时按新 aspect 归一化。

### B9 · 切图导出固定（P2）

`canvas.ts:290-326`：硬编码 `image/jpeg, 0.94`，`tileSize` 上限 1440（`:299`）；4/6/9 张依赖浏览器允许多文件下载，失败只有一条 toast（`README.md:62` 亦承认）。建议增加 PNG 选项、尺寸选择（1080 / 1440 / 原图），以及「打包 ZIP 下载」或「先导出一张带编号的拼版预览」。

### B10 · 文字块布局能力有限（P2）

`stitchLayout.ts:72` 文字块永远用 `width - padding*2` 换行、`x` 固定为 `settings.padding` → **无法做窄栏、缩进、左右分栏**；文字块高度由内容决定，**无法在图片之上叠加**（overlay 只能挂在单张 photo 内部）；`padding` 仅上下（`stitch.verticalPadding`）；底色无透明度。建议文字块增加宽度比例与水平偏移，长图级 overlay 作为进阶项。

### B11 · 持久化全量重写（P2）

- `storage.ts:83-92` `saveImportedAssets()` 每次 `put` 整个 assets 数组；`StitchTool.tsx:98-108` + `useResourceLibrary.ts:33-38` 在 assets 变化后 650ms 全量落盘。
- `assetLibrary.ts:12-22` `saveEditedAsset()` 在**每次滑杆 input 事件**都被调用 → 拖动滑块期间不断排队写整个资源库。
- 图片多时（几十 MB Blob）这是可感知的卡顿来源。

**建议**：资源改为逐条 `put`（`assets` store 用 `keyPath: 'id'` 或沿用 `composition:` 式的键前缀），只有结构性变更才全量；样式编辑的落盘节流到 `pointerup` / 输入停顿。

### B12 · 无法更新已保存的长图（P1）

`StitchTool.tsx:257-265` `openComposition()` 用 `structuredClone` 打开副本，保存必然新建「长图 N」。用户想「更新刚才那张长图」做不到，只能删旧存新 → **版本堆积，直接加剧 A2**。

**建议**：保存时提供「更新原长图 / 另存为新长图」二选一（打开时记录来源 id）。

### B13 · 硬编码中文未走 i18n（P2）

`StitchTool.tsx:126` `'没有可读取的图片'`；`canvas.ts:335` `'浏览器没有生成图片，请降低输出尺寸后重试'`；`storage.ts:23, 47, 62, 75, 90, 100, 119` 多条错误文案。三语用户会看到中文报错。建议补入三份 locale（注意 `zh-CN` 为键名类型来源，需同步 `zh-TW` 与 `en`）。

### B14 · 无障碍细节（P2）

`StitchTool.tsx:342-346`：`role="button"` + `tabIndex=0` 的容器内**又嵌了多个 button**（移动 / 删除 / 子图选择），语义冲突且读屏噪音大；键盘无法重排图层（仅 Enter/Space 选中）。建议改为 `listbox`/`option` 结构，或把内部动作移出容器；补充键盘重排与 `aria-keyshortcuts`。

### B15 · 字体未就绪时的测量差异（P2）

`stitchLayout.ts:6-14` `createTextMeasurer()` 直接建 canvas 上下文测量，**未等待 `document.fonts.ready`**。首屏字体未加载时按回退字体测量换行点，与导出时的换行可能不一致（预览与导出理论上复用同一几何，此处是唯一破例点）。建议启动时 `await document.fonts.ready`，并监听 `fonts.onloadingdone` 触发重排；为「换行结果一致性」补一条断言测试。

### B16 · 工程层面（P2）

无组件级 / 交互测试（现有 7 个测试均为纯函数）；无 ErrorBoundary，一个损坏的 Blob 会让整页白屏。建议至少为 `composer`（多图并列）、`storage`（迁移）补测试，并在 `App` 外层加 ErrorBoundary + 兜底文案。

---

## 4. 建议实施批次

### 批次 1 · 止血（不动数据结构，可独立上线）

`B4` 静默截断 → `B1` 删除确认与撤销 → `B2` 编辑器草稿态 → `B3` 删除文案 → `A1` 样式记忆 → `A7` 裁切界面（含 zoom 下限修复）→ `B12` 更新原长图 → `B13` 硬编码文案。

> 这一批覆盖「用户已明确提出的 3 项」+「2 个 P0」，且全部不需要 IndexedDB 迁移，风险最低。

### 批次 2 · 资源体系重构（一次迁移，统一处理）

`DB_VERSION` 2 → 3，一次性加入：`displayName`（A3）、`ResourceGroup` + `groupId`（A4）、`PhotoRowBlock.photos` 数组化（A6）、资源逐条持久化（B11）。
配套：`A2` 资源面板的搜索 / 筛选 / 分段 / 列数切换。

> A2 的「长」与 A3 / A4 的「找不到」是同一根因（平铺列表 + 无元数据），必须一起做，否则搜索框没有可搜的字段。

### 批次 3 · 图层与排版

`A5` 层间插入 + 移动端拖拽排序（含修订 `DESIGN.md:127`）→ `A6` 多选并列 / 行内换序 / 3 图行 → `B6` 撤销重做 → `B10` 文字块宽度与偏移。

### 批次 4 · 打磨

`B5` 去重、`B8` 切图裁切保持、`B9` 导出格式与打包、`B14` 无障碍、`B15` 字体测量、`B16` 测试与 ErrorBoundary。

---

## 5. 每项改动的通用验收要求

1. `npm test` 与 `npm run build` 必须同时通过（`build` 会跑 `tsc -b`，会校验三份 locale 键名一致性）。
2. 新增 i18n 键必须三语齐全（`zh-CN` 是类型来源，先改它）。
3. 涉及 `ComposerBlock` / `ImportedAsset` 结构变化的，必须验证**旧草稿能正常读取**（`loadStitchWorkspace` 的兼容路径，`storage.ts:27-49`）。
4. 涉及删除/覆盖的动作，必须在提交前用错误路径验证一次（例如故意让 `saveComposition` 抛错，确认不会破坏既有数据 —— `PRODUCT.md:44` 明确要求「读取失败不得覆盖已有浏览器数据」）。
5. 部署是「push main 即上线、无灰度」，改动应小批量合并。
