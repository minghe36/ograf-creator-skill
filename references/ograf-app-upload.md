# ograf.app upload API

Use this reference when the user asks to upload, publish, or synchronize changes to an existing draft. First complete [publishing-review.md](publishing-review.md); only a complete PASS for the final package and metadata permits sending the request. Uploading a draft is not an exemption from review.

## Endpoint

`POST https://ograf.app/api/ograf/upload`

The request is `multipart/form-data` with:

- `file`: the `.ograf` or `.zip` package.
- `meta`: a JSON string containing the upload metadata.

For CLI uploads, load `user_key` from the credentials file maintained by `scripts/ograf_auth.py` and send it in the `X-User-Key` request header. Never print the key, put it in a URL, or copy it into the generated project. If credentials are missing, run the login command once. If the API returns `401`, discard no files; ask the user to run login again.

Browser uploads may continue to use the authenticated ograf.app session cookie.

## Required metadata

Include the user-confirmed component information in `meta`:

```json
{
  "title": "Component title",
  "description": "Component description",
  "supportsLandscape": true,
  "supportsPortrait": false
}
```

`supportsLandscape` and `supportsPortrait` must be JSON booleans. Do not serialize them as `"true"`, `"false"`, `1`, or `0`.

The upload API also accepts the generated component's `template`, `categorySlug`, `subCategorySlug`, `tags`, `license`, `resolution`, `fps`, `duration`, and `values`. Use package values or suitable defaults when the user has not specified them.

Treat a response as successful only when its JSON body contains `"ok": true`. Surface the API's returned localized error message when `ok` is false.

An upload response creates a workspace draft. It does not prove public publication. Use the supported publication capability available in the environment, verify its response and the public page, or report that the component remains a draft.

## Explicit animation publication status

Uploading a package creates an `og_workspace_items` workspace draft. The separate animation endpoint creates or updates `og_animations`; these are distinct records.

After upload succeeds, send `POST https://ograf.app/api/ograf/animation` with JSON, the same `X-User-Key` authentication, the returned workspace item ID and the reviewed component metadata:

```json
{
  "workspaceItemId": "<id returned by the upload response>",
  "animation": {
    "title": "Component title-fork",
    "description": "Component description",
    "template": "subtitle",
    "supportsLandscape": true,
    "supportsPortrait": false,
    "status": "draft"
  }
}
```

Choose the actual supported template/category and include other final metadata (values, license, resolution, fps, duration, tags) from the component. Do not copy the example title/template blindly.

- `status: "draft"`: save the animation as a private draft, excluded from public website/desktop catalogues and public package/detail endpoints.
- `status: "published"`: make the animation publicly available. This must be authorized by the user's request.
- Omitted status defaults to `published` for compatibility. Always send the intended status explicitly; when the user requested a draft, never omit it or replace it with `published`.
- Other values, including `offline`, are rejected by this endpoint.

For a linked workspace item, this updates its existing animation and status; it does not create another copy. For a new fork, upload it as a new workspace item and append `-fork` to the requested component name, preserving the source animation.

Require `ok: true`, an animation ID and `data.status` matching the intended status. For `draft`, confirm the authenticated workspace item links to that ID and the animation is absent from public listings; do not require a public detail page to exist. Report it as a saved draft, not a publicly published component. Never automatically promote it to `published` merely to obtain a public preview. Later promotion requires the user's instruction and sends `status: "published"` with the same workspace item ID.

## Sync code to an existing draft

For authorized edits to an existing draft, send the final reviewed archive to:

`POST https://ograf.app/api/ograf/created/sync/v1?animationId=<existing animation ID>`

- Authenticate with `Authorization: Bearer <user_key>` using the saved CLI credentials. This endpoint uses Bearer authentication, unlike the new-workspace upload examples above. Never print or embed credentials in project files.
- Send the archive bytes as the raw request body with `Content-Type: application/zip`. Do not send multipart form data or a JSON file path. The maximum archive size is 500 KB.
- Use the **animation ID**, not the workspace item ID. Reuse the ID from the successful draft creation response or query the authenticated creator list at `POST /api/ograf/created/v1` with `{ "page": 1, "page_size": 100 }` and Bearer authentication. Follow pagination if needed. Names alone do not establish which draft the user authorized modifying.
- The server validates ownership, `draft` status and package safety. It uploads into a new storage directory and conditionally replaces the same animation's package URL, checksum and size; it does not create an animation or publish it. A concurrent state/package change returns 409.
- This endpoint updates the animation package, not its title, description, category, other metadata or the original workspace archive. Do not replay the old workspace-to-animation flow after synchronization: it could restore the old archive. Report separately if the user's task also requires metadata changes.

Success requires HTTP 2xx **and** `success: true` (not `ok: true`). Require `data.id` to match the original animation ID, `data.status` to equal `draft`, and `data.sha256` to match the SHA-256 of the exact archive sent. A local pack or HTTP 200 alone is insufficient. Requery the authenticated creator list to verify the same record's package URL and checksum. If download verification is needed, call the authenticated `POST /api/ograf-download-sign/v1` with `{ "package_path": "<updated package URL>" }`, download the signed package and compare its checksum without exposing signed URLs or credentials in the report.

Handle 401 by resolving login; 404 by checking the ID and deployment; 409 by checking current ownership/state before any new attempt; package rejection by correcting and reviewing the package. Do not retry blindly or fall back to creating a duplicate or publishing publicly. If the request outcome is unknown, query the draft and compare its package checksum before deciding whether another upload is needed. If the endpoint is unavailable or not deployed, preserve the final archive and report synchronization as incomplete.

After verified synchronization, invalidate/re-download the desktop cache and restart the preview when a supported app capability is available. If it is unavailable, report that server synchronization passed but desktop cache refresh/visual acceptance remains unverified. Return the same draft ID, source directory, final archive path, SHA-256 and actual verification results.
