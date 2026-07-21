"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  FileCode2,
  Loader2,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusLabel, type Severity } from "@/components/soc/flagship-ui";
import { ruleTypeName } from "@/lib/rule-types";
import type { IntegrationRecord, RuleRecord } from "@/lib/api";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
type Tab = "details" | "assistant";

async function backend(path: string, init?: RequestInit) {
  const resp = await fetch(`/api/backend/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.status === 204 ? null : resp.json();
}

export function RuleEditor({ rule: initial, integrations }: { rule: RuleRecord; integrations: IntegrationRecord[] }) {
  const router = useRouter();
  const [rule, setRule] = useState(initial);
  const [yamlText, setYamlText] = useState(initial.yaml);
  const [title, setTitle] = useState(initial.title);
  const [severity, setSeverity] = useState<Severity>(initial.severity as Severity);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [tab, setTab] = useState<Tab>("details");
  const [busy, setBusy] = useState<"" | "save" | "apply" | "gen" | "delete">("");
  const [notice, setNotice] = useState("");

  // Assistant state
  const [prompt, setPrompt] = useState("");
  const [generated, setGenerated] = useState("");
  const genRef = useRef<HTMLDivElement>(null);

  const connected = integrations.filter((i) => i.status === "connected");
  const [target, setTarget] = useState(rule.integration ?? connected[0]?.provider ?? "");

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags((c) => [...c, t]);
    setTagDraft("");
  }

  async function save() {
    setBusy("save");
    setNotice("");
    try {
      const updated = (await backend(`rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ title, severity, tags, enabled, yaml: yamlText }),
      })) as RuleRecord;
      setRule(updated);
      setNotice(`Saved · version ${updated.version}`);
    } catch {
      setNotice("Save failed.");
    } finally {
      setBusy("");
    }
  }

  async function apply() {
    if (!target) {
      setNotice("No connected integration to deploy to — connect one first.");
      return;
    }
    setBusy("apply");
    setNotice("");
    try {
      const updated = (await backend(`rules/${rule.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ integration: target }),
      })) as RuleRecord;
      setRule(updated);
      setEnabled(true);
      setNotice(`Deployed to ${target} · rule enabled`);
    } catch {
      setNotice(`Deploy to ${target} failed — is it connected?`);
    } finally {
      setBusy("");
    }
  }

  async function toggleDisable() {
    setBusy("save");
    try {
      const updated = (await backend(`rules/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !enabled }),
      })) as RuleRecord;
      setRule(updated);
      setEnabled(updated.enabled);
      setNotice(updated.enabled ? "Rule enabled." : "Rule disabled.");
    } catch {
      setNotice("Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function duplicate() {
    setBusy("save");
    try {
      const copy = (await backend("rules", {
        method: "POST",
        body: JSON.stringify({ title: `${title} (copy)`, type: rule.type, severity, tags, yaml: yamlText }),
      })) as RuleRecord;
      router.push(`/rules/${copy.id}`);
    } catch {
      setNotice("Duplicate failed.");
      setBusy("");
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await backend(`rules/${rule.id}`, { method: "DELETE" });
      router.push("/rules");
    } catch {
      setNotice("Delete failed.");
      setBusy("");
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setBusy("gen");
    setGenerated("");
    try {
      const res = (await backend("assistant/vibe-rule", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      })) as { content?: string };
      const raw = res.content ?? "";
      // Prefer the fenced YAML block; fall back to the raw text.
      const fence = raw.match(/```ya?ml\s*([\s\S]*?)```/i) ?? raw.match(/```\s*([\s\S]*?)```/);
      const content = (fence ? fence[1] : raw).trim();
      setGenerated(content || "The agent returned no rule.");
      setTimeout(() => genRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setGenerated("⚠️ Generation failed — check the Detection-Engineering agent / OpenRouter key.");
    } finally {
      setBusy("");
    }
  }

  function applyGenerated() {
    setYamlText(generated);
    const m = generated.match(/^title:\s*(.+)$/m);
    if (m) setTitle(m[1].trim());
    setTab("details");
    setNotice("Generated rule loaded into the editor — review and Save.");
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background pb-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 lg:px-5">
        <button type="button" aria-label="Back" onClick={() => router.push("/rules")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{title || "Untitled rule"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{rule.author ?? "—"}</span>
            <span className="inline-flex items-center gap-1 rounded-control border border-border px-1.5 py-0.5"><FileCode2 className="size-3" /> {ruleTypeName(rule.type)}</span>
            <StatusLabel tone={enabled ? "green" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</StatusLabel>
            <span>v{rule.version}</span>
            {rule.integration ? <span className="inline-flex items-center gap-1 text-primary">→ {rule.integration}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={save} disabled={busy !== ""}>{busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save Changes</Button>
          <Button size="sm" variant="secondary" onClick={duplicate} disabled={busy !== ""}><Copy /> Duplicate</Button>
          <Button size="sm" variant="secondary" onClick={toggleDisable} disabled={busy !== ""}><Ban /> {enabled ? "Disable" : "Enable"}</Button>
          <Button size="sm" variant="danger" onClick={remove} disabled={busy !== ""}>{busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete</Button>
        </div>
      </div>

      {notice ? <div className="mx-4 mt-4 rounded-control border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary lg:mx-5">{notice}</div> : null}

      <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5">
        <div className="soc-panel overflow-hidden">
          <div className="border-b border-border bg-surface-subtle/35 px-3 py-2 text-xs text-muted-foreground">Rule definition (YAML)</div>
          <textarea
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            spellCheck={false}
            className="h-[560px] w-full resize-none bg-[#0d1117] p-4 font-mono text-xs leading-5 text-[#c9d1d9] outline-none"
          />
        </div>

        <div className="soc-panel overflow-hidden">
          <div className="flex border-b border-border">
            {(["details", "assistant"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm capitalize ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "details" ? <FileCode2 className="size-4" /> : <Sparkles className="size-4" />} {t}
              </button>
            ))}
          </div>

          {tab === "details" ? (
            <div className="space-y-4 p-4">
              <label className="block space-y-1 text-sm">
                <span className="soc-label">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-control border border-border bg-surface px-3 outline-none focus:border-primary" />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="soc-label">Severity</span>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="h-9 w-full rounded-control border border-border bg-surface px-3 capitalize outline-none focus:border-primary">
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div className="space-y-1 text-sm">
                <span className="soc-label">Tags</span>
                <div className="flex flex-wrap gap-1.5 rounded-control border border-border bg-surface p-2">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {t}
                      <button type="button" onClick={() => setTags((c) => c.filter((x) => x !== t))}>×</button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag…"
                    className="min-w-[80px] flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between text-sm">
                <span className="soc-label">Status</span>
                <button type="button" onClick={() => setEnabled((v) => !v)} className={`h-6 w-11 rounded-full p-0.5 transition ${enabled ? "bg-primary" : "bg-surface"}`}>
                  <span className={`block size-5 rounded-full bg-white transition ${enabled ? "translate-x-5" : ""}`} />
                </button>
              </label>

              <div className="rounded-control border border-border p-3">
                <p className="soc-label mb-2">Deploy to integration</p>
                <div className="flex gap-2">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 flex-1 rounded-control border border-border bg-surface px-3 text-sm outline-none focus:border-primary">
                    {connected.length === 0 ? <option value="">No connected integrations</option> : null}
                    {connected.map((i) => <option key={i.id} value={i.provider}>{i.name} ({i.provider})</option>)}
                  </select>
                  <Button size="sm" variant="primary" onClick={apply} disabled={busy !== "" || !target}>
                    {busy === "apply" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Deploy
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {rule.integration ? `Live on ${rule.integration}.` : "Binds and enables the rule on a connected source."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-[560px] flex-col p-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Describe the detection in plain English. The Detection-Engineering agent (Argus) writes and validates the rule.
              </p>
              <div className="soc-scrollbar flex-1 space-y-3 overflow-y-auto">
                {generated ? (
                  <div ref={genRef} className="rounded-control border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium"><Sparkles className="size-3.5 text-primary" /> Generated rule</span>
                      <Button size="sm" variant="primary" onClick={applyGenerated}><CheckCircle2 /> Apply the code</Button>
                    </div>
                    <pre className="soc-scrollbar max-h-72 overflow-auto bg-[#0d1117] p-3 font-mono text-[11px] leading-5 text-[#c9d1d9]">{generated}</pre>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No generation yet.</p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                  rows={2}
                  placeholder="e.g. Detect systems connecting to many distinct ports in an hour"
                  className="flex-1 resize-none rounded-control border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <Button size="icon" variant="primary" onClick={generate} disabled={busy !== "" || !prompt.trim()} aria-label="Generate">
                  {busy === "gen" ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
