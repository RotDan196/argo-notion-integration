import type { Client as NotionClient } from "@notionhq/client";
import { findNotionObjectByName } from "./utils.ts";

export const PROMEMORIA_DB_NAME = "Promemoria";
export const COMPITI_DB_NAME = "Compiti";

export async function setupPromemoriaDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, PROMEMORIA_DB_NAME, 'database');
  if (id) return id;

  const database = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: PROMEMORIA_DB_NAME } }],
    properties: {
      desAnnotazioni: { title: {}, },
      pkDocente: { rich_text: {} },
      datEvento: { date: {} },
      datGiorno: { date: {} },
      docente: { rich_text: {} },
      oraInizio: { rich_text: {} },
      oraFine: { rich_text: {} },
      flgVisibileFamiglia: { checkbox: {} },
    },
  });

  return database.id;
}

export async function setupCompitiDatabase(
  client: NotionClient,
  parentPageId: string
) {
  const id = await findNotionObjectByName(client, COMPITI_DB_NAME, "database");
  if (id) return id;

  const database = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: COMPITI_DB_NAME } }],
    properties: {
      compito: {
        title: {},
      },
      dataConsegna: {
        date: {},
      },
      materia: {
        rich_text: {},
      },
      docente: {
        rich_text: {},
      },
      ora: {
        number: {},
      },
      compitoCompleto: {
        rich_text: {},
      },
    },
  });

  return database.id;
}