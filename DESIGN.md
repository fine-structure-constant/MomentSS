---
name: 留白拼图
description: 明亮、克制、以结果画布为中心的本地旅行照片工作台
colors:
  sunlit-paper: "#fffefa"
  worktable: "#f3f1ec"
  ink-navy: "#10223d"
  quiet-slate: "#687485"
  hairline: "#dfe3e4"
  hairline-strong: "#c8d0d4"
  action-coral: "#ff6256"
  action-coral-deep: "#cc3f37"
  action-coral-pale: "#fff0ec"
  pool-blue: "#75c6d2"
  pool-blue-deep: "#16778a"
  pool-blue-pale: "#eaf8fa"
  guide-citrus: "#f4cf68"
  local-green: "#19835c"
typography:
  display:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "clamp(30px, 4vw, 54px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  body:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif'
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  image-sm: "8px"
  field: "10px"
  control: "12px"
  surface: "14px"
  dropzone: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-coral}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-coral-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "44px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.field}"
    padding: "0 11px"
    height: "42px"
  tool-tab-active:
    backgroundColor: "{colors.action-coral-pale}"
    textColor: "{colors.action-coral-deep}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "42px"
---

# Design System: 留白拼图

## Overview

**Creative North Star: "阳光下的照片工作台"**

留白拼图像一张被自然光照亮的编辑桌：照片和结果画布是主角，控制项密集但不压迫。暖白与浅灰负责安静承托，墨水海军蓝保证信息清楚，珊瑚色只在选择、中心定位和主要动作上出现。

视觉语言借鉴影像社交产品的克制和留白，但拒绝通用上传仪表盘的卡片堆叠，也不做会遮蔽实用工具的装饰性手账。桌面让顺序、结果与调整同时可见；手机把结果提前，并把操作改成自然的纵向阅读顺序。

**Key Characteristics:**

- 明亮暖白的工作底色，墨水色高对比文字。
- 杏珊瑚负责动作，泳池蓝负责选择与隐私状态。
- 结果画布优先，控件使用清晰边界与柔和圆角。
- 中部正方形取景框是唯一反复出现的签名几何。

## Colors

色彩像旅行日光下的冲印台：中性底色稳定，珊瑚与泳池蓝负责少量但明确的功能信号。

### Primary

- **动作珊瑚**：用于主要下载按钮、当前选项和中心定位；深色变体只用于悬停与强调，浅色变体承托已选状态。

### Secondary

- **泳池蓝**：用于隐私、选择辅助和信息提示；深色承担文字与交互，浅色承担安静的状态底。

### Tertiary

- **引导柑橘**：仅用于轻量提示与文本选择，不与主操作争夺注意力。

### Neutral

- **日光纸白**：侧栏与控制面的主背景。
- **工作台灰**：画布周围的工作区底色。
- **墨水海军蓝**：正文、标题和深色提示的主要文字色。
- **安静石板灰**：次要说明、尺寸和值标签。
- **发丝分隔线**：面板和字段边界，强变体用于可交互控件。

### Named Rules

**The Coral Action Rule.** 珊瑚色只标记“现在可做”的主动作或当前选择；同一视区不制造第二个同等权重的珊瑚按钮。

**The Local Blue Rule.** 泳池蓝只表达安全、本地处理、辅助选择或非破坏性信息，不替代主操作色。

## Typography

**Display Font:** Avenir Next（中文回退为 PingFang SC / Microsoft YaHei UI）  
**Body Font:** Avenir Next（中文回退为 PingFang SC / Microsoft YaHei UI）  
**Label Font:** Avenir Next（品牌字标可使用 ui-rounded）

**Character:** 字体宽度现代、笔画清朗；大标题通过紧字距形成影像杂志感，小标签则保持克制、清楚和可扫读。

### Hierarchy

- **Display**（700、响应式 30–54px、1.05）：空状态与工具开场标题。
- **Headline**（700、24px、1.2）：裁切与工具任务标题。
- **Title**（700、20px、1.2）：品牌字标。
- **Body**（400、13px、1.65）：说明、恢复建议和诚实提示，正文宽度通常控制在约 56–62ch。
- **Label**（700、12px、0.04em）：字段名、画布状态与紧凑元信息。

### Named Rules

