# ograf.app upload API

Use this reference only when the user asks to upload or publish the generated component.

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
