# Package and schema

## Required layout

An OGraf package is a ZIP archive, conventionally using the `.ograf` extension. Its root must contain:

```text
project.json
index.html
main.js
runtime.js
starter.ograf.json
```

The native `.ograf.json` uses `main: "main.js"` and exports the Web Component. Its schema/defaults must agree with project.json; see [davinci-runtime.md](davinci-runtime.md).

Local scripts, fonts, images, and other assets may be stored in subdirectories and referenced with relative URLs. Never place the two required entries inside a wrapper directory.

The HaoOG upload path currently enforces these safety limits:

- compressed archive: at most 500 KiB;
- files: at most 200 non-junk entries;
- uncompressed total: at most 2 MiB;
- individual JS/MJS: at most 500 KiB; individual images: at most 1 MiB; no video;
- package-local resources only; server-side file/script scanning applies;
- no absolute paths, drive-letter paths, or `..` path segments.

The included validator checks archive size, file count, extracted total and structural metadata. Per-file type/content, script safety and publication content review also require the local AI review described in [publishing-review.md](publishing-review.md); the server performs its own independent scanning.

## `project.json`

Use this portable baseline:

```json
{
  "format": "ograf",
  "formatVersion": 1,
  "name": "Example lower third",
  "description": "A short description",
  "version": "1.0.0",
  "resolution": "1920x1080",
  "fps": 30,
  "duration": 5,
  "data": {
    "title": "Hello OGraf",
    "accentColor": "#7c3aed"
  },
  "schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "title": "Title",
        "default": "Hello OGraf"
      },
      "accentColor": {
        "type": "string",
        "title": "Accent color",
        "format": "color",
        "default": "#7c3aed"
      }
    }
  },
  "renderRequirements": {
    "resolution": { "width": 1920, "height": 1080 },
    "frameRate": 30,
    "accessToPublicInternet": false
  }
}
```

Required fields are `format`, `formatVersion`, `name`, `data`, and a root object `schema`. The local validator also checks `resolution`, `fps`, and `duration` when present.

`renderRequirements` is recommended. The debugger accepts either numeric `width`/`height`/`frameRate` values or constraint objects with `exact`/`ideal`, which makes it tolerant of OGraf-style manifests.

## Schema-driven form

The debugger renders `schema.properties` and seeds values in this order:

1. `project.json.data[key]`;
2. the property's `default`;
3. an empty value based on the declared type.

Supported controls:

| Schema | Control |
| --- | --- |
| `type: "string"` | text input |
| `format: "color"`, `gddType: "color-rrggbb"`, or `color-rrggbbaa` | color input plus text value |
| `gddType: "multi-line"` | textarea |
| `enum` | select |
| `type: "number"` / `"integer"` | number input; optional range when both bounds exist |
| `type: "boolean"` | checkbox |
| `type: "array"` / `"object"` | JSON textarea |

Use standard JSON Schema keywords (`title`, `description`, `default`, `minimum`, `maximum`, `enum`) before custom extensions. Keep `data` and property defaults identical unless a deliberate saved value should override the default.

Arrays and objects must remain valid JSON. Invalid form JSON is shown as a debugger error and is not sent to the graphic.

## Portability

- Prefer a single self-contained `index.html` for small graphics.
- Use relative local assets for larger graphics.
- Do not access the parent DOM, cookies, local storage, or the embedding application's URL.
- Do not require `allow-same-origin`; production preview uses a sandboxed opaque origin.
- Do not fetch a CDN font or library unless internet access is explicitly required.
- Mount the visible stage under body and use supplied renderCharacteristics.resolution before the iframe viewport; fit only aspect-matched preview host boxes. See [davinci-runtime.md](davinci-runtime.md).
