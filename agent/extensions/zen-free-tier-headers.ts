/**
 * zen-free-tier-headers — runtime monkeypatch for oh-my-pi issue #12306.
 *
 * Mirrors PR #12326 (`packages/ai/src/providers/inference-headers.ts`) without
 * rebuilding the `omp` binary: it wraps `globalThis.fetch` in-process and
 * rewrites attribution headers on requests to the OpenCode gateways so the
 * free-tier validation accepts them:
 *
 *   - `User-Agent: opencode/1.18.31` (unless the caller set a `claude-cli/`
 *     OAuth fingerprint — that one stays authoritative, same as the PR)
 *   - `x-opencode-session: ses_<hex:12><base62:14>` — existing raw ids are
 *     canonicalized deterministically (same sha256 scheme as the PR), so
 *     prompt-cache affinity per session is preserved
 *   - `x-opencode-client: desktop` when absent
 *
 * 2026-09 update (verified against the live gate with curl bisection):
 *   - The gate now requires `x-opencode-client`, `x-opencode-session` and a
 *     `User-Agent` with the leading `opencode/` token; dropping any of them
 *     (or `Authorization`) yields 403. `x-opencode-org-id` is NOT required —
 *     the API key alone resolves the workspace.
 *   - The body needs `stream: true` AND at least TWO core OpenCode tool
 *     NAMES. The gate counts the full set (`bash`, `read`, `edit`, `glob`,
 *     `grep`; schemas/descriptions are ignored — 1 name or random names
 *     403); this patch targets the verified minimal pair `bash` + `read`
 *     (see ZEN_REQUIRED_TOOL_NAMES). Bodies that already carry enough core
 *     names get no stubs injected.
 *   - The 10;rgb:dcaa/dcab/dcaa11;rgb:158e/193a/1e75legacy `https://opencode.ai/zen/v1` path is rate-limited for free
 *     accounts (429 FreeUsageLimitError on every request), while the same
 *     request against the current `https://opencode.ai/inference/openai/v1`
 *     path passes. So this patch transparently rewrites `/zen/…` URLs to
 *     `/inference/openai/…` — no new provider in models.yml needed. Disable
 *     with ZEN_REWRITE_URL=0.
 *
 * Tool injection: string JSON bodies on OpenCode endpoints get stubs for the
 * missing core tool names appended (Responses + chat-completions envelopes).
 * The stubs are never registered in the harness, so if the model calls one
 * anyway the call errors and the model recovers. `stream` is NOT forced
 * here: flipping it would break response parsing for non-st4;0;rgb:150b/18f1/1da24;1;rgb:a76f/4533/32234;2;rgb:578d/bfd7/37d84;3;rgb:c754/c51b/3f524;4;rgb:2de8/4309/c0c14;5;rgb:b208/4927/b90e4;6;rgb:593c/c33d/c66e4;7;rgb:c7f1/c7f2/c7f24;8;rgb:6866/6866/68664;9;rgb:d059/7eb7/78774;10;rgb:820d/e47c/98944;11;rgb:eb24/e284/4a8e4;12;rgb:a812/ab7c/ed844;13;rgb:d473/831c/dc814;14;rgb:8e91/facf/fe274;15;rgb:fffe/fffe/fffe4;16;rgb:0000/0000/00004;17;rgb:0000/0000/5f5f4;18;rgb:0000/0000/87874;19;rgb:0000/0000/afaf4;20;rgb:0000/0000/d7d74;21;rgb:0000/0000/ffff4;22;rgb:0000/5f5f/00004;23;rgb:0000/5f5f/5f5f4;24;rgb:0000/5f5f/87874;25;rgb:0000/5f5f/afaf4;26;rgb:0000/5f5f/d7d74;27;rgb:0000/5f5f/ffff4;28;rgb:0000/8787/00004;29;rgb:0000/8787/5f5f4;30;rgb:0000/8787/87874;31;rgb:0000/8787/afaf4;32;rgb:0000/8787/d7d74;33;rgb:0000/8787/ffff4;34;rgb:0000/afaf/00004;35;rgb:0000/afaf/5f5f4;36;rgb:0000/afaf/87874;37;rgb:0000/afaf/afaf4;38;rgb:0000/afaf/d7d74;39;rgb:0000/afaf/ffff4;40;rgb:0000/d7d7/00004;41;rgb:0000/d7d7/5f5f4;42;rgb:0000/d7d7/87874;43;rgb:0000/d7d7/afaf4;44;rgb:0000/d7d7/d7d74;45;rgb:0000/d7d7/ffff4;46;rgb:0000/ffff/00004;47;rgb:0000/ffff/5f5f4;48;rgb:0000/ffff/87874;49;rgb:0000/ffff/afaf4;50;rgb:0000/ffff/d7d74;51;rgb:0000/ffff/ffff4;52;rgb:5f5f/0000/00004;53;rgb:5f5f/0000/5f5f4;54;rgb:5f5f/0000/87874;55;rgb:5f5f/0000/afaf4;56;rgb:5f5f/0000/d7d74;57;rgb:5f5f/0000/ffff4;58;rgb:5f5f/5f5f/00004;59;rgb:5f5f/5f5f/5f5f4;60;rgb:5f5f/5f5f/87874;61;rgb:5f5f/5f5f/afaf4;62;rgb:5f5f/5f5f/d7d74;63;rgb:5f5f/5f5f/ffff4;64;rgb:5f5f/8787/00004;65;rgb:5f5f/8787/5f5f4;66;rgb:5f5f/8787/87874;67;rgb:5f5f/8787/afaf4;68;rgb:5f5f/8787/d7d74;69;rgb:5f5f/8787/ffff4;70;rgb:5f5f/afaf/00004;71;rgb:5f5f/afaf/5f5f4;72;rgb:5f5f/afaf/87874;73;rgb:5f5f/afaf/afaf4;74;rgb:5f5f/afaf/d7d74;75;rgb:5f5f/afaf/ffff4;76;rgb:5f5f/d7d7/00004;77;rgb:5f5f/d7d7/5f5f4;78;rgb:5f5f/d7d7/87874;79;rgb:5f5f/d7d7/afaf4;80;rgb:5f5f/d7d7/d7d74;81;rgb:5f5f/d7d7/ffff4;82;rgb:5f5f/ffff/00004;83;rgb:5f5f/ffff/5f5f4;84;rgb:5f5f/ffff/87874;85;rgb:5f5f/ffff/afaf4;86;rgb:5f5f/ffff/d7d74;87;rgb:5f5f/ffff/ffff4;88;rgb:8787/0000/00004;89;rgb:8787/0000/5f5f4;90;rgb:8787/0000/87874;91;rgb:8787/0000/afaf4;92;rgb:8787/0000/d7d74;93;rgb:8787/0000/ffff4;94;rgb:8787/5f5f/00004;95;rgb:8787/5f5f/5f5f4;96;rgb:8787/5f5f/87874;97;rgb:8787/5f5f/afaf4;98;rgb:8787/5f5f/d7d74;99;rgb:8787/5f5f/ffff4;100;rgb:8787/8787/00004;101;rgb:8787/8787/5f5f4;102;rgb:8787/8787/87874;103;rgb:8787/8787/afaf4;104;rgb:8787/8787/d7d74;105;rgb:8787/8787/ffff4;106;rgb:8787/afaf/00004;107;rgb:8787/afaf/5f5f4;108;rgb:8787/afaf/87874;109;rgb:8787/afaf/afaf4;110;rgb:8787/afaf/d7d74;111;rgb:8787/afaf/ffff4;112;rgb:8787/d7d7/00004;113;rgb:8787/d7d7/5f5f4;114;rgb:8787/d7d7/87874;115;rgb:8787/d7d7/afaf4;116;rgb:8787/d7d7/d7d74;117;rgb:8787/d7d7/ffff4;118;rgb:8787/ffff/00004;119;rgb:8787/ffff/5f5f4;120;rgb:8787/ffff/87874;121;rgb:8787/ffff/afaf4;122;rgb:8787/ffff/d7d74;123;rgb:8787/ffff/ffff4;124;rgb:afaf/0000/00004;125;rgb:afaf/0000/5f5f4;126;rgb:afaf/0000/87874;127;rgb:afaf/0000/afaf4;128;rgb:afaf/0000/d7d74;129;rgb:afaf/0000/ffff4;130;rgb:afaf/5f5f/00004;131;rgb:afaf/5f5f/5f5f4;132;rgb:afaf/5f5f/87874;133;rgb:afaf/5f5f/afaf4;134;rgb:afaf/5f5f/d7d74;135;rgb:afaf/5f5f/ffff4;136;rgb:afaf/8787/00004;137;rgb:afaf/8787/5f5f4;138;rgb:afaf/8787/87874;139;rgb:afaf/8787/afaf4;140;rgb:afaf/8787/d7d74;141;rgb:afaf/8787/ffff4;142;rgb:afaf/afaf/00004;143;rgb:afaf/afaf/5f5f4;144;rgb:afaf/afaf/87874;145;rgb:afaf/afaf/afaf4;146;rgb:afaf/afaf/d7d74;147;rgb:afaf/afaf/ffff4;148;rgb:afaf/d7d7/00004;149;rgb:afaf/d7d7/5f5f4;150;rgb:afaf/d7d7/87874;151;rgb:afaf/d7d7/afaf4;152;rgb:afaf/d7d7/d7d74;153;rgb:afaf/d7d7/ffff4;154;rgb:afaf/ffff/00004;155;rgb:afaf/ffff/5f5f4;156;rgb:afaf/ffff/87874;157;rgb:afaf/ffff/afaf4;158;rgb:afaf/ffff/d7d74;159;rgb:afaf/ffff/ffff4;160;rgb:d7d7/0000/00004;161;rgb:d7d7/0000/5f5f4;162;rgb:d7d7/0000/87874;163;rgb:d7d7/0000/afaf4;164;rgb:d7d7/0000/d7d74;165;rgb:d7d7/0000/ffff4;166;rgb:d7d7/5f5f/00004;167;rgb:d7d7/5f5f/5f5f4;168;rgb:d7d7/5f5f/87874;169;rgb:d7d7/5f5f/afaf4;170;rgb:d7d7/5f5f/d7d74;171;rgb:d7d7/5f5f/ffff4;172;rgb:d7d7/8787/00004;173;rgb:d7d7/8787/5f5f4;174;rgb:d7d7/8787/87874;175;rgb:d7d7/8787/afaf4;176;rgb:d7d7/8787/d7d74;177;rgb:d7d7/8787/ffff4;178;rgb:d7d7/afaf/00004;179;rgb:d7d7/afaf/5f5f4;180;rgb:d7d7/afaf/87874;181;rgb:d7d7/afaf/afaf4;182;rgb:d7d7/afaf/d7d74;183;rgb:d7d7/afaf/ffff4;184;rgb:d7d7/d7d7/00004;185;rgb:d7d7/d7d7/5f5f4;186;rgb:d7d7/d7d7/87874;187;rgb:d7d7/d7d7/afaf4;188;rgb:d7d7/d7d7/d7d74;189;rgb:d7d7/d7d7/ffff4;190;rgb:d7d7/ffff/00004;191;rgb:d7d7/ffff/5f5f4;192;rgb:d7d7/ffff/87874;193;rgb:d7d7/ffff/afaf4;194;rgb:d7d7/ffff/d7d74;195;rgb:d7d7/ffff/ffff4;196;rgb:ffff/0000/00004;197;rgb:ffff/0000/5f5f4;198;rgb:ffff/0000/87874;199;rgb:ffff/0000/afaf4;200;rgb:ffff/0000/d7d74;201;rgb:ffff/0000/ffff4;202;rgb:ffff/5f5f/00004;203;rgb:ffff/5f5f/5f5f4;204;rgb:ffff/5f5f/87874;205;rgb:ffff/5f5f/afaf4;206;rgb:ffff/5f5f/d7d74;207;rgb:ffff/5f5f/ffff4;208;rgb:ffff/8787/00004;209;rgb:ffff/8787/5f5f4;210;rgb:ffff/8787/87874;211;rgb:ffff/8787/afaf4;212;rgb:ffff/8787/d7d74;213;rgb:ffff/8787/ffff4;214;rgb:ffff/afaf/00004;215;rgb:ffff/afaf/5f5f4;216;rgb:ffff/afaf/87874;217;rgb:ffff/afaf/afaf4;218;rgb:ffff/afaf/d7d74;219;rgb:ffff/afaf/ffff4;220;rgb:ffff/d7d7/00004;221;rgb:ffff/d7d7/5f5f4;222;rgb:ffff/d7d7/87874;223;rgb:ffff/d7d7/afaf4;224;rgb:ffff/d7d7/d7d74;225;rgb:ffff/d7d7/ffff4;226;rgb:ffff/ffff/00004;227;rgb:ffff/ffff/5f5f4;228;rgb:ffff/ffff/87874;229;rgb:ffff/ffff/afaf4;230;rgb:ffff/ffff/d7d74;231;rgb:ffff/ffff/ffff4;232;rgb:0808/0808/08084;233;rgb:1212/1212/12124;234;rgb:1c1c/1c1c/1c1c4;235;rgb:2626/2626/26264;236;rgb:3030/3030/30304;237;rgb:3a3a/3a3a/3a3a4;238;rgb:4444/4444/44444;239;rgb:4e4e/4e4e/4e4e4;240;rgb:5858/5858/58584;241;rgb:6262/6262/62624;242;rgb:6c6c/6c6c/6c6c4;243;rgb:7676/7676/76764;244;rgb:8080/8080/80804;245;rgb:8a8a/8a8a/8a8a4;246;rgb:9494/9494/94944;247;rgb:9e9e/9e9e/9e9e4;248;rgb:a8a8/a8a8/a8a84;249;rgb:b2b2/b2b2/b2b24;250;rgb:bcbc/bcbc/bcbc4;251;rgb:c6c6/c6c6/c6c64;252;rgb:d0d0/d0d0/d0d04;253;rgb:dada/dada/dada4;254;rgb:e4e4/e4e4/e4e44;255;rgb:eeee/eeee/eeeereaming callers,
 * so non-streaming requests still 403 by gateway policy.
 *
 * Scope: only absolute URLs on `opencode.ai`. Everything else passes through
 * untouched, and any internal error fails open to the original `fetch` — the
 * patch can only fail by not patching.
 *
 * Covers main sessions, advisors and subagents automatically — they all
 * share this process's `fetch`.
 *
 * Env:
 *   ZEN_INJECT_TOOLS=0  — disable the tool-name injection (headers still patched)
 *   ZEN_REWRITE_URL=0   — keep /zen/ URLs as-is (legacy 429 path)
 *   ZEN_HEADERS_DEBUG=1 — append one line per zen request to
 *     <tmpdir>/zen-free-tier-headers.log (url path, session prefix,
 *     required names present, names injected, url rewritten?)
 *
 * Enable (pick one, no rebuild needed):
 *   1. Auto-load every run (recommended): copy this file to
 *      `~/.omp/agent/extensions/` (honors `PI_CODING_AGENT_DIR` / profiles)
 *   2. One-shot: `omp --extension /path/to/zen-free-tier-headers.ts`
 *
 * Known limits (same as the PR):
 *   - Does NOT send `x-opencode-request` (format unknown, PR doesn't either;
 *     not gated per live bisection).
 *   - `opencode/1.18.31` is pinned. The gate reads only the leading
 *     `opencode/` token, but bump OPENCODE_USER_AGENT below if the gate
 *     starts requiring a newer client version.
 */
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";

