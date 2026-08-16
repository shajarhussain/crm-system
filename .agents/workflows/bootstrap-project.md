# /bootstrap-project

A self-checking setup workflow. Run it once when opening the project in a new environment, and
again any time something in `.agents/mcp_config.json` or deploy config drifts.

**How this workflow behaves:** work through the steps below in order, actually attempting each one
(run the command, don't just describe it). After every step, append one line to `SETUP_STATUS.md`
at the repo root (create it from the template in §0 if it doesn't exist yet):
- `- [x] <step> — done <timestamp>` if it succeeded
- `- [ ] <step> — WAITING ON YOU: <exact action needed, e.g. "click Allow in the browser tab that
  just opened for Vercel OAuth">` if it needs a human click/login/decision

Never mark a step `[x]` without having actually run the check that proves it. If a command fails,
record the failure and the error, don't silently retry with a workaround that changes what the
step does.

---

## 0. Status file template
If `SETUP_STATUS.md` doesn't exist, create it with this skeleton, then fill it in as you go:

```markdown
# Setup Status — auto-maintained by the /bootstrap-project workflow. Don't hand-edit; re-run instead.

- [ ] 1. Git remote verified
- [ ] 2. Firebase project linked
- [ ] 3. Firebase MCP connected
- [ ] 4. Vercel project linked
- [ ] 5. Vercel MCP connected
- [ ] 6. GitHub MCP connected
- [ ] 7. Context7 MCP connected
- [ ] 8. Chrome DevTools MCP connected
- [ ] 9. Sentry MCP (optional, off by default)
- [ ] 10. Environment variables populated
- [ ] 11. Firestore rules + indexes deployed
- [ ] 12. First Vercel deploy succeeded
```

---

## 1. Git
Git CLI is already configured. Run `git status` and `git remote -v`. If the remote isn't what's
expected, **stop and ask** — don't guess which repo this should be.

## 2–3. Firebase
1. Look for `.firebaserc` / `firebase.json`. If present, run `firebase projects:list` to confirm the
   linked project is reachable, then skip to step 3.
2. If missing: run `firebase login`.
   - **WAITING ON YOU:** a browser tab opens — click **Allow** to authorize the Firebase CLI. This
     is the only Firebase-side login needed; the MCP server reuses this same session.
   - Then `firebase projects:list`. If the target project already exists, `firebase use --add` and
     select it. If it doesn't exist yet, ask whether to `firebase projects:create` now or whether
     billing (Blaze plan, required for Cloud Functions + Cloud Tasks) needs setting up in the
     console first — that's a **WAITING ON YOU** either way, don't guess the project name/billing.
3. Scaffold if missing: `firebase init firestore functions storage` (TypeScript for Functions).
   Confirm `firebase` in `.agents/mcp_config.json` shows connected in the MCP Servers panel — it
   needs no separate credential, it rides on the `firebase login` session from step 2.

## 4–5. Vercel
1. Look for `.vercel/project.json`. If present, confirm with `vercel project ls`, skip to step 5.
2. If missing: run `vercel link`.
   - **WAITING ON YOU:** confirm the account/team and project name in the prompt — don't pick this
     unilaterally if more than one team is available.
3. Vercel's MCP is remote OAuth (`https://mcp.vercel.com`, already in `.agents/mcp_config.json`).
   The first time it's used:
   - **WAITING ON YOU:** a browser tab opens asking to authorize — click **Allow**. Nothing to
     generate or paste manually; this is simpler than the old personal-token approach.
5. Confirm `vercel` shows connected in the MCP Servers panel with tools listed (deployments, env,
   logs, domains).

## 6–8. GitHub / Context7 / Chrome DevTools
1. **GitHub** needs a personal access token (`repo`, `read:org`, `read:user` scopes).
   **WAITING ON YOU:** generate one at github.com/settings/tokens, then set it as a `GITHUB_TOKEN`
   environment variable (not pasted into `mcp_config.json` directly — the config references
   `${GITHUB_TOKEN}`). Confirm `github` shows connected afterward.
2. **Context7** needs nothing — confirm it shows connected, no login involved.
3. **Chrome DevTools** connects to the browser Antigravity already drives — confirm it shows
   connected; if the browser subagent isn't running yet, start it once (click the browser icon)
   and re-check.

## 9. Sentry (optional — leave disabled for now)
`sentry` is `"disabled": true` in `.agents/mcp_config.json` on purpose — there's no production
deployment with real users yet, so there's nothing for it to monitor. Leave it off and mark this
step done-as-skipped in the status file. Revisit after the first real deploy: create a Sentry
project, **WAITING ON YOU** for the auth token, set `SENTRY_AUTH_TOKEN`, flip `disabled` to `false`.

## 10. Environment variables
1. Copy `.env.example` → `.env.local` (git-ignored).
2. Fill the `NEXT_PUBLIC_FIREBASE_*` values — these are public and can be pulled directly via the
   Firebase MCP (`firebase apps:sdkconfig web`), no human needed.
3. Everything else in `.env.example` is commented out on purpose — those are secrets
   (`META_APP_SECRET`, the reserved `WHATSAPP_*` vars, `VERCEL_TOKEN`, `GITHUB_TOKEN`). **WAITING ON
   YOU** for each one that doesn't exist yet; never invent a placeholder value and treat it as real.
4. Mirror the public Firebase config into Vercel env vars via the Vercel MCP once it's connected.

## 11. Firestore rules & indexes
`firebase deploy --only firestore:rules,firestore:indexes` — safe to run before any Functions
exist. Confirm it exits 0.

## 12. First deploy smoke test
Once there's a minimal Next.js page: push to `main` (if auto-deploy is wired) or `vercel --prod`,
and confirm the deployment succeeds via the Vercel MCP's deployment status tool before starting
feature work.

---

## When you're done
Report the final state of `SETUP_STATUS.md` in the chat — which items are `[x]`, and the exact
action needed for anything still `[ ]`. Don't say "setup complete" if any WAITING ON YOU line is
still open.
