---
name: ograf-creator-skill
description: Create, edit, validate, preview, browser-debug, and review OGraf HTML animation packages before authorized publication with project.json schemas and the OGraf postMessage lifecycle. Use for building .ograf graphics, fixing their animation or configuration form, or testing them in the local OGraf debugger. Do not use for generic web pages that do not need the OGraf package and host protocol.
---

# OGraf Creator

Build a DaVinci-compatible OGRAF Web Component (`main.js` + a named `.ograf.json`) and an HTML preview adapter (`project.json` + `index.html`) sharing one runtime. Mount the visible stage directly under `document.body`, not inside the host component. Read [references/davinci-runtime.md](references/davinci-runtime.md) for body portals, native lifecycle and landscape/portrait sizing.

Build an OGraf as a portable folder whose root contains `project.json` and `index.html`. Treat the browser preview, the schema form, and the packaged graphic as one product: changes to one must remain compatible with the others.

## Route the task

- For package layout, manifest fields, or schema controls, read [references/package-and-schema.md](references/package-and-schema.md).
- For runtime behavior or lifecycle bugs, read [references/protocol.md](references/protocol.md).
- For visual or form debugging, read [references/browser-debugging.md](references/browser-debugging.md).
- When editing an existing private draft and synchronizing its code, read [references/ograf-app-upload.md](references/ograf-app-upload.md#sync-code-to-an-existing-draft). Use the existing animation ID rather than creating another workspace item.
- Before any upload or publication, always read and apply [references/publishing-review.md](references/publishing-review.md).

## Component information

Creating, previewing, validating and packaging are local work: do not ask the user to sign in to ograf.app for them. An ograf.app account is only needed to upload or publish; the login step is in [Login: only for upload or publication](#login-only-for-upload-or-publication).

Before creating files, ensure the user has provided the title, description, supportsLandscape and supportsPortrait. Reuse values already given in the conversation; ask for missing fields together. Do not silently invent or overwrite these four values. Store name/description and boolean orientation flags in project.json and preserve them in upload metadata.

## Create or edit

1. Inspect the target directory before writing. Preserve user assets and existing behavior unless asked to replace them.
2. If starting fresh, copy `assets/starter/` into a new target directory with `scripts/ograf_tool.py init <target>`. Do not initialize a non-empty directory unless the user explicitly wants a merge.
3. Implement the graphic in the shared runtime, expose it from `main.js`, and bridge its lifecycle in `index.html`. Keep it self-contained by default; relative local assets are allowed. Avoid public-network dependencies unless `project.json` declares that requirement and the user accepts it.
4. Define editable values in both `project.json.data` and `project.json.schema.properties`. Every property should have a useful title and default whose type matches the schema.
5. Implement all six portable messages: receive `ograf:start`, `ograf:stop`, and `ograf:update`; emit `ograf:ready`, `ograf:ended`, and `ograf:error`. Updates must apply without reloading.
6. Make start deterministic and replayable, and make stop return to a documented resting state. Prefer CSS transforms and opacity for animation. Respect `prefers-reduced-motion` in the browser while retaining deterministic start/end behavior.

## Validate and debug

Run deterministic checks first:

```bash
python3 <skill-dir>/scripts/ograf_tool.py validate <target>
```

Then start the zero-dependency debugger in a persistent terminal session:

```bash
node <skill-dir>/scripts/ograf_dev_server.mjs <target> --port 4173
```

Open the printed `/__ograf__/debug` URL in an available visible browser. Do not claim visual success from source inspection alone. Exercise at least:

- initial ready state and automatic data delivery;
- Start, Stop, and replay;
- every schema control, including boundary values for numeric inputs;
- Reload followed by another Start;
- body-mounted stage; 1920×1080 landscape and 1080×1920 portrait, including a stale landscape host with a portrait render resolution;
- native load/update/play/stop, deterministic goToTime and disposal, plus responsive fit at both aspect ratios;
- visible error reporting and the browser console.

Iterate on the graphic and reload until these checks pass. When computer-use tooling is unavailable, say that browser verification remains outstanding instead of implying it passed.

## Package

After validation and browser verification, create the distributable archive:

```bash
python3 <skill-dir>/scripts/ograf_tool.py pack <target> --output <name>.ograf
```

The packer excludes common editor and OS junk, places required entries at the archive root, and re-validates the result. Report the output path, archive size, validation result, and what was actually exercised in the browser.

## Login: only for upload or publication

Run `python3 <skill-dir>/scripts/ograf_auth.py login` when the user asks to log in, or before the first authenticated upload if credentials are missing. It opens HaoAI OAuth, verifies the PKCE/state callback and stores user_key locally with owner-only permissions. Reuse the credentials for later uploads and code syncs; sign in again only when they are missing or rejected, for example when an upload returns `401`. Never print the key. Use `status` to inspect the saved account and `logout` only at the user's request. A local credential file does not prove the server currently accepts it.

## Upload and publish: mandatory local AI review

Before packaging for upload/publication, regenerate two additional complete native configurations from the final component: `<name>.zh.ograf.json` and `<name>.en.ograf.json`, beside the existing `<name>.ograf.json`. The AI must translate component name/description, parameter titles/descriptions and visible default text into Chinese and English; copying the same untranslated file twice is insufficient. Preserve parameter keys, enum values, runtime entry, capabilities and numeric/color/timing values. Read the localization rules in [references/package-and-schema.md](references/package-and-schema.md). Validate and pack with `--for-publication`; missing or outdated language files block publication.

When the user asks to upload or publish, the AI Agent on the user's computer must review the actual final component and archive against [references/publishing-review.md](references/publishing-review.md). Only a complete PASS permits upload or publication. A successful pack command alone is not a publication approval.

Verify the native OGRAF manifest/entry, body-mounted stage, supplied canvas resolution, declared landscape/portrait layouts, lifecycle, editable parameters and all upload safety limits. Inspect source and assets and exercise the actual preview; never replace missing runtime evidence with a static guess.

Review component names and descriptions in project.json, every .ograf.json and the final upload/publication metadata. Prohibit unlawful or abusive wording and content promoting prohibited activity, including disguised or obfuscated variants. Apply any site/user-provided prohibited-word policy and semantic context review; do not claim that a small keyword list proves compliance. Missing, unreviewed or uncertain metadata blocks publication until corrected or resolved.

Record PASS / FAIL / NEEDS_REVIEW, evidence, blockers, final metadata and the final archive SHA-256 in a local publication review report. FAIL, NEEDS_REVIEW or any untested required check means stop before upload/publish. Fix and recheck; do not upload a draft as a workaround. Any code, asset, parameter or metadata change invalidates the affected review; rebuild and check the final artifact before sending it.

After PASS, read [references/ograf-app-upload.md](references/ograf-app-upload.md) and complete only the user's authorized upload/publication using supported tools and the saved CLI credentials. Always send the intended animation `status` explicitly: use `draft` when the user requests a private draft and `published` only when public publication is authorized. Follow the two-step upload/status procedure in that reference. Verify the returned `data.status`; for drafts confirm the workspace link and exclusion from the public catalogue, while public publication requires checking the public page. A draft is not a publicly published component. If tools or credentials are unavailable, retain the package and report the missing capability instead of inventing commands or results.

Do not upload, publish, or overwrite an unrelated package unless the user explicitly asks.

## 修改已有草稿后同步代码

用户要求修改并同步已有草稿，或要求继续修改本次会话中已授权保存的草稿时，完成修改、验证和最终包审查后，调用 `POST /api/ograf/created/sync/v1?animationId=<原草稿动画 ID>` 同步最新 `.ograf` 包。执行细节见 [同步已有草稿代码](references/ograf-app-upload.md#sync-code-to-an-existing-draft)。只修改本地文件不代表已同步完成。

复用会话中已确认的动画 ID；缺少 ID 时查询本人创建列表并确认目标，不能仅凭名称覆盖作品。保留同一动画 ID 和 `draft` 状态，不调用新建上传流程、不创建重复作品，也不调用公开发布接口。同步成功后核对返回 ID、草稿状态及包 SHA-256，必要时通过本人私有下载接口验证服务器上的包。返回源目录、包路径、草稿 ID 和实际同步结果；接口未部署、鉴权失败或同步失败时保留本地成果并说明原因，不能报告已同步。
