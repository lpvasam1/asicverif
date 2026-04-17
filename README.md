# asicverif.ai

UVM testbench generator for hardware verification engineers. Describe an interface, get a complete, production-ready UVM project.

## Stack

- **Frontend:** vanilla HTML / CSS / JS (single file, no build step)
- **Backend:** Netlify serverless function calling the Claude API
- **Hosting:** Netlify
- **Donations:** Buy Me a Coffee

No database. No auth. No tracking.

## Local setup

1. Install the Netlify CLI if you don't have it:
   ```bash
   npm install -g netlify-cli
   ```

2. Create a `.env` file at the repo root:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Run the dev server:
   ```bash
   netlify dev
   ```

   Opens at `http://localhost:8888`. The function is proxied automatically.

## Deploy to production

1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import from Git** → pick the repo.
3. Under **Site settings → Environment variables**, add:
   - `ANTHROPIC_API_KEY` = your production key
4. Deploy. Netlify will build and host.
5. Under **Domain management**, add `asicverif.ai` as a custom domain and follow the DNS instructions.

## Updating the Buy Me a Coffee link

Search `index.html` for `buymeacoffee.com/asicverif` and replace with your actual BMC slug once you've created the page at https://buymeacoffee.com.

## Project structure

```
asicverif/
├── index.html              # Landing page + generator UI (single file)
├── netlify/
│   └── functions/
│       └── generate.js     # Serverless function, calls Claude API
├── netlify.toml            # Netlify config (120s timeout for generation)
├── package.json
└── README.md
```

## How the system prompt works

The real moat is in `netlify/functions/generate.js` — the `SYSTEM_PROMPT` constant. That's where DV expertise gets compressed into instructions that shape Claude's output.

As you get real users and feedback, iterate on that prompt:
- Add protocol-specific rules
- Add naming conventions that you've seen work
- Add common mistakes to avoid
- Add "always do X" and "never do Y" constraints

The more specific and opinionated the prompt, the more the output feels like production code rather than generic textbook UVM.

## Roadmap

- [x] AXI-Lite generation
- [ ] AXI4 (full protocol with bursts)
- [ ] APB
- [ ] AHB
- [ ] Wishbone
- [ ] Custom protocol (user provides spec)
- [ ] Full validation plan generator (beyond testbench)
- [ ] Coverage plan generator
- [ ] SVA-only generator for a given interface
- [ ] Sample DUT library so users can try it without their own DUT

## Cost notes

At claude-opus-4-7 pricing, each full UVM generation will cost roughly $0.30 – $0.80 depending on output size (the files are sizable). Watch your Anthropic usage dashboard. If traffic grows:
- Consider rate limiting by IP (Netlify Edge Functions)
- Consider falling back to Sonnet for simpler protocols
- Add a per-IP daily cap before burn is too painful

## License

MIT — do whatever you want, but a link back is appreciated.
