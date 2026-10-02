# ograf.app upload API

Use this reference only when the user asks to upload or publish the generated component. First complete [publishing-review.md](publishing-review.md); only a complete PASS for the final package and metadata permits sending the request. Uploading a draft is not an exemption from review.

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
