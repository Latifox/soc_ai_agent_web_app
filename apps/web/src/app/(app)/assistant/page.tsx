import type { Metadata } from "next";

import { AssistantWorkspace } from "./assistant-workspace";
import type { ArgusContext } from "./assistant-chat";
import { getCase, getIncident } from "@/lib/api";
import { caseLang, incidentLang } from "@/lib/genui/context-lang";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let context: ArgusContext | undefined;

  if (sp.incident) {
    const inc = await getIncident(sp.incident).catch(() => null);
    if (inc) context = { kind: "incident", id: inc.id, title: inc.title, summary: inc.description ?? "", entities: inc.entities ?? [], lang: incidentLang(inc) };
  } else if (sp.case) {
    const c = await getCase(sp.case).catch(() => null);
    if (c) context = { kind: "case", id: c.id, title: c.title, summary: c.description ?? "", entities: c.tags ?? [], lang: caseLang(c) };
  }

  return <AssistantWorkspace context={context} />;
}
