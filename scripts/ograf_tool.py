#!/usr/bin/env python3
"""Initialize, validate, and package portable OGraf graphics."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

MAX_ARCHIVE_BYTES = 500 * 1024
MAX_FILES = 200
MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024
REQUIRED_FILES = {"project.json", "index.html"}
PROTOCOL_TOKENS = (
    "ograf:start",
    "ograf:stop",
    "ograf:update",
    "ograf:ready",
    "ograf:ended",
    "ograf:error",
)
JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}


class ValidationResult:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.file_count = 0
        self.uncompressed_bytes = 0
        self.archive_bytes: int | None = None

    @property
    def ok(self) -> bool:
        return not self.errors


def is_junk(name: str) -> bool:
    path = PurePosixPath(name)
    return "__MACOSX" in path.parts or path.name in JUNK_NAMES or ".git" in path.parts


def unsafe_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    return (
        not normalized
        or normalized.startswith("/")
        or bool(re.match(r"^[A-Za-z]:", normalized))
        or ".." in path.parts
    )


def json_matches(value: Any, declared: str) -> bool:
    if declared == "string":
        return isinstance(value, str)
    if declared == "boolean":
        return isinstance(value, bool)
    if declared == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if declared == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if declared == "array":
        return isinstance(value, list)
    if declared == "object":
        return isinstance(value, dict)
    if declared == "null":
        return value is None
    return True


def validate_project(project: Any, result: ValidationResult) -> None:
    if not isinstance(project, dict):
        result.errors.append("project.json must contain a JSON object")
        return

    if project.get("format") != "ograf":
        result.errors.append('project.json field "format" must be "ograf"')
    if not isinstance(project.get("formatVersion"), int) or project["formatVersion"] < 1:
        result.errors.append('project.json field "formatVersion" must be a positive integer')
    if not isinstance(project.get("name"), str) or not project["name"].strip():
        result.errors.append('project.json field "name" must be a non-empty string')

    data = project.get("data")
    if not isinstance(data, dict):
        result.errors.append('project.json field "data" must be an object')
        data = {}

    schema = project.get("schema")
    if not isinstance(schema, dict) or schema.get("type") != "object":
        result.errors.append('project.json field "schema" must be an object schema')
        return
    properties = schema.get("properties")
    if not isinstance(properties, dict):
        result.errors.append('project.json field "schema.properties" must be an object')
        return

    for key in data:
        if key not in properties:
            result.errors.append(f'data key "{key}" has no matching schema property')
    for key, prop in properties.items():
        if not isinstance(prop, dict):
            result.errors.append(f'schema property "{key}" must be an object')
            continue
        declared = prop.get("type")
        if declared not in {"string", "boolean", "integer", "number", "array", "object", "null"}:
            result.errors.append(f'schema property "{key}" has unsupported or missing type')
            continue
        if "default" not in prop:
            result.warnings.append(f'schema property "{key}" has no default')
        elif not json_matches(prop["default"], declared):
            result.errors.append(f'schema property "{key}" default does not match type {declared}')
        if key in data and not json_matches(data[key], declared):
            result.errors.append(f'data value "{key}" does not match schema type {declared}')

    resolution = project.get("resolution")
    if resolution is not None and (not isinstance(resolution, str) or not re.fullmatch(r"\d+x\d+", resolution)):
        result.errors.append('project.json field "resolution" must look like "1920x1080"')
    fps = project.get("fps")
    if fps is not None and (not isinstance(fps, (int, float)) or isinstance(fps, bool) or fps <= 0):
        result.errors.append('project.json field "fps" must be a positive number')
    duration = project.get("duration")
    if duration is not None and (
        not isinstance(duration, (int, float)) or isinstance(duration, bool) or duration < 0
    ):
        result.errors.append('project.json field "duration" must be a non-negative number')


def validate_native_manifest(names: set[str], read_text, result: ValidationResult) -> None:
    manifests = [name for name in names if name.endswith(".ograf.json")]
    if not manifests:
        result.warnings.append("no native .ograf.json manifest; DaVinci component compatibility is unverified")
        return
    base = [name for name in manifests if not name.endswith((".zh.ograf.json", ".en.ograf.json"))]
    if len(base) != 1:
        result.errors.append("provide exactly one base native .ograf.json manifest")
        return
    stem = base[0][:-len(".ograf.json")]
    localized = {f"{stem}.{locale}.ograf.json" for locale in ("zh", "en")}
    if set(manifests) - {base[0]} - localized:
        result.errors.append("localized manifests must share the base filename and use .zh.ograf.json or .en.ograf.json")
    if set(manifests) & localized and not localized <= set(manifests):
        result.errors.append("provide both Chinese and English localized manifests")
    try:
        project = json.loads(read_text("project.json"))
        base_manifest = json.loads(read_text(base[0]))
        def structural(value):
            if isinstance(value, dict):
                return {key: ({field: structural(spec) for field, spec in item.items()} if key in {"properties", "$defs", "definitions"} and isinstance(item, dict) else structural(item)) for key, item in value.items() if key not in {"title", "description", "default"}}
            if isinstance(value, list):
                return [structural(item) for item in value]
            return value
        for name in sorted(manifests):
            manifest = json.loads(read_text(name))
            main = manifest.get("main")
            if not isinstance(main, str) or unsafe_name(main) or main not in names:
                result.errors.append(f"{name}: main must reference a local package entry")
            native_properties = manifest.get("schema", {}).get("properties", {})
            project_properties = project.get("schema", {}).get("properties", {})
            if name == base[0]:
                without_defaults = lambda props: {key: {k: v for k, v in field.items() if k != "default"} for key, field in props.items()}
                if without_defaults(native_properties) != without_defaults(project_properties):
                    result.errors.append(f"{name}: schema.properties must match project.json")
                if manifest.get("schema", {}).get("default") != project.get("data"):
                    result.errors.append(f"{name}: schema.default must match project.json.data")
            else:
                if structural(manifest.get("schema")) != structural(base_manifest.get("schema")):
                    result.errors.append(f"{name}: schema structure must match the base manifest")
                for key in set(manifest) | set(base_manifest):
                    if key not in {"name", "description", "schema"} and manifest.get(key) != base_manifest.get(key):
                        result.errors.append(f"{name}: {key} must match the base manifest")
                for key in ("name", "description"):
                    if not isinstance(manifest.get(key), str) or not manifest[key].strip():
                        result.errors.append(f"{name}: {key} must be non-empty localized text")
    except (ValueError, OSError, KeyError, AttributeError, TypeError) as exc:
        result.errors.append(f"invalid native manifest: {exc}")


def require_publication_locales(path: Path, result: ValidationResult) -> None:
    if not result.ok:
        return
    if path.is_dir():
        names = {item.relative_to(path).as_posix() for item in path.rglob("*") if item.is_file()}
    else:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
    bases = [name for name in names if name.endswith(".ograf.json") and not name.endswith((".zh.ograf.json", ".en.ograf.json"))]
    if len(bases) != 1:
        result.errors.append("publication requires one base native manifest")
        return
    stem = bases[0][:-len(".ograf.json")]
    for locale in ("zh", "en"):
        filename = f"{stem}.{locale}.ograf.json"
        if filename not in names:
            result.errors.append(f"publication requires AI-generated {filename}")


def validate_protocol(index_html: str, result: ValidationResult) -> None:
    for token in PROTOCOL_TOKENS:
        if token not in index_html:
            result.errors.append(f'index.html does not contain required protocol token "{token}"')


def validate_directory(root: Path) -> ValidationResult:
    result = ValidationResult()
    if not root.is_dir():
        result.errors.append(f"not a directory: {root}")
        return result

    files: dict[str, Path] = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            result.errors.append(f"symbolic links are not portable: {path.relative_to(root)}")
            continue
        if not path.is_file():
            continue
        name = path.relative_to(root).as_posix()
        if is_junk(name):
            continue
        if unsafe_name(name):
            result.errors.append(f"unsafe path: {name}")
            continue
        files[name] = path
        result.uncompressed_bytes += path.stat().st_size

    result.file_count = len(files)
    if result.file_count == 0:
        result.errors.append("package directory is empty")
    if result.file_count > MAX_FILES:
        result.errors.append(f"package has {result.file_count} files; maximum is {MAX_FILES}")
    if result.uncompressed_bytes > MAX_UNCOMPRESSED_BYTES:
        result.errors.append(
            f"uncompressed content is {result.uncompressed_bytes} bytes; maximum is {MAX_UNCOMPRESSED_BYTES}"
        )
    for required in REQUIRED_FILES:
        if required not in files:
            result.errors.append(f"missing required root entry: {required}")

    if "project.json" in files:
        try:
            validate_project(json.loads(files["project.json"].read_text(encoding="utf-8")), result)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            result.errors.append(f"invalid project.json: {exc}")
    if "index.html" in files:
        try:
            validate_protocol(files["index.html"].read_text(encoding="utf-8"), result)
        except (OSError, UnicodeDecodeError) as exc:
            result.errors.append(f"cannot read index.html: {exc}")
    if "project.json" in files:
        validate_native_manifest(set(files), lambda name: files[name].read_text(encoding="utf-8"), result)
    return result


def validate_archive(archive: Path) -> ValidationResult:
    result = ValidationResult()
    if not archive.is_file():
        result.errors.append(f"not a file: {archive}")
        return result
    result.archive_bytes = archive.stat().st_size
    if result.archive_bytes > MAX_ARCHIVE_BYTES:
        result.errors.append(f"archive is {result.archive_bytes} bytes; maximum is {MAX_ARCHIVE_BYTES}")

    try:
        with zipfile.ZipFile(archive) as zipped:
            infos = [item for item in zipped.infolist() if not item.is_dir() and not is_junk(item.filename)]
            result.file_count = len(infos)
            result.uncompressed_bytes = sum(item.file_size for item in infos)
            names = {item.filename for item in infos}
            if result.file_count == 0:
                result.errors.append("archive is empty")
            if result.file_count > MAX_FILES:
                result.errors.append(f"archive has {result.file_count} files; maximum is {MAX_FILES}")
            if result.uncompressed_bytes > MAX_UNCOMPRESSED_BYTES:
                result.errors.append(
                    f"uncompressed content is {result.uncompressed_bytes} bytes; maximum is {MAX_UNCOMPRESSED_BYTES}"
                )
            for name in names:
                if unsafe_name(name):
                    result.errors.append(f"unsafe path: {name}")
            for required in REQUIRED_FILES:
                if required not in names:
                    result.errors.append(f"missing required root entry: {required}")
            if "project.json" in names:
                try:
                    validate_project(json.loads(zipped.read("project.json").decode("utf-8")), result)
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    result.errors.append(f"invalid project.json: {exc}")
            if "index.html" in names:
                try:
                    validate_protocol(zipped.read("index.html").decode("utf-8"), result)
                except UnicodeDecodeError as exc:
                    result.errors.append(f"cannot decode index.html: {exc}")
            if "project.json" in names:
                validate_native_manifest(names, lambda name: zipped.read(name).decode("utf-8"), result)
    except (OSError, zipfile.BadZipFile) as exc:
        result.errors.append(f"invalid ZIP archive: {exc}")
    return result


def validate(path: Path) -> ValidationResult:
    return validate_directory(path) if path.is_dir() else validate_archive(path)


def report(path: Path, result: ValidationResult) -> None:
    state = "PASS" if result.ok else "FAIL"
    print(f"[{state}] {path}")
    print(f"files: {result.file_count}")
    print(f"uncompressed: {result.uncompressed_bytes} bytes")
    if result.archive_bytes is not None:
        print(f"archive: {result.archive_bytes} bytes")
    for warning in result.warnings:
        print(f"warning: {warning}")
    for error in result.errors:
        print(f"error: {error}")


def command_init(args: argparse.Namespace) -> int:
    target = Path(args.target).expanduser().resolve()
    if target.exists() and any(target.iterdir()):
        print(f"refusing to initialize non-empty directory: {target}", file=sys.stderr)
        return 2
    starter = Path(__file__).resolve().parent.parent / "assets" / "starter"
    target.mkdir(parents=True, exist_ok=True)
    for source in starter.rglob("*"):
        relative = source.relative_to(starter)
        destination = target / relative
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    print(f"initialized OGraf graphic: {target}")
    return 0


def command_validate(args: argparse.Namespace) -> int:
    path = Path(args.path).expanduser().resolve()
    result = validate(path)
    if args.for_publication:
        require_publication_locales(path, result)
    report(path, result)
    return 0 if result.ok else 1


def command_pack(args: argparse.Namespace) -> int:
    root = Path(args.path).expanduser().resolve()
    initial = validate_directory(root)
    if args.for_publication:
        require_publication_locales(root, initial)
    report(root, initial)
    if not initial.ok:
        return 1

    output = Path(args.output).expanduser().resolve() if args.output else root.with_suffix(".ograf")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.is_symlink() or path.resolve() == output:
                continue
            name = path.relative_to(root).as_posix()
            if is_junk(name):
                continue
            zipped.write(path, name)

    packed = validate_archive(output)
    if args.for_publication:
        require_publication_locales(output, packed)
    report(output, packed)
    if packed.ok:
        print(f"created: {output}")
        return 0
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    init_parser = sub.add_parser("init", help="copy the starter into an empty directory")
    init_parser.add_argument("target")
    init_parser.set_defaults(handler=command_init)

    validate_parser = sub.add_parser("validate", help="validate an OGraf directory or archive")
    validate_parser.add_argument("path")
    validate_parser.add_argument("--for-publication", action="store_true", help="require Chinese and English manifests before publication")
    validate_parser.set_defaults(handler=command_validate)

    pack_parser = sub.add_parser("pack", help="validate and create a .ograf ZIP archive")
    pack_parser.add_argument("path")
    pack_parser.add_argument("--output", "-o")
    pack_parser.add_argument("--for-publication", action="store_true", help="require Chinese and English manifests before publication")
    pack_parser.set_defaults(handler=command_pack)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
