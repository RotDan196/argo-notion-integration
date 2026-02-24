import type { Client as NotionClient } from "@notionhq/client";

type NotionObjectType = "database" | "page";

export async function findNotionObjectByName(
  client: NotionClient,
  name: string,
  type: NotionObjectType
): Promise<string | null> {
  // Chiamata search
  const searchRes = await client.search({
    query: name,
    filter: { value: type, property: "object" },
  });

  // Cerca risultato esatto
  const found = searchRes.results.find((res: any) => {
    // res.object deve corrispondere
    if (res.object !== type) return false;

    // Per database e pagine, titolo è array rich_text
    const titleText =
      res.title?.[0]?.text?.content || res.properties?.title?.title?.[0]?.text?.content;

    return titleText === name;
  });

  if (found) {
    return found.id;
  }

  return null;
}

export function buildDate(dateStr?: string): { start: string } | undefined {
  if (!dateStr) return undefined; // data assente => non aggiungere campo
  // Se la stringa non contiene ora, aggiungi 00:00
  const hasTime = /\d{2}:\d{2}/.test(dateStr);
  const isoDate = hasTime ? dateStr : `${dateStr}T00:00:00`;
  return { start: isoDate };
}

export function truncateTitle(text: string, max = 30): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export function todayISO(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().split("T")[0];
}

export async function loadExistingTitles(
  client: NotionClient,
  databaseId: string,
  propertyName: string
): Promise<Set<string>> {
  const titles = new Set<string>();

  let cursor: string | undefined = undefined;

  do {
    const res = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of res.results as any[]) {
      const titleArr = page.properties[propertyName]?.title;
      if (titleArr?.length > 0) {
        titles.add(titleArr[0].plain_text);
      }
    }

    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return titles;
}