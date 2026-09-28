# OGRAF Creator Skill

使用 AI Agent 创建、修改、预览、校验和打包 OGRAF 动画，面向 [ograf.app](https://ograf.app) 与 HaoOgraf 达芬奇动画插件。组件同时提供原生 OGRAF Web Component 和网站 HTML 预览入口，复用同一份动画实现。

你只需要描述想要的动画。AI 负责创建文件、运行本地预览、修改参数，并在发布前检查组件规范和名称、描述。

## 能做什么

- 创建标题、字幕条、数据图形等动画，支持透明背景和可编辑参数。
- 根据 `project.json.schema` 自动生成调试表单，实时修改文字、颜色、字号等。
- 检查播放、停止、重播、结束通知和错误信息。
- 预览 1920×1080 横屏和 1080×1920 竖屏。
- 创建 body 挂载舞台，适配达芬奇传入的画布尺寸。
- 初始化项目、校验目录或压缩包、打包为 `.ograf`。
- 要求本地 AI 在上传、发布前完成技术和内容审核，未通过则停止。

**当前仓库提供创作、预览、校验和打包脚本，以及发布审核指引。登录、上传和社区发布仍需要运行环境提供对应工具；本仓库目前没有登录或上传 CLI。** 安装 Skill 不等于已登录 ograf.app，也不等于已发布作品。

## 1. 安装 Skill

### Codex

在 Codex 对话中发送：

```text
$skill-installer 安装 https://github.com/minghe36/ograf-creator-skill
```

这是仓库根目录的 Skill。安装时保留整个目录，包括 `SKILL.md`、`scripts/`、`references/`、`assets/` 和 `agents/`。安装完成后，在后续对话中使用 `ograf-creator-skill`；未识别时重新打开会话并检查安装结果。

### WorkBuddy

在 WorkBuddy 中打开本地工作目录，发送：

```text
请安装 Skill：https://github.com/minghe36/ograf-creator-skill
```

由 WorkBuddy 按其支持的方式完成安装。安装后发送“使用 ograf-creator-skill 创建动画”，确认它能读取 Skill 指令。具体安装位置与入口取决于 Agent，不要只复制 `SKILL.md` 而遗漏脚本和模板。

### 已下载到本地

把本地目录提供给 AI：

```text
请安装这个目录中的 Skill：/你的路径/ograf-creator-skill
```

也可以直接要求 AI 阅读该目录的 `SKILL.md` 并按指引工作；是否能自动发现或以 `$ograf-creator-skill` 调用，取决于 Agent 的安装机制。

## 2. 创建第一个动画

在 AI Agent 中打开一个用于存放动画的本地文件夹，发送：

```text
使用 ograf-creator-skill 创建一个简单的标题动画：文字“你好，OGRAF”居中，白色文字、透明背景，缓慢淡入后停留，总时长 3 秒。支持横屏与竖屏，可修改标题、颜色和字号。

创建后打开本地预览，先不上传。
```

AI 应创建独立组件目录，运行校验并启动预览。你可以补充参考图、颜色、时长和支持方向。只支持横屏时请明确说明，不要把未验证的竖屏能力标为支持。

模板默认是字幕条，用于展示完整的参数与生命周期；创建标题动画时，AI 应按你的要求修改模板，而不是直接把默认字幕条当作完成品。

## 3. 用 AI 修改动画

在同一个对话中继续描述变化：

```text
把标题改成“我的第一个动画”，文字改为紫色，淡入时间改为 1 秒。修改后重新预览。
```

也可以要求检查：

```text
检查横屏和竖屏预览，测试标题、颜色、字号的修改，以及播放、停止和连续重播。修复裁切或布局问题。
```

参数修改应即时更新画面，不重载 iframe，也不自动重播。修改后的源码、`project.json` 和 `.ograf.json` 参数定义需要保持一致。

## 4. 使用本地调试器

调试器由 Node.js 标准库实现，无需 npm 安装依赖。建议准备 Python 3.10+、Node.js 18+，以及支持 Web Components、Shadow DOM、ResizeObserver 的现代浏览器。AI 自动操作预览需要可用的浏览器工具；没有工具时仍可手动检查，但不能宣称 AI 已完成浏览器验证。

以下命令均在 **Skill 仓库目录** 中执行。请用你的实际组件路径替换示例路径。

```bash
# 初始化：目标目录应不存在或为空
python3 scripts/ograf_tool.py init /tmp/my-ograf

# 校验组件目录
python3 scripts/ograf_tool.py validate /tmp/my-ograf

# 启动预览；该终端需要保持运行
node scripts/ograf_dev_server.mjs /tmp/my-ograf --port 4173
```

打开终端打印的地址：

```text
http://127.0.0.1:4173/__ograf__/debug
```

| 控件 | 用途 |
| --- | --- |
| Canvas | 在项目默认画布、1920×1080 横屏、1080×1920 竖屏之间切换 |
| Start | 从初始帧播放，重复点击测试重播 |
| Stop | 取消当前播放并回到停止状态 |
| Update | 将表单参数发送给组件 |
| Reload | 重新加载组件文件，修改源码后使用 |
| Schema controls | 根据参数 schema 生成的文字、颜色、数值、选项等表单 |
| Protocol log | 查看宿主与动画的消息、结束通知和错误 |

检查 Ready、入场和退场、文字边界、透明背景、参数即时更新、停止和重播。修改数字参数时测试最小值与最大值，标题可以测试长文本和特殊字符。

端口被占用时改用其他端口：

```bash
node scripts/ograf_dev_server.mjs /tmp/my-ograf --port 4174
```

使用 `Ctrl+C` 停止服务。默认仅监听本机 `127.0.0.1`。

## 5. 组件目录与参数

新组件的默认结构：

```text
my-ograf/
├── project.json         # 网站/调试器元数据、参数值与 schema
├── index.html           # HTML 预览与 postMessage 适配入口
├── main.js              # 原生 OGRAF 入口，默认导出 HTMLElement 子类
├── runtime.js           # 共用动画实现
├── starter.ograf.json   # 原生组件清单，main 指向 main.js
└── assets/              # 可选的本地图片、字体等资源
```

`runtime.js` 是模板的实现组织方式，清单名可按组件命名；不要把 `starter` 当成最终发布名称。若改动入口文件名，需要同步清单和 HTML 的引用。

参数在 `project.json.data` 中保存当前值，`schema.properties` 描述类型、控件和默认值。例如：

```json
{
  "data": { "title": "你好，OGRAF" },
  "schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "title": "标题",
        "default": "你好，OGRAF"
      }
    }
  }
}
```

这是参数片段，不是完整的 `project.json`。完整项目还需要格式、名称等字段。原生 `.ograf.json` 的参数 schema 与网站项目应一致，`schema.default` 与项目 data 同步。

支持文本、颜色、多行文本、enum 选项、数字、布尔和 JSON 对象/数组等调试控件；实际宿主的参数控件能力需要验证。

详细格式见 [包与参数规范](references/package-and-schema.md) 和 [网站规范](https://ograf.app/ograf-spec)。

## 6. 达芬奇横竖屏兼容

可见动画舞台必须直接挂载到 `document.body`。原生组件优先使用 `load({ renderCharacteristics })` 中的 `resolution.width/height`，再考虑实际视口。

达芬奇宿主可能仍保持 1920×1080，而传入的时间线画布为 1080×1920。此时不能用宿主尺寸覆盖竖屏画布，也不能把竖屏缩进旧横屏容器。只有宿主盒子与画布比例一致时，才等比缩放整个预览。

除了画布尺寸，还要检查竖屏的文字换行、安全边距和图形布局。卸载或断开组件时清理 body 舞台、观察器、监听器和动画任务，重新连接不得生成重复舞台。

原生入口提供 `load`、`updateAction`、`playAction`、`stopAction`、`dispose`。声明支持非实时渲染时，还需实现 `goToTime` 和 `setActionsSchedule`；时间定位使用毫秒，并检查重复、倒退定位的一致性。

浏览器原生接口测试不能替代实际达芬奇运行验证。详细规则见 [达芬奇运行规范](references/davinci-runtime.md)。

## 7. 校验与打包

实际预览检查完成后执行：

```bash
python3 scripts/ograf_tool.py validate /tmp/my-ograf
python3 scripts/ograf_tool.py pack /tmp/my-ograf --output /tmp/my-ograf.ograf
python3 scripts/ograf_tool.py validate /tmp/my-ograf.ograf
```

`.ograf` 是 ZIP 压缩包，必需入口直接放在包的根目录。打包器忽略常见系统、编辑器垃圾文件，并再次校验生成的包。命令返回非零退出码表示失败，应该修复后重试。

| 限制 | 上限 |
| --- | --- |
| 压缩包 | 500 KiB |
| 解压总量 | 2 MiB |
| 文件数 | 200 |
| JS / MJS 单文件 | 500 KiB |
| 图片单文件 | 1 MiB |
| 视频 | 不允许，包括伪装扩展名的视频 |

1 KiB = 1024 字节。资源使用包内相对路径，不依赖外部脚本、字体或图片，不使用网络请求、动态执行代码、敏感存储 API 或父页面 DOM。

Python 校验器检查包大小、文件数量、解压总量、元数据和协议标记等结构。它不是完整的代码安全扫描器，也不会自动完成视觉或违规内容审核。AI 还需要检查文件类型、单文件大小、代码、资源和实际行为，服务端会进行独立扫描。

## 8. 登录、上传与发布

完成动画后，你可以发送：

```text
检查当前动画是否符合 OGRAF 规范，审核组件名称和描述。全部通过后，上传到我的 ograf.app 工作区并发布，给我公开链接。
```

AI 必须先读取 [发布审核规则](references/publishing-review.md)，在用户电脑本地检查最终文件包：

1. 包、清单、参数、body 挂载与画布尺寸符合规范。
2. 声明的横竖屏、播放、停止、重播和参数修改实际正常。
3. 文件、脚本、资源和大小符合上传限制。
4. `project.json`、`.ograf.json` 和发布请求中的名称、描述完整、真实且一致。
5. 名称与描述不含违规内容或变体规避，结合语义审核；无法确认时暂停发布。
6. 生成本地检查报告，记录 PASS / FAIL / NEEDS_REVIEW、证据和最终压缩包 SHA-256。

只有完整 PASS 才允许上传或发布。检查未完成、失败或存在疑问时，不得先上传草稿绕过要求。源码、资源、参数或发布文案发生变化后，重新检查受影响项目，最终发送的包要与检查报告一致。

**登录与发布的工具边界：**

- 此仓库目前没有 `ograf_auth.py`、上传或发布脚本，不能直接执行 README 中不存在的命令。
- 安装 Skill 或登录 Codex/WorkBuddy，不代表已经登录 ograf.app。
- 若运行环境提供受支持的登录/上传工具，AI 应按该工具的流程登录并确认账号，再执行已授权的发布。
- 缺少工具或凭据时，AI 应保留本地包，明确说明缺少哪项能力，不能虚构登录成功或发布链接。
- 上传到工作区形成草稿，与公开社区发布是两个状态。完成后检查真实返回结果和公开页面。

## 9. 常见问题

| 问题 | 处理方法 |
| --- | --- |
| Agent 找不到 Skill | 检查完整目录是否已安装，让 Agent 读取 SKILL.md 并确认脚本与模板可访问 |
| 初始化失败 | 使用新目录或空目录，避免覆盖已有作品 |
| 预览停在 Loaded / Waiting | 检查监听器、ograf:ready、资源路径和运行错误 |
| 参数没有生效 | 检查 schema 键、data 键与 ograf:update 接收处理 |
| 网站预览正常，达芬奇竖屏异常 | 检查 body 舞台和 renderCharacteristics，不能只按宿主 clientWidth/clientHeight 布局 |
| 重播跳帧或停止后仍有动画 | 清理上一轮的 requestAnimationFrame、计时器和动画任务 |
| 打包通过但上传被拒绝 | 检查服务端拒绝原因，补查单文件大小、资源类型、脚本策略和实际解压内容 |
| 没有浏览器工具 | 可手动预览，但应说明 AI 的实际浏览器检查未完成；发布检查不能直接标 PASS |
| 无法登录或发布 | 确认运行环境是否提供对应工具；本仓库当前仅提供本地创作工具和发布检查指引 |

## 目录与参考文档

- [SKILL.md](SKILL.md)：AI 工作流和发布检查要求。
- [包与参数规范](references/package-and-schema.md)：文件结构、元数据和 schema 控件。
- [播放协议](references/protocol.md)：六类 postMessage 消息与确定性播放。
- [达芬奇运行规范](references/davinci-runtime.md)：body 挂载、画布适配及原生接口。
- [浏览器检查](references/browser-debugging.md)：预览、表单和排错流程。
- [发布审核](references/publishing-review.md)：规范、安全、名称描述与发布条件。
- `assets/starter/`：完整双入口模板。
- `scripts/ograf_tool.py`：init / validate / pack。
- `scripts/ograf_dev_server.mjs`：本地预览服务。

## 许可

见 [LICENSE](LICENSE)。
