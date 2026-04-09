# PrintFit 一页印

> Inspired by [@VladArtym](https://x.com/VladArtym) — [原始推文](https://x.com/VladArtym/status/2038368243115610351)

自适应单页打印工具 —— 粘贴 Markdown，自动缩放字体，让所有内容刚好填满一张 A4 纸。

----
## 核心特性

- **自动字号适配**：二分查找最大可用字体，内容多则缩小、内容少则放大，始终填满一页
- **实时预览**：所见即所得的 A4 页面预览，默认 100% 适配屏幕
- **预览交互**：`⌘+滚轮` 缩放（30%~300%）、鼠标拖拽平移、双击重置
- **10 种主题**：经典 / 暖纸 / 学术 / 杂志 / 锤子便签 / 暗夜 / 薄荷 / 水墨 / 科技 / 牛皮纸
- **9 个内置示例**：简历、会议议程、考试速查表、读书笔记、项目周报、产品说明卡、活动传单、菜单、求职信
- **丰富的排版控制**：字体、页边距、行高、段落间距、首行缩进均可调节
- **中文字体支持**：思源黑体、思源宋体、霞鹜文楷、站酷小薇体等
- **一键打印**：`⌘P` 直接输出标准 A4 PDF

## 技术栈

| 技术 | 用途 |
|------|------|
| [Pretext](https://github.com/chenglou/pretext) | Canvas 文本测量，无 DOM reflow |
| [marked](https://github.com/markedjs/marked) | Markdown 解析 |
| Vite + TypeScript | 构建与类型安全 |
| Google Fonts | 中英文字体加载 |

## 快速开始

```bash
bun install
bun run dev
```

浏览器打开后，在左侧编辑内容，右侧即时预览 A4 效果。按 `⌘P` 打印或导出 PDF。

## 使用说明

### 基本使用流程

1. 在左侧“页面编辑区”输入或粘贴 Markdown 内容
2. 右侧会实时生成对应的 A4 预览
3. 在下方“样式设置”中调整主题、字体、页边距、行高、段落间距和首行缩进
4. 确认预览无误后，点击右上角“打印”或直接按 `⌘P`

### 多页编辑

- 默认会创建 1 页
- 点击 `+ 添加页面` 可新增一页独立内容
- 每一页都有独立的 Markdown 编辑区和对应的 A4 预览页
- 点击页面卡片右上角“删除”可移除当前页（至少保留 1 页）
- 顶部状态栏会显示当前总页数

### 打印说明

- 打印时会按每个预览页输出为独立 A4 页面
- 建议在浏览器打印对话框中保持纸张为 **A4**
- 如果浏览器提供缩放选项，建议使用默认值，避免额外缩放破坏版式
- 导出 PDF 时，效果与右侧预览页保持一致
- **推荐使用 Chrome 浏览器导出 PDF**：Firefox 的"另存为 PDF"会将文字栅格化为图片，导致 PDF 中文字无法选中/复制；Chrome 导出的 PDF 文字为可选中、可复制的标准文本

## Docker / Podman

> 以下镜像与自动发布流程由本 fork 维护，不代表上游仓库的官方发布。

### 直接拉取并运行

```bash
docker pull docker.io/masonsxu/printfit:latest
docker run --rm -p 8080:80 docker.io/masonsxu/printfit:latest
```

或使用 Podman：

```bash
podman pull docker.io/masonsxu/printfit:latest
podman run --rm -p 8080:80 docker.io/masonsxu/printfit:latest
```

如果需要固定版本，也可以直接拉取 tag：

```bash
docker pull docker.io/masonsxu/printfit:1.0.0
podman pull docker.io/masonsxu/printfit:1.0.0
```

打开 `http://localhost:8080` 即可访问。

说明：
- 生产镜像使用 **Bun 构建 + nginx 托管静态文件**
- 容器内提供的是构建后的 `dist/`，不是 `vite preview`
- 页面字体依赖 Google Fonts；在无法访问 Google Fonts 的网络环境下会回退到本地字体，可能影响排版测量和打印效果

### 自动发布到 Docker Hub

本 fork 内置了 GitHub Actions workflow：
- `push tag v*.*.*`：推送 `vX.Y.Z`、`X.Y.Z`、`X.Y`、`latest`

需要在 GitHub 仓库设置里配置以下 Secrets：
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

镜像地址：

```text
docker.io/masonsxu/printfit
```

发布正式版本时，创建并推送一个语义化 tag：

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 预览操作

| 操作 | 方式 |
|------|------|
| 缩放 | `⌘` + 鼠标滚轮 |
| 平移 | 鼠标拖拽 |
| 重置缩放 | 双击预览区域 |

### 内置示例

左上角下拉菜单可切换示例模板：简历、会议议程、考试速查表、读书笔记、项目周报、产品说明卡、活动传单、菜单价目表、求职信。

## 工作原理

```
输入 Markdown
  → marked.lexer() 提取文本块
  → Pretext prepare() + layout() 测量每个块的高度
  → 二分查找（6px ~ 72px，精度 0.25px，~8 次迭代）
  → 找到最大字号使总高度 ≤ A4 可打印区域
  → marked.parse() 渲染 HTML + 应用字号到预览
```

## 应用场景

| 场景 | 说明 |
|------|------|
| 个人简历 | 控制在一页，排版专业 |
| 会议议程 / 备忘录 | 一页纸概览，方便打印分发 |
| 教学讲义 / 考试速查表 | 把知识点压缩到一页 |
| 读书笔记摘要 | 一本书的精华浓缩到一页 |
| 项目周报 / 日报 | 固定一页的汇报格式 |
| 产品说明卡 | 硬件产品的快速参考卡 |
| 活动传单 | 快速排版活动信息 |
| 菜单 / 价目表 | 单页价格表 |
| 求职信 / 自荐信 | 配合简历的另一页 |

适用于任何**需要精确控制在一页纸内**的内容。

## 主题预览

| 主题 | 风格 |
|------|------|
| 经典 | 白底黑字，通用默认 |
| 暖纸 | 奶油色底，棕色标题 |
| 学术 | 藏蓝标题，h2 下划线 |
| 杂志 | 红色标题，h1 大写，粗引用线 |
| 锤子便签 | 米白底，红褐色标题，虚线分隔 |
| 暗夜 | 深蓝黑底，金色标题 |
| 薄荷 | 淡绿底，翠绿标题 |
| 水墨 | 宣纸色底，纯黑标题，大字距 |
| 科技 | 浅蓝灰底，亮蓝标题 |
| 牛皮纸 | 深驼色底，深棕标题 |

## 自动字号方案对比

PrintFit 使用 Pretext 做 Canvas 级文本测量。以下是与其他方案的对比：

| 方案 | 原理 | 速度 | 精度 | 适用性 |
|------|------|------|------|--------|
| **Pretext**（本项目） | Canvas `measureText()` + 纯算术换行 | ~7ms | 高 | 最优解，无 DOM 开销 |
| Canvas measureText 手写 | 自行实现字符测量和换行逻辑 | 类似 | 取决于实现 | 需处理 CJK 换行、空格折叠等，工作量大 |
| DOM reflow 测量 | 渲染到隐藏 div，读 `scrollHeight` | ~50-200ms | 最高 | 最简单但最慢，每次二分都触发强制布局 |
| OffscreenCanvas + Worker | Worker 线程中 Canvas 测量 | 不阻塞主线程 | 中等 | 字体加载受限，兼容性不佳 |

Pretext 的核心优势：**用 Canvas 测量字符宽度后纯算术计算换行**，避免了 DOM reflow 的性能瓶颈。8 次二分迭代 × 20 个文本块 ≈ 160 次 `prepare + layout` 调用，总耗时仅约 7ms。

## 社区支持

学 AI ，上 L 站

[LinuxDO](https://linux.do/)

## License

MIT
