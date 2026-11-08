# web-v2 deploy credentials

`setup-credentials.ts` sets up the two secrets the `deploy` job of
`.github/workflows/web-v2.yml` reads from the repository Actions secrets of
`rat-punchers/shpd-seed-seeker` (no GitHub environment):

| Secret                  | Value                                                                                                     | Verified with                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | The account that owns `nerdcoder.xyz`, inferred from `wrangler whoami --json`                             | The token probes below, which are scoped to it                                                                  |
| `CLOUDFLARE_API_TOKEN`  | An API token: Workers Scripts Edit (account); Zone Read, DNS Edit, Workers Routes Edit on `nerdcoder.xyz` | `GET /accounts/{id}/workers/scripts`, `GET /zones?name=nerdcoder.xyz`, the zone's DNS records and Worker routes |

Run it from the repository root:

```bash
bun install
bun run deploy:setup
```

The script:

1. Checks for `gh` (required) and the workspace's `wrangler`.
2. Uses a GitHub token from `$GITHUB_TOKEN`, `$GH_TOKEN` or `gh auth token`
   if you accept it, and probes the repository and
   `GET …/actions/secrets`. A 403 or 404 there means the token lacks
   Secrets access (classic `repo` scope, or fine-grained Secrets: write).
3. Reads the Cloudflare account id from the wrangler login (with
   `CLOUDFLARE_API_TOKEN` removed from wrangler's environment).
4. Prints the account-owned (preferred) and user-owned token template URLs,
   asks before opening either, reads the token with one `*` per character,
   and verifies it. A value that fails verification can still be stored; the
   summary marks it unverified.
5. Stores each value with `gh secret set --app actions`, the value on stdin.

Values already in the repository secrets are kept unless you choose to re-enter
them. GitHub never returns a stored secret, so a kept value is not verified.

`bun run --filter @seed-seeker/web-deploy test` runs the unit tests, which
mock `fetch`; they never reach Cloudflare or GitHub.
