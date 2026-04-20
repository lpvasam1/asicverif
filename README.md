# asicverif.ai

A small press for verification engineers. Describe an interface — receive a full, production-ready UVM testbench.

## What's in here

```
asicverif/
├── index.html                  # Homepage + generator (boutique book aesthetic)
├── assets/
│   └── site.css                # Unified stylesheet — drives the whole site's look
├── learn/
│   ├── index.html              # SystemVerilog for Verification — hub
│   ├── basic.html              # Part I — Foundations & Form
│   ├── intermediate.html       # Part II — Intermediate Matters
│   ├── advanced.html           # Part III — Advanced Topics
│   ├── test-basic.html         # Exam I
│   ├── test-intermediate.html  # Exam II
│   └── test-advanced.html      # Exam III
├── functions/
│   └── api/
│       └── generate.js         # Cloudflare Pages Function — calls Claude API
├── .gitignore
└── README.md
```

## Design system

The whole site is driven by `assets/site.css`. One stylesheet, one aesthetic — paper (`#faf6ed`) background, Fraunces serif display, Crimson Pro body, JetBrains Mono for code, ink/red/gold/sage accents. Think: a boutique letterpress manual, not a SaaS dashboard.

To change the look across the entire site, edit `assets/site.css`. You'll never need to touch individual pages for style updates.

## Nav structure

One shared nav across every page:

- **Generate** — `/` (home + generator)
- **Learn** — `/learn/` (SystemVerilog hub + chapters + exams)
- **About** — `/#about` (anchor on home)
- **Donate** — Buy Me a Coffee link

When on a learn page, "Learn" is shown as active; when on home, "Generate" is active.

## Deployment (Cloudflare Pages)

### First-time setup

1. Push to GitHub
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**
3. Pick the repo, project name `asicverif`
4. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Build output directory: `/`
5. Environment variables → add `ANTHROPIC_API_KEY` (encrypted/secret)
6. Deploy

### Every subsequent change

Just `git push` — Cloudflare auto-deploys in ~30s.

## Local development

```bash
# Serve locally — any static server works for the frontend
python3 -m http.server 8000

# For the generator function, use Wrangler
npm install -g wrangler
cp .dev.vars.example .dev.vars  # then paste your API key
wrangler pages dev .
```

## Iterating on the system prompt

The real moat is in `functions/api/generate.js` — the `SYSTEM_PROMPT` constant. That's where 13 years of DV expertise gets compressed into rules that shape the output.

As you get real users and feedback, iterate on that prompt:
- Add protocol-specific rules
- Bake in naming conventions you've seen work
- Call out common mistakes to avoid
- Build "always do X" / "never do Y" constraints

## Roadmap

- [x] AXI-Lite generation
- [x] SystemVerilog learning pages (Parts I/II/III + exams)
- [ ] AXI4 (bursts)
- [ ] APB, AHB, Wishbone
- [ ] Custom protocol
- [ ] VHDL track
- [ ] UVM reference track
- [ ] Formal verification track

## License

MIT — do whatever you want, but a link back is appreciated.
