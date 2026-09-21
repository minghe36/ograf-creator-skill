# ograf-creator-skill

为 ograf.app 创建、打包并上传 OGRAF HTML 动画组件的 agent skill。

创建组件前，skill 会请用户确认标题、描述、是否支持横屏、是否支持竖屏，并将这些信息写入 `project.json` 和 ograf.app 上传请求。

首次上传前运行 `python3 scripts/ograf_auth.py login`，浏览器完成 HaoAI OAuth 登录后，CLI 会将 `user_key` 以仅当前用户可读的权限保存到本地，后续上传无需重复登录。
