# Desktop Portfolio

A Next.js portfolio designed like a Windows 11-inspired desktop with a monochrome hand-drawn retro style.

Data for projects, blog snippets, and failure logs is loaded from GitHub with caching suitable for Vercel.

## Stack

- Next.js (App Router, TypeScript)
- Server-side GitHub data fetching
- CSS modules for stylized desktop UI
- Deploy-ready for Vercel

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill in variables in `.env.local`:

- `GITHUB_USERNAME`: your GitHub username (required for live data)
- `GITHUB_TOKEN`: GitHub personal access token (recommended)
- `GITHUB_BLOG_REPO`: repo used for markdown blog files
- `GITHUB_BLOG_PATH`: folder path for blog markdown files (default `content/blog`)
- `GITHUB_FAILURE_REPO`: repo where failure issues are tracked
- `GITHUB_FAILURE_LABEL`: label used for failure issues (default `failure`)

4. Start development server:

```bash
npm run dev
```

## GitHub content model

- Projects: non-fork repositories from `GITHUB_USERNAME`
- Blog: `.md`/`.mdx` files discovered under `GITHUB_BLOG_PATH`
- Failures: GitHub issues in `GITHUB_FAILURE_REPO` filtered by `GITHUB_FAILURE_LABEL`

If GitHub values are missing or API calls fail, the app renders sample fallback content with warnings.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Add the same env vars from `.env.local` in Vercel project settings.
4. Deploy.

Because pages are server-rendered with revalidation, content updates on GitHub are reflected without full redeploys.
