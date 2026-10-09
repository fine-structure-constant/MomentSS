---
name: 留白拼图
description: 以青色工具轨、编辑画布和专业属性工作区构成的本地旅行图片编辑器
colors:
  rail-cyan: "#8fd7df"
  navy-action: "#163b5d"
  navy-deep: "#0e2b47"
  canvas-warm: "#f4f2ef"
  paper: "#ffffff"
  ink: "#10243d"
  muted: "#707b89"
  line: "#e1e5e8"
  coral-guide: "#ff806c"
  local-green: "#19835c"
typography:
  display:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "clamp(31px, 4vw, 54px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  rail-selection: "8px"
  control: "8px"
  field: "10px"
  surface: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.navy-action}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "44px"
  tool-rail-active:
    backgroundColor: "{colors.navy-action}"
    textColor: "#ffffff"
    rounded: "{rounded.rail-selection}"
  property-tab-active:
    backgroundColor: "#ffffff"
    textColor: "{colors.navy-action}"
    underline: "2px solid {colors.navy-action}"
---

# Design System: 留白拼图

## Creative North Star

**“海边冲印工作室”**：方向 2 是新的视觉权威。青色竖向工具轨提供鲜明识别，暖灰画布让图片成为主角，白色右侧属性工作区负责专业而克制的编辑操作。它借鉴 Adobe 系列“工具—画布—属性”的心智模型，但不复制桌面软件的复杂密度。

旧的暖白三栏工作台已被取代；产品事实、三项工具、本地处理、响应式能力和 i18n 不变。

## Layout

- 桌面使用 86px 青色工具轨、72px 顶部项目栏、弹性中央画布和 350–392px 右侧工作区。
- 长图模式的右侧工作区顶部固定三个菜单：资源、图层、调整。内容区独立滚动，“保存长图”固定在底部，PNG / JPG 导出放在对应资源中。
- 资源面板将上传与文字卡片收敛成紧凑双按钮，下面用每行三个的资源格展示已导入图片和文字容器；每项可查看、加入画布、删除或导出。已保存长图以独立列表展示，支持结构化查看、继续排版、制作封面和 PNG / JPG 导出。
- 已导入资源是独立持久化的附件库。删除资源不删除画布图层，清空草稿不清空资源；点击资源可以再次添加独立图层。新增图片和文字保持当前栏目。
- 编辑图层时，其完整文字格式或图片裁切、文字叠加的结构化数据同步到对应资源，作为再次加入画布的最新模板；已经加入的其他副本保持独立。图片资源卡片显示文字摘要。旧草稿首次加载补回未同步的编辑；多个不同副本缺少历史时间信息时，以画布顺序中最后一个修改过的副本补回。
- 上传控件允许 HEIC / HEIF / HIF 文件，转换过程使用现有按钮显示“正在读取…”并暂时禁用重复选择。共享导入模块在本地转换为 PNG，原文件名继续显示在资源卡片；不改变方向 2 的排版。
- 图层面板负责顺序、选择、移动、插入和删除；图层条目保持 2–3px 的紧凑矩形轮廓。相邻两层之间提供 hover / focus 时才出现的“插入文字”入口（`.insert-text`），列表底部另有常驻动作条负责追加文字与组合双图；图层条目内的移动到顶 / 底与删除同样保持常驻。
- 全局输出宽度、间距、外侧留白与背景归属图层栏目；导出格式在资源中选择。调整栏目顶部用缩略图、名称、图层编号和双图子图片编号标识当前对象。
- 图片容器可调整高度、内部缩放和水平/垂直焦点，取景控件由 `CropFields` 统一提供，长图调整栏与图片文字弹窗共用同一套缩放 / 焦点 / 重置控件；某个方向在当前比例下没有可移动余量时，该滑杆置为禁用并给出说明，而不是留一个无反应的控件。文字容器保留字体、颜色、字号、角度、行距与留白。
- 任意两张独立图片可组合为一行两列（不要求相邻），行高默认由两张图的长宽比推导，并可在行容器上继续调整；行高和列间距属于行容器，行内两张图可互换左右，每张图片的裁切与图片文字仍独立。
- 900px 以下，工具轨变为固定底部导航，中央画布先出现，右侧工作区随后成为全宽纵向编辑区。
- 封面模式桌面将资源选择放在属性栏顶部，参数区独立滚动；手机先选择长图和单图，再查看预览及参数。整体长图预览有滚动边界，“查看封面”切换局部放大并滚动到可视位置。