**The Designed Chinese Rule.** 中文优先使用平台上稳定的现代黑体或圆体回退，不以浏览器默认衬线体承担界面层级。

## Layout

桌面长图编辑器是三栏工作台：顺序栏约 260–310px，中间画布弹性扩展，属性栏约 280–350px。封面工具保持裁切、合成预览、动作三段关系；切图工具保持主取景区与窄动作栏。常用内边距以 16、20、24px 为节奏，面板之间用 1px 分隔线而不是额外卡片包裹。

1120px 以下收紧侧栏；860px 以下进入移动流程，画布或裁切结果先出现，当前工具第二，顺序或导出动作最后；540px 以下将主要面板内边距收至 16px。交互目标最小高度为 42–44px，页面最小宽度为 320px。

## Elevation & Depth

系统以平面分区为主，阴影只帮助结果画布、裁切预览和浮动提示从工作台上抬起。面板自身靠底色与发丝线建立层级，不把每个区域做成悬浮卡片。

### Shadow Vocabulary

- **画布环境影**（`0 14px 34px rgba(18, 37, 60, 0.11)`）：长图、裁切和合成预览。
- **轻量浮层影**（`0 6px 18px rgba(18, 37, 60, 0.09)`）：紧凑浮层或临时强调。
- **主动作暖影**（`0 7px 18px rgba(255, 98, 86, 0.22)`）：仅主按钮使用。

### Named Rules

**The Flat Workbench Rule.** 面板静止时保持平面；只有真实叠放在工作台之上的结果与临时状态获得阴影。

## Shapes

照片缩略图使用 8px 圆角，字段 10px，常规控件 12px，结果预览和状态面 14px，上传区 16px。胶囊只用于尺寸或状态徽标。照片主体始终保留矩形边缘，避免用过度圆润削弱影像的版面感。

## Components

### Buttons

- **Shape:** 明确但不夸张的控制圆角（12px），最小高度 44px。
- **Primary:** 珊瑚底、白字、水平内边距 17px；主下载动作可占满动作栏宽度。
- **Hover / Focus:** 悬停转为深珊瑚；键盘焦点使用 3px 半透明深泳池蓝外圈并留 3px 间距。
- **Secondary / Ghost:** 次按钮使用白底与强分隔线；文本按钮只保留深泳池蓝文字。

### Cards / Containers

- **Corner Style:** 工作面板不加卡片圆角；上传区与提示面分别使用 16px 和 14px。
- **Background:** 面板为纸白，中央工作区为工作台灰。
- **Shadow Strategy:** 仅结果画布与预览使用环境影。
- **Border:** 1px 发丝分隔线，上传区使用 1.5px 虚线。
- **Internal Padding:** 主要采用 16–24px。

### Inputs / Fields

- **Style:** 白底、强发丝线、10px 圆角；选择框最小高度 42px。
- **Focus:** 统一的深泳池蓝半透明外圈，不只依赖颜色变化。
- **Disabled:** 降低至约 45% 不透明度，并移除按钮阴影。

### Navigation

顶部工具切换以图标加文字呈现，当前项使用浅珊瑚底与底部珊瑚线。移动端变为图标在上、短标签在下的 44px 触控目标，品牌保持在左侧。

### 中部方形取景框

封面与切图预览都使用精确白色分割线和右下角深色尺寸徽标；它是产品识别度最高的操作图形，必须与实际导出几何一致。

## Do's and Don'ts

### Do:

- **Do** 让照片或结果画布在每个工具中占据最大视觉面积。
- **Do** 使用珊瑚标记唯一主要动作，并用泳池蓝表达本地、安全和辅助状态。
- **Do** 在 860px 以下把画布排到控制项之前，并保持至少 44px 的关键触控目标。
- **Do** 对第三方平台行为与浏览器画布限制使用清楚、可恢复的中文提示。

### Don't:

- **Don't** 把工作区拆成一组彼此竞争的通用圆角卡片。
- **Don't** 使用渐变文字、玻璃拟态、装饰性强阴影或手账贴纸遮盖实际编辑关系。
- **Don't** 把珊瑚和泳池蓝同时用于两个并列的主按钮。
- **Don't** 为追求“手机适配”而简单缩小桌面三栏；必须改为画布优先的纵向顺序。
