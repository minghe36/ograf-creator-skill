---
name: ograf-creator
description: Create, validate, package, and optionally upload OGRAF HTML animation components for ograf.app. Use when a user asks to create an OGRAF component, animation, template, or .ograf package.
---

# OGRAF Creator

Create a self-contained OGRAF HTML animation package that can be previewed locally and uploaded to ograf.app.

## Required component information

Before creating files, ensure the user has explicitly provided all four fields below:

- Title
- Description
- Whether landscape is supported
- Whether portrait is supported

Do not ask again for values already present in the conversation. Ask for all missing values together in one concise prompt. Present landscape as enabled and portrait as disabled only as suggested defaults; still require the user to confirm both orientation choices.

Use these canonical keys throughout the generated package and upload request:

```json
{
  "name": "Component title",
  "description": "What the component does and where it is useful",
  "supportsLandscape": true,
  "supportsPortrait": false
}
```

## Package requirements

Generate a zip-compatible `.ograf` package with these files at its root:

- `project.json`: metadata and editable component data.
- `index.html`: self-contained rendering entry point.

Preserve the four required fields in `project.json`. Keep asset paths relative, do not include absolute paths or `..`, and keep the compressed package at or below 500 KB for ograf.app uploads.

Implement the component according to the user's visual and motion requirements. Infer ordinary technical choices, but do not invent or overwrite the four required component-information fields.

## Uploading to ograf.app

When the user asks to upload or publish, read [references/ograf-app-upload.md](references/ograf-app-upload.md). Uploading changes external state and requires a valid signed-in ograf.app session; do not claim success without checking the API response.

## Completion checks

Before delivery, verify that:

- `project.json` is a JSON object and contains the confirmed title, description, `supportsLandscape`, and `supportsPortrait` values.
- `index.html` exists at the package root.
- Both orientation values are JSON booleans, not strings or numbers.
- The archive contains no unsafe paths and does not exceed the upload size limit.