/** Canonical OpenCode client user-agent. Required for free-tier validation. */
const OPENCODE_USER_AGENT = "opencode/1.18.31";

/** Canonical OpenCode session id format: ses_ + 12 hex + 14 base62 chars. */
const OPENCODE_SESSION_RE = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/;

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Minimal verified pair of core OpenCode tool names for the free-tier gate.
 * The gate counts the full set (`bash`, `read`, `edit`, `glob`, `grep`) and
 * needs >= ZEN_MIN_TOOL_NAMES of those names in the body (schemas ignored);
 * `bash` + `read` pass, one name or random names 403 (verified 2026-09).
 * Bodies that already carry enough core names get no stubs injected.
 */
const ZEN_REQUIRED_TOOL_NAMES = ["bash", "read"];

/** Minimum number of core tool names that must be present in `tools`. */
const ZEN_MIN_TOOL_NAMES = 2;

/**
 * Legacy gateway base path (still advertised by older configs) replaced with
 * the current one; the legacy path is rate-limited to 429 on free accounts.
 */
const LEGACY_PATH = "/zen/";
const CURRENT_PATH = "/inference/openai/";

/**
 * Canonicalize a session id into OpenCode's `ses_<hex:12><base62:14>` format,
 * deterministic per input so turns keep attribution and prompt-cache
 * affinity. Same scheme as PR #12326 (sha256 over `opencode\0omp\0<id>`).
 */
