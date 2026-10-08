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
- 长图模式的右侧工作区顶部固定三个菜单：导入、图层、调整。内容区独立滚动，保存与下载动作固定在底部。
- 导入面板将上传与文字卡片收敛成紧凑双按钮，下面用每行三个的资源格展示已导入图片和文字容器。
- 图层面板负责顺序、选择、移动、插入和删除；图层条目保持 2–3px 的紧凑矩形轮廓，只在列表底部提供添加文字与双图横排动作。
- 图片容器可调整高度、内部缩放和水平/垂直焦点；文字容器保留字体、颜色、字号、角度、行距与留白。
- 相邻两张独立图片可组合为一行两列；行高和列间距属于行容器，每张图片的裁切与图片文字仍独立。
- 900px 以下，工具轨变为固定底部导航，中央画布先出现，右侧工作区随后成为全宽纵向编辑区。

## Color Roles

- **Rail cyan**：唯一大面积品牌色，只用于全局工具导航。
- **Navy action**：当前工具、当前属性菜单、滑杆和主要下载动作。
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

三个菜单使用图标、文字和 2px 下划线表达当前状态。菜单栏与下载栏不随属性内容滚动。不得把导入、图层和对象属性重新堆成一个连续长表单。

### Canvas and previews

输出画布保持真实矩形比例，使用单一柔和环境影。裁切线、容器裁切和图片文字坐标必须与实际 Canvas 导出一致。

图片文字的文字、底色、内边距、边框和圆角是同一个几何容器，旋转必须作用于整体，而不是只旋转字形。

### Controls

按钮和字段使用 8–10px 圆角；胶囊只用于极小状态。主要按钮为海军蓝，次按钮白底发丝线。键盘焦点使用青色高对比外圈。

## Named Rules

**One rail, one canvas, one property space.** 全局工具、结果和属性各占明确区域，不以同权重卡片竞争。

**Container before decoration.** 先调整图片或文字容器本身，再进入图片文字等内部装饰；画布设置永远单独分组。

**One insertion edge.** 图层列表只在底部新增文字或组合双图，不在每个图层之间重复插入动作。

**Local stays visible.** 本地处理状态必须在顶部或移动隐私条中可见。

## Do / Don’t

- Do 保留大画布、清晰图层选择和稳定属性菜单。
- Do 让选中图层与属性面板共享同一选择状态。
- Do 在桌面锁定画布与右侧栏的独立滚动边界。
- Don’t 模仿 Adobe 的全部密度、浮动窗口或隐藏手势。
- Don’t 用青色同时填满画布、按钮和状态；青色大面积只属于工具轨。
- Don’t 让移动底部导航遮住最后一个可操作控件。
