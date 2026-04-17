// netlify/functions/generate.js
// Serverless function that generates a complete UVM testbench using Claude.
// Keeps ANTHROPIC_API_KEY on the server side so it's never exposed to the browser.

const ALLOWED_PROTOCOLS = ['axi-lite'];
const ALLOWED_WIDTHS = [8, 16, 32, 64, 128];
const ALLOWED_ROLES = ['master', 'slave', 'both'];
const ALLOWED_FEATURES = new Set([
  'scoreboard', 'coverage', 'assertions', 'register_model', 'error_injection'
]);

// ---------------------------------------------------------------------------
// System prompt — the actual moat. This is where 13 years of DV experience
// gets compressed into instructions that shape Claude's output.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a Senior Design Verification engineer with 15+ years of production UVM experience on high-speed protocols (PCIe Gen4/5, NVMe, AXI, AHB, APB) at tier-1 silicon companies. You write UVM code the way it actually ships in production — not the way textbooks or online tutorials write it.

# Your output standards

**Architecture**
- Layered UVM: transaction (seq_item) → sequence → sequencer → driver/monitor → agent → env → test
- Always use \`uvm_component_utils\` / \`uvm_object_utils\` with factory registration
- Config DB for all runtime configuration — NEVER hardcode
- Virtual interfaces passed via uvm_config_db, set in the test's build_phase
- Parameterized classes where widths are involved (address, data)
- Clear phase separation: build_phase / connect_phase / run_phase
- Passive agents for monitoring-only scenarios (is_active = UVM_PASSIVE)

**Coding style**
- snake_case for variables and functions, UpperCamelCase only for types where idiomatic
- Every class has a proper constructor with \`super.new\` and name
- Use \`uvm_info\`, \`uvm_warning\`, \`uvm_error\`, \`uvm_fatal\` with verbosity (UVM_LOW, UVM_MEDIUM, UVM_HIGH)
- Message IDs are the class name in ALL_CAPS (e.g., \`\`"AXI_DRIVER"\`\`)
- Clocking blocks inside the interface for all synchronous signaling
- \`default disable iff (!rst_n)\` on SVA properties
- TLM ports/exports properly connected in connect_phase
- Analysis ports from monitors — NEVER tight-couple monitor to scoreboard
- Randomization with \`rand\` and proper constraints; use \`soft\` constraints where appropriate so tests can override

**Sequences**
- Separate base sequence for shared plumbing, then derived sequences for scenarios
- Use \`\`\`uvm_do_with\`\`\` or \`start()\` with explicit sequencer
- Virtual sequences for multi-agent coordination (even if only one agent today — sets up the pattern)
- Include at least: basic_seq, back_to_back_seq, random_seq, and if error_injection: error_seq

**Coverage** (if requested)
- Covergroups on transaction attributes AND cross coverage
- Sampled in the monitor on analysis port writes — NEVER in the driver
- Goal: 100%, with explicit bins not just auto-bins
- \`option.per_instance = 1\`

**Assertions** (if requested)
- Protocol-level properties in the interface file, not scattered in the DUT
- VALID held stable until READY (for handshaking protocols)
- No X-propagation on control signals
- Named properties with descriptive failure messages

**Register model** (if requested)
- Use \`uvm_reg\`, \`uvm_reg_block\`, \`uvm_reg_field\`
- Predictor + adapter connected in env's connect_phase
- Default map with proper address offsets

# File structure you MUST produce

Return a complete multi-file UVM project. Every file is necessary; do not collapse into one.

Required files:
1. \`{dut}_if.sv\` — SystemVerilog interface with clocking blocks + assertions (if enabled)
2. \`{dut}_seq_item.sv\` — transaction class, extends uvm_sequence_item
3. \`{dut}_sequencer.sv\` — typedef or class, extends uvm_sequencer
4. \`{dut}_driver.sv\` — extends uvm_driver, drives the interface
5. \`{dut}_monitor.sv\` — extends uvm_monitor, samples the interface, publishes via analysis port
6. \`{dut}_agent.sv\` — extends uvm_agent, instantiates driver/monitor/sequencer
7. \`{dut}_env.sv\` — extends uvm_env, instantiates agent(s) + scoreboard/coverage if enabled
8. \`{dut}_scoreboard.sv\` — if requested; extends uvm_scoreboard with analysis_imp
9. \`{dut}_coverage.sv\` — if requested; extends uvm_subscriber with covergroups
10. \`{dut}_base_test.sv\` — extends uvm_test, sets up env, common config
11. \`{dut}_tests.sv\` — 3+ concrete test classes (sanity, random, stress, error if enabled)
12. \`{dut}_sequences.sv\` — all sequence classes
13. \`{dut}_pkg.sv\` — package with \`include for all files + \`import uvm_pkg
14. \`tb_top.sv\` — module with clock/reset gen, DUT stub, interface instance, run_test()
15. \`Makefile\` — targets for vcs/xcelium/questa compile + run
16. \`README.md\` — how to compile, run, and integrate

# Critical rules

- ALWAYS \`\`\`include "uvm_macros.svh"\` and \`\`\`import uvm_pkg::*\`\` in the package
- Interface signals named per the protocol spec (for AXI: awvalid, awready, awaddr, wdata, wstrb, etc.)
- Driver blocks on \`seq_item_port.get_next_item\` / calls \`item_done\`
- Monitor samples on clock edges via clocking block — not @(posedge clk) directly on signals
- Scoreboard uses \`uvm_analysis_imp_decl\` if receiving from multiple ports
- Tests register with factory and use \`+UVM_TESTNAME=\` plusarg pattern
- DUT stub should be minimal — just port declarations, no real logic (user plugs in their DUT)
- Every file begins with a standard header comment block (author: Generated by asicverif.ai, date, description)

# Output format — CRITICAL

You MUST respond with ONLY a single valid JSON object. No prose before or after. No markdown fences. No explanations.

The JSON schema is:
{
  "files": {
    "<filename>": "<full file contents as a string>",
    ...
  }
}

Strings must be properly escaped (newlines as \\n, quotes as \\"). Do not truncate any file. Every file must be complete and compile-ready.`;

