# asicverif.ai

UVM testbench generator for hardware verification engineers. Describe an interface, get a complete, production-ready UVM project.

## Stack

- **Frontend:** vanilla HTML / CSS / JS (single file, no build step)
- **Backend:** Cloudflare Pages Function (Worker) calling the Claude API
- **Hosting:** Cloudflare Pages (free tier)
- **Donations:** Buy Me a Coffee

No database. No auth. No tracking.

## Project structure

```
asicverif/
├── index.html                  # Landing page + generator UI
├── functions/
│   └── api/
│       └── generate.js         # Pages Function, exposed at /api/generate
├── wrangler.toml               # Cloudflare config
├── package.json
├── .dev.vars.example           # Template for local secrets
├── .gitignore
└── README.md
```

Cloudflare Pages automatically routes anything in `functions/` to match the URL path. So `functions/api/generate.js` becomes `https://yoursite.com/api/generate`.

## Local development

1. Install Wrangler (Cloudflare's CLI):
   ```bash
   npm install
   ```

2. Create `.dev.vars` at the project root (copy from `.dev.vars.example`):
   ```
   ANTHROPIC_API_KEY=sk-ant-your-actual-key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

   Opens at `http://localhost:8788`. The function runs locally through Wrangler's Miniflare runtime.

## Deploy to Cloudflare — two paths

### Option A: Git-based deployment (recommended)

1. Push this repo to GitHub.
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Pick your GitHub repo.
4. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
5. Under **Environment variables**, add:
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: your production Anthropic API key
   - **Important:** click the "Encrypt" toggle so it's stored as a secret, not plaintext.
6. **Save and Deploy**.

Cloudflare will give you a `*.pages.dev` URL. Test it. Then go to **Custom domains → Set up a custom domain** and add `asicverif.ai`. Cloudflare makes this trivial if your domain is already on their nameservers — otherwise they'll give you a CNAME to set.

### Option B: Direct deploy from CLI

```bash
npx wrangler login            # one-time
npx wrangler pages deploy .
```

Then add your API key as a secret:
```bash
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=asicverif
```

Paste the key when prompted.

## Cloudflare vs Netlify — why this might be better

- **Free tier:** 100,000 function requests/day (Cloudflare) vs. 125k/month (Netlify). For a portfolio tool that might go viral, Cloudflare is more forgiving.
- **Global edge:** Cloudflare runs your function at 300+ locations worldwide. Lower latency for international users.
- **No cold starts:** Workers boot in <5ms.
- **Custom domain with SSL:** free and automatic, even for `.ai` domains.

**One caveat:** Cloudflare Workers have a **30-second CPU limit** on the free plan, but **wall-clock time** (waiting for Claude's API) doesn't count against it. So 30-60s Claude responses work fine.

## Updating the Buy Me a Coffee link

Search `index.html` for `buymeacoffee.com/asicverif` and replace with your BMC slug.

## Cost notes

At `claude-opus-4-5` pricing, each full UVM generation runs roughly $0.30 – $0.80 of API usage depending on output size. Watch your Anthropic usage dashboard. If traffic grows, consider:
- Rate limiting by IP using Cloudflare's built-in rate limiting rules (free)
- Falling back to Sonnet for simpler protocols
- Caching common generations using Cloudflare KV

## Roadmap

- [x] AXI-Lite generation
- [ ] AXI4 (full protocol with bursts)
- [ ] APB, AHB, Wishbone
- [ ] Custom protocol (user provides spec)
- [ ] Full validation plan generator
- [ ] Coverage plan generator
- [ ] SVA-only generator for a given interface

## License

MIT — do whatever you want, but a link back is appreciated.
