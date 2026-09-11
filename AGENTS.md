# Lanternspell development
Work directly on `main`: fetch/reconcile safely, never force-push, commit each usable verified checkpoint and immediately push `origin/main`. No feature branches or PRs. Lead owns integration; delegated tasks need explicit file ownership.

Keep pure rules in `src/simulation`, presentation in `src/render`, shared authority in `server`. The 2026-09-11 benchmark explicitly forbids publication: Cloudflare build/version commands now use `wrangler deploy --dry-run`. Leave them that way until new authorization; main pushes must not publish. Previous deployment/Free verification is historical; see `docs/deployment.md` and `docs/refinement-plan.md`. No paid services or billing changes. Use scoped verification and actual browser/motion inspection; preserve precise evidence limits and resume commands.

Keep reproducible scripts, runtime assets and licenses. Put temporary captures/profiles/videos in ignored `evidence/local/`; curate only a few milestone images and compact reports. Do not routinely commit regenerated `.blend` files or vendor archives. Preserve historical evidence without rewriting history.