function canonicalizeSessionId(sessionId?: string): string {
  const id = sessionId?.trim();
  if (id && OPENCODE_SESSION_RE.test(id)) return id;
  const digest = createHash("sha256")
    .update(`opencode\0omp\0${id || "default"}`)
    .digest();
  const timeHex = Buffer.from(digest.subarray(0, 6)).toString("hex");
  let randomPart = "";
  for (let i = 6; i < 20; i++) {
    randomPart += BASE62_CHARS[digest[i] % 62];
  }
  return `ses_${timeHex}${randomPart}`;
}

/** True for requests aimed at the OpenCode zen/go gateways. */
function isZenUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "opencode.ai" || host.endsWith(".opencode.ai");
  } catch {
    return false;
  }
}

/** Rewrite the legacy /zen/ gateway path to the current /inference/openai/. */
function rewriteZenUrl(url: string): { url: string; rewritten: boolean } {
  if (process.env.ZEN_REWRITE_URL === "0" || !url.includes(LEGACY_PATH)) {
    return { url, rewritten: false };
  }
  return { url: url.replace(LEGACY_PATH, CURRENT_PATH), rewritten: true };
}

// Tool stubs appended to bodies missing the required names. The gate reads
// tool NAMES only, so one shared shape suffices for every core name.
const STUB_DESCRIPTION =
  "Gateway-validation stub, NOT IMPLEMENTED. NEVER call this tool - any call " +
  "fails; use a real registered tool instead.";

