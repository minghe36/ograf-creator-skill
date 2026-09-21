#!/usr/bin/env python3
"""OGRAF Creator CLI authentication using HaoAI OAuth Authorization Code + PKCE."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any


ISSUER = os.environ.get("OGRAF_OAUTH_ISSUER", "https://oauth.haoai.pro").rstrip("/")
CLIENT_ID = "ograf-creator-cli"
CALLBACK_HOST = "127.0.0.1"
CALLBACK_PORT = 18765
REDIRECT_URI = f"http://{CALLBACK_HOST}:{CALLBACK_PORT}/callback"
SCOPES = "openid profile email user_key"


def config_dir() -> Path:
    override = os.environ.get("OGRAF_CONFIG_DIR")
    if override:
        return Path(override).expanduser()
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "ograf"
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "ograf"


def credentials_path() -> Path:
    return config_dir() / "credentials.json"


def save_credentials(payload: dict[str, Any]) -> None:
    target = credentials_path()
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        os.chmod(target.parent, 0o700)
    except OSError:
        pass

    fd, temporary = tempfile.mkstemp(prefix="credentials-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def load_credentials() -> dict[str, Any] | None:
    try:
        value = json.loads(credentials_path().read_text(encoding="utf-8"))
        return value if isinstance(value, dict) and value.get("user_key") else None
    except (OSError, json.JSONDecodeError):
        return None


class CallbackHandler(BaseHTTPRequestHandler):
    result: dict[str, str] = {}

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/callback":
            self.send_error(404)
            return
        values = urllib.parse.parse_qs(parsed.query)
        CallbackHandler.result = {key: items[0] for key, items in values.items() if items}
        ok = bool(CallbackHandler.result.get("code"))
        body = (
            "<!doctype html><meta charset='utf-8'><title>OGRAF login</title>"
            f"<h1>{'登录成功' if ok else '登录失败'}</h1>"
            f"<p>{'可以关闭此窗口并返回终端。' if ok else '请返回终端查看错误。'}</p>"
        ).encode("utf-8")
        self.send_response(200 if ok else 400)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def request_json(url: str, *, data: dict[str, str] | None = None, token: str | None = None) -> dict[str, Any]:
    encoded = urllib.parse.urlencode(data).encode("utf-8") if data is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=encoded, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            value = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read().decode("utf-8"))
            message = detail.get("error_description") or detail.get("error")
        except (json.JSONDecodeError, UnicodeDecodeError):
            message = None
        raise RuntimeError(message or f"HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError(f"无法连接 HaoAI OAuth：{error}") from error
    if not isinstance(value, dict):
        raise RuntimeError("OAuth 服务返回了无效数据")
    return value


def login(timeout_seconds: int) -> int:
    verifier = secrets.token_urlsafe(64)[:86]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    state = secrets.token_urlsafe(32)
    authorize_url = f"{ISSUER}/oauth/authorize?" + urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "lang": "zh",
        }
    )

    CallbackHandler.result = {}
    try:
        server = HTTPServer((CALLBACK_HOST, CALLBACK_PORT), CallbackHandler)
    except OSError as error:
        print(f"无法启动本地回调服务 {REDIRECT_URI}：{error}", file=sys.stderr)
        return 1
    server.timeout = 1

    print("正在打开 HaoAI 登录页…")
    print(f"如浏览器未自动打开，请访问：\n{authorize_url}")
    webbrowser.open(authorize_url)
    deadline = time.monotonic() + timeout_seconds
    try:
        while not CallbackHandler.result and time.monotonic() < deadline:
            server.handle_request()
    finally:
        server.server_close()

    result = CallbackHandler.result
    if not result:
        print("登录超时，请重新运行 login。", file=sys.stderr)
        return 1
    if result.get("state") != state:
        print("登录回调 state 校验失败。", file=sys.stderr)
        return 1
    if not result.get("code"):
        print(result.get("error_description") or result.get("error") or "登录失败", file=sys.stderr)
        return 1

    try:
        token = request_json(
            f"{ISSUER}/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": result["code"],
                "client_id": CLIENT_ID,
                "redirect_uri": REDIRECT_URI,
                "code_verifier": verifier,
            },
        )
        access_token = token.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise RuntimeError("OAuth 未返回 access token")
        user = request_json(f"{ISSUER}/oauth/userinfo", token=access_token)
        user_key = user.get("user_key")
        if not isinstance(user_key, str) or not user_key:
            raise RuntimeError("当前账号没有可用的 user_key")
    except RuntimeError as error:
        print(f"登录失败：{error}", file=sys.stderr)
        return 1

    save_credentials(
        {
            "user_key": user_key,
            "user_id": user.get("sub"),
            "email": user.get("email"),
            "issuer": ISSUER,
            "saved_at": int(time.time()),
        }
    )
    print(f"登录成功，凭据已安全保存到 {credentials_path()}")
    return 0


def status() -> int:
    credentials = load_credentials()
    if not credentials:
        print("未登录")
        return 1
    identity = credentials.get("email") or credentials.get("user_id") or "HaoAI 用户"
    print(f"已登录：{identity}")
    print(f"凭据位置：{credentials_path()}")
    return 0


def logout() -> int:
    target = credentials_path()
    try:
        target.unlink()
        print("已退出登录并删除本地凭据。")
    except FileNotFoundError:
        print("未登录")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="ograf-auth", description="OGRAF Creator HaoAI login")
    subparsers = parser.add_subparsers(dest="command", required=True)
    login_parser = subparsers.add_parser("login", help="通过 HaoAI OAuth 登录并保存 user_key")
    login_parser.add_argument("--timeout", type=int, default=180, help="等待浏览器回调的秒数")
    subparsers.add_parser("status", help="查看本地登录状态")
    subparsers.add_parser("logout", help="删除本地 user_key")
    args = parser.parse_args()

    if args.command == "login":
        return login(max(30, min(args.timeout, 600)))
    if args.command == "status":
        return status()
    return logout()


if __name__ == "__main__":
    raise SystemExit(main())