## Color Roles

- **Rail cyan**：唯一大面积品牌色，只用于全局工具导航。
- **Navy action**：当前工具、当前属性菜单、滑杆和主要保存动作。
- **Warm canvas**：承托输出画布，避免纯白界面失去层级。
- **White paper**：顶部项目栏、右侧属性工作区和表单。
- **Coral guide**：仅用于画面定位、危险状态或非常克制的视觉提示，不承担主按钮。
- **Local green**：仅表达本机处理、成功和安全状态。

## Typography

界面继续使用 Avenir Next 与稳定中文现代黑体回退。空状态标题紧凑、厚重；工具标签和属性标题保持清晰。字距下限为 -0.04em。手机输入控件不低于 16px，英语长文案允许自然换行。

## Components

### Global tool rail

图标与短标签垂直排列，当前工具使用深海军蓝实底。桌面不依赖 hover 才能识别状态；移动端保持同一语义并转为底部导航。

### Right-side workspace

三个菜单使用图标、文字和 2px 下划线表达当前状态。菜单栏与保存栏不随属性内容滚动。不得把资源、图层和对象属性重新堆成一个连续长表单。

### Canvas and previews

输出画布保持真实矩形比例，使用单一柔和环境影。裁切线、容器裁切和图片文字坐标必须与实际 Canvas 导出一致。

长图预览使用结构化 HTML 图片容器与 SVG 文字，复用 `stitchLayout.ts` 的排版、换行、裁切与文字容器几何；不再绘制整张预览 Canvas。点击图片、文字或双图行进入局部放大，保留右侧调整工作区，可返回长图、切换相邻图层或按 Escape 返回。图片与旋转文字在所属容器范围内裁切，预览和导出遵循相同边界。

图片文字的文字、底色、内边距、边框和圆角是同一个几何容器，旋转必须作用于整体，而不是只旋转字形。

资源查看弹窗复用结构化预览；可局部放大，Escape 先返回整体、再次关闭。弹窗限制键盘焦点，关闭后返回触发按钮。PNG / JPG 导出使用对应资源的完整结构化快照。

封面由已保存长图与单图组合，在完整图层边界插入全宽正方形，保留双图行与文字容器。系统以外侧留白平衡中心位置，预览与导出复用 `coverLayout.ts`；结果保存原图层、设置及封面配方，无需切开原图。取景、插入边界、周围留白与背景均可再次调整。

### Controls

按钮和字段使用 8–10px 圆角；胶囊只用于极小状态。主要按钮为海军蓝，次按钮白底发丝线。键盘焦点使用青色高对比外圈。

文字内容框右侧提供带 Smile 图标的 Emoji 按钮；选择器内联展开，含搜索、五类常用表情和最近使用。表情网格按钮不小于 44px，结果区独立滚动；无结果时提供搜索建议。插入或替换选中文字后收起并将焦点、光标返回文字框，Escape 优先关闭选择器，保留图片文字弹窗。文字卡片切换图层时重置选择器状态。

Emoji 使用 Unicode 文字与设备原生字体，不引入图片表情库。共享排版按字素处理家庭、肤色、旗帜和变体选择符，避免预览或导出在组合序列中间换行；最近使用只保存到当前浏览器。

## Named Rules

**One rail, one canvas, one property space.** 全局工具、结果和属性各占明确区域，不以同权重卡片竞争。

**Container before decoration.** 先调整图片或文字容器本身，再进入图片文字等内部装饰；画布设置永远单独分组。

**Insertion on demand.** 插入入口按需出现：图层之间只在 hover / focus 时显示“插入文字”，不做常驻的重复按钮；追加与组合双图由底部常驻动作条承担。

**Local stays visible.** 本地处理状态必须在顶部或移动隐私条中可见。

## Do / Don’t

- Do 保留大画布、清晰图层选择和稳定属性菜单。
- Do 让选中图层与属性面板共享同一选择状态。
- Do 在桌面锁定画布与右侧栏的独立滚动边界。
- Don’t 模仿 Adobe 的全部密度、浮动窗口或隐藏手势。
- Don’t 用青色同时填满画布、按钮和状态；青色大面积只属于工具轨。
- Don’t 让移动底部导航遮住最后一个可操作控件。