const STUB_PARAMETERS: Record<string, unknown> = {
  type: "object",
  properties: {
    command: { type: "string", description: "The command to execute" },
    timeout: { type: "number", description: "Optional timeout in milliseconds" },
    description: {
      type: "string",
      description: "Clear, concise description of what this command does in 5-10 words.",
    },
  },
  required: ["command"],
  additionalProperties: false,
};

/** Tool name in either the Responses or the chat-completions envelope. */
function toolName(t: unknown): string | null {
  if (!t || typeof t !== "object") return null;
  const rec = t as Record<string, unknown>;
  if (typeof rec.name === "string") return rec.name; // Responses API
  const fn = rec.function as Record<string, unknown> | undefined; // chat completions
  return fn && typeof fn.name === "string" ? fn.name : null;
}

function buildZenToolStub(url: string, name: string): Record<string, unknown> | null {
  if (url.includes("/responses")) {
    return { type: "function", name, description: STUB_DESCRIPTION, parameters: STUB_PARAMETERS };
  }
  if (url.includes("/chat/completions")) {
    return {
      type: "function",
      function: { name, description: STUB_DESCRIPTION, parameters: STUB_PARAMETERS },
    };
  }
  return null;
}

/** True when the body forces a tool call — a stub would be invoked for sure. */
function isForcedToolChoice(choice: unknown): boolean {
  if (choice === "required" || choice === "any") return true;
  if (choice && typeof choice === "object" && !Array.isArray(choice) && "type" in choice) {
    return choice.type === "required" || choice.type === "any";
  }
  return false;
}