// ---------------------------------------------------------------------------
// Build the user-facing prompt from the form spec
// ---------------------------------------------------------------------------
function buildUserPrompt(spec) {
  const featureList = spec.features.length
    ? spec.features.map(f => `- ${f.replace('_', ' ')}`).join('\n')
    : '- (basic testbench only)';

  const roleDesc = {
    master: 'Active master agent that drives the DUT (DUT is the slave)',
    slave: 'Active slave agent that responds to the DUT (DUT is the master)',
    both: 'Both master and slave agents (DUT sits between them or self-loop)'
  }[spec.agent_role];

  return `Generate a complete UVM testbench for an **${spec.protocol.toUpperCase()}** interface.

## Design under test
- DUT name: \`${spec.dut_name}\`
- Address width: ${spec.addr_width} bits
- Data width: ${spec.data_width} bits
- Agent role: ${roleDesc}

## Features to include
${featureList}

${spec.notes ? `## DUT-specific notes from the user\n${spec.notes}\n` : ''}
## Protocol reminders (${spec.protocol.toUpperCase()})
- 5 channels: AW (write address), W (write data), B (write response), AR (read address), R (read data)
- Each channel uses VALID/READY handshaking; transfer happens when both asserted on same cycle
- AXI-Lite: no burst (single transfer per transaction), no locked/cached access, no IDs
- Responses: OKAY (2'b00), EXOKAY (2'b01), SLVERR (2'b10), DECERR (2'b11)
- Write strobes (wstrb) width = data_width / 8

Produce the complete file set per your system-prompt spec. Make it compile-clean on VCS, Xcelium, and Questa. Return JSON only.`;
}

// ---------------------------------------------------------------------------
// Input validation — keep it tight so users can't abuse the API key
// ---------------------------------------------------------------------------
function validateSpec(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Invalid request body');
  if (!ALLOWED_PROTOCOLS.includes(body.protocol)) errors.push('Unsupported protocol');
  if (!ALLOWED_WIDTHS.includes(body.addr_width)) errors.push('Invalid address width');
  if (!ALLOWED_WIDTHS.includes(body.data_width)) errors.push('Invalid data width');
  if (!ALLOWED_ROLES.includes(body.agent_role)) errors.push('Invalid agent role');

  const dutName = String(body.dut_name || '').trim();
  if (!/^[a-z][a-z0-9_]{0,31}$/i.test(dutName)) {
    errors.push('DUT name must be alphanumeric/underscore, 1-32 chars, start with a letter');
  }

  const features = Array.isArray(body.features) ? body.features : [];
  if (!features.every(f => ALLOWED_FEATURES.has(f))) errors.push('Invalid feature');

  const notes = String(body.notes || '');
  if (notes.length > 1000) errors.push('Notes must be under 1000 chars');

  return {
    errors,
    clean: errors.length ? null : {
      protocol: body.protocol,
      addr_width: body.addr_width,
      data_width: body.data_width,
      agent_role: body.agent_role,
      dut_name: dutName,
      features,
      notes: notes.trim()
    }
  };
}

// ---------------------------------------------------------------------------
// Call Claude API
// ---------------------------------------------------------------------------
async function callClaude(spec) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Server misconfiguration: ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(spec) }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.map(b => b.type === 'text' ? b.text : '').join('') || '';
  return text;
}

// ---------------------------------------------------------------------------
// Parse Claude's JSON response (handles stray fences just in case)
// ---------------------------------------------------------------------------
function parseClaudeResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  // Find first { and last } to handle any leading/trailing prose
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Claude did not return JSON');
  cleaned = cleaned.slice(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Claude returned malformed JSON. Try again or simplify your request.');
  }

  if (!parsed.files || typeof parsed.files !== 'object') {
    throw new Error('Response missing "files" object');
  }

  const files = {};
  for (const [name, content] of Object.entries(parsed.files)) {
    if (typeof content === 'string' && content.length > 0) {
      // Sanitize filename — strip any path traversal
      const safeName = name.replace(/\.\./g, '').replace(/^\/+/, '');
      files[safeName] = content;
    }
  }

  if (!Object.keys(files).length) throw new Error('No files generated');
  return files;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { errors, clean } = validateSpec(body);
  if (errors.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join('; ') }) };
  }

  try {
    const rawText = await callClaude(clean);
    const files = parseClaudeResponse(rawText);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ files, spec: clean })
    };
  } catch (err) {
    console.error('Generation failed:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Generation failed' })
    };
  }
};
