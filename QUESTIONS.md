# Questions for the owner

Any agent may add a question. The owner answers inline under **Answer:**. The Director bundles open questions into each build handoff.

To approve a change to a protected file, the owner adds a line `APPROVED-PROTECTED: <path>` under the question.

## Blocking

### Q6. Connect GitHub and Cloudflare (2026-11-06, Director)

Blocks finishing Milestone 0. Owner-only steps, because they involve your accounts and credentials:

1. Run `gh auth login` and tell the Director whether the GitHub repo should be private (recommended) and under your personal account or an org. The Director creates and pushes it.
2. In the Cloudflare dashboard, create an API token with the **Cloudflare Pages: Edit** permission, and copy your Account ID.
3. Add both as repo secrets: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (each prompts for the value, so it never lands in a file or chat).

**Answer:**

## Answered

### Q1. Which host should serve the public build? (2026-11-06, Director)

**Answer (owner, 2026-11-06):** Cloudflare Pages.

## Can wait

### Q2. Design pillars (2026-11-06, Director)

The four candidate pillars are in `VISION.md`. You said to revisit them after Milestone 0. They need confirming before Milestone 1 starts.

**Answer:**

### Q3. Image generation service (2026-11-06, Art Direction)

Procedural placeholders are in place, so nothing is waiting on this. When you're ready: which service, and add its API key as a CI secret and a local environment variable (never in the repo).

**Answer:**

### Q4. Feedback button delivery (2026-11-06, Director)

The site is static, so feedback needs somewhere to go. Default plan: a prefilled GitHub issue link (needs the repo on GitHub and a GitHub account for whoever submits), with a copy-to-clipboard fallback that friends can paste into a chat with you. Is that OK, or would you rather use a form service?

**Answer:**

### Q5. Hard enforcement for protected files (2026-11-06, Director)

Today, protected files are guarded by Claude Code deny rules plus a CI tripwire. Stronger: GitHub branch protection on `main` with CODEOWNERS on the protected paths, so only you can merge changes to them. Want that once the repo is on GitHub?

**Answer:**