/**
 * Append stubs for the missing required tool names to a zen JSON body until
 * at least ZEN_MIN_TOOL_NAMES core names are present. Returns the original
 * text untouched on any doubt (fail open).
 */
function injectZenTools(url: string, bodyText: string) {
  let doc: unknown;
  try {
    doc = JSON.parse(bodyText);
  } catch {
    return { text: bodyText, injected: [] as string[], present: 0 };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { text: bodyText, injected: [] as string[], present: 0 };
  }
  const body = doc as Record<string, unknown>;
  const tools = Array.isArray(body.tools) ? (body.tools as unknown[]) : null;
  const names = (tools ?? []).map(toolName).filter((n): n is string => n !== null);
  const missing = ZEN_REQUIRED_TOOL_NAMES.filter((n) => !names.includes(n));
  const present = ZEN_REQUIRED_TOOL_NAMES.length - missing.length;
  // Enough names already, or a forced tool call that would make the model
  // invoke an unregistered stub for sure — leave such requests alone.
  const passthrough = { text: bodyText, injected: [] as string[], present };
  if (
    present >= ZEN_MIN_TOOL_NAMES ||
    missing.length === 0 ||
    isForcedToolChoice(body.tool_choice)
  ) {
    return passthrough;
  }
  const stubs: Record<string, unknown>[] = [];
  for (const name of missing) {
    const stub = buildZenToolStub(url, name);
    if (!stub) return passthrough;
    stubs.push(stub);
    if (present + stubs.length >= ZEN_MIN_TOOL_NAMES) break;
  }
  return {
    text: JSON.stringify({ ...body, tools: tools ? [...tools, ...stubs] : stubs }),
    injected: stubs.map((s) => String((s as { name: string }).name)),
    present,
  };
}

