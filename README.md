# asicverif.ai

Generate production UVM testbenches in seconds.

## Structure

```
asicverif/
├── index.html                      # Homepage + generator
├── assets/
│   └── site.css                    # Unified stylesheet
├── learn/
│   ├── index.html                  # SystemVerilog reference hub
│   ├── basic.html                  # Part I
│   ├── intermediate.html           # Part II
│   ├── advanced.html               # Part III
│   ├── test-basic.html             # Exam I
│   ├── test-intermediate.html      # Exam II
│   └── test-advanced.html          # Exam III
└── functions/
    └── api/
        └── generate.js             # Cloudflare Pages Function (Claude API)
```

## Stack

- Vanilla HTML / CSS / JS — no build step
- Cloudflare Pages + Pages Functions
- Claude API (claude-opus-4-7)

## Deploy

Push to GitHub, Cloudflare auto-deploys. Make sure `ANTHROPIC_API_KEY`
is set as an encrypted environment variable in your Pages project.

## Local dev

```bash
npx wrangler pages dev .
```

Requires `.dev.vars` with `ANTHROPIC_API_KEY=...`.