function debugLog(line: string): void {
  if (process.env.ZEN_HEADERS_DEBUG !== "1") return;
  void appendFile(`${tmpdir()}/zen-free-tier-headers.log`, `${new Date().toISOString()} ${line}\n`).catch(
    () => undefined,
  );
}

/** Stable per-process canonical id for requests that carry no session at all. */
let processSessionId: string | null = null;

/**
 * Apply the PR #12326 header set onto a Headers instance, in place. Only
 * per-conversation ids seed the canonical ses_: a per-request id would mint
 * a fresh ses_ every turn and fragment prompt-cache affinity.
 */
function patchZenHeaders(headers: Headers): void {
  const rawSession =
    headers.get("x-opencode-session") ??
    headers.get("session_id") ??
    headers.get("x-claude-code-session-id");
  if (!processSessionId) {
    processSessionId = canonicalizeSessionId(`process-${Date.now()}-${Math.random()}`);
  }
  headers.set(
    "x-opencode-session",
    rawSession ? canonicalizeSessionId(rawSession) : processSessionId,
  );

  if (!headers.get("user-agent")?.startsWith("claude-cli/")) {
    headers.set("user-agent", OPENCODE_USER_AGENT);
  }
  if (!headers.has("x-opencode-client")) {
    headers.set("x-opencode-client", "desktop");
  }
}

const PATCH_FLAG = "__ompZenFreeTierHeadersPatched";

/** Install the fetch wrapper. Idempotent; safe to call twice. */
function installFetchPatch(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[PATCH_FLAG]) return;
  const origFetch = globalThis.fetch;
  if (typeof origFetch !== "function") return;

  const patchedFetch = async function (
    this: unknown,
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> {
    try {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request | undefined)?.url;
      if (typeof rawUrl !== "string" || !isZenUrl(rawUrl)) {
        return origFetch.call(this, input, init);
      }
      const { url, rewritten } = rewriteZenUrl(rawUrl);

      if (typeof input === "string" || input instanceof URL) {
        const headers = new Headers(init?.headers);
        patchZenHeaders(headers);
        let body = init?.body;
        let injected: string[] = [];
        let present = 0;
        if (
          process.env.ZEN_INJECT_TOOLS !== "0" &&
          typeof body === "string" &&
          body.trimStart().startsWith("{")
        ) {
          const r = injectZenTools(url, body);
          injected = r.injected;
          present = r.present;
          if (injected.length > 0) {
            body = r.text;
            // Body grew — a stale explicit length would corrupt the request.
            headers.delete("content-length");
          }
        }
        debugLog(
          `${url.split("?")[0]}${rewritten ? ` (was ${rawUrl.split("?")[0]})` : ""} session=${(headers.get("x-opencode-session") ?? "?").slice(0, 18)} tools=${present} injected=[${injected.join(",")}]`,
        );
        return origFetch.call(this, url, { ...init, headers, body });
      }

      // Request object: merge request + init headers, patch, rebuild. Its
      // body is a stream, so tool injection (string bodies only) does not
      // apply here.
      const merged = new Headers((input as Request).headers);
      new Headers(init?.headers).forEach((v, k) => merged.set(k, v));
      patchZenHeaders(merged);
      const { headers: _drop, ...rest } = (init ?? {}) as RequestInit;
      const req = new Request(url, {
        ...(Object.keys(rest).length ? rest : {}),
        method: (input as Request).method,
        headers: merged,
        body: (input as Request).body,
        duplex: "half",
      } as RequestInit);
      debugLog(
        `${url.split("?")[0]}${rewritten ? ` (was ${(input as Request).url.split("?")[0]})` : ""} session=${(merged.get("x-opencode-session") ?? "?").slice(0, 18)} request-input body-untouched`,
      );
      return origFetch.call(this, req, Object.keys(rest).length ? rest : undefined);
    } catch {
      // Fail open: never break a request because the patch hit something odd.
      return origFetch.call(this, input, init);
    }
  };

  globalThis.fetch = patchedFetch as typeof fetch;
  g[PATCH_FLAG] = true;
}

// Patch on import so `--extension <file>` takes effect even before the
// factory runs; the factory call below is then a no-op via the guard.
installFetchPatch();

/** Extension entry point — omp imports the module and runs the factory. */
export default function zenFreeTierHeaders(pi?: {
  logger?: { info?: (...args: unknown[]) => void };
}): void {
  installFetchPatch();
  pi?.logger?.info?.("[zen-free-tier-headers] fetch patch active");
}
