import type { Client as NotionClient } from "@notionhq/client";
import { findNotionObjectByName } from "./utils.js";

export const PROMEMORIA_DB_NAME = "Promemoria";
export const COMPITI_DB_NAME    = "Compiti";
export const VOTI_DB_NAME       = "Voti";
export const ASSENZE_DB_NAME    = "Assenze";
export const REGISTRO_DB_NAME   = "Registro";
export const BACHECA_DB_NAME    = "Bacheca";

export async function setupPromemoriaDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, PROMEMORIA_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: PROMEMORIA_DB_NAME } }],
    properties: {
      desAnnotazioni:         { title: {} },
      desAnnotazioniCompleta: { rich_text: {} },
      pkDocente:              { rich_text: {} },
      datEvento:              { date: {} },
      datGiorno:              { date: {} },
      docente:                { rich_text: {} },
      oraInizio:              { rich_text: {} },
      oraFine:                { rich_text: {} },
      flgVisibileFamiglia:    { checkbox: {} },
    },
  });
  return db.id;
}

export async function setupCompitiDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, COMPITI_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: COMPITI_DB_NAME } }],
    properties: {
      compito:        { title: {} },
      compitoCompleto:{ rich_text: {} },
      dataConsegna:   { date: {} },
      materia:        { rich_text: {} },
      docente:        { rich_text: {} },
      ora:            { number: {} },
    },
  });
  return db.id;
}

export async function setupVotiDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, VOTI_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: VOTI_DB_NAME } }],
    properties: {
      materia:    { title: {} },
      voto:       { number: {} },
      datGiorno:  { date: {} },
      tipo:       { select: { options: [{ name: "Scritto" }, { name: "Orale" }, { name: "Pratico" }] } },
      giudizio:   { rich_text: {} },
      docente:    { rich_text: {} },
      pk:         { rich_text: {} },
    },
  });
  return db.id;
}

export async function setupAssenzeDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, ASSENZE_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: ASSENZE_DB_NAME } }],
    properties: {
      datGiorno:       { title: {} },
      tipo:            { select: { options: [{ name: "Assenza" }, { name: "Ritardo" }, { name: "Uscita anticipata" }] } },
      giustificata:    { checkbox: {} },
      note:            { rich_text: {} },
      pk:              { rich_text: {} },
    },
  });
  return db.id;
}

export async function setupRegistroDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, REGISTRO_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: REGISTRO_DB_NAME } }],
    properties: {
      argomento:  { title: {} },
      materia:    { select: {} },
      datGiorno:  { date: {} },
      docente:    { rich_text: {} },
      attivita:   { rich_text: {} },
      pk:         { rich_text: {} },
    },
  });
  return db.id;
}

export async function setupBachecaDatabase(client: NotionClient, parentPageId: string) {
  const id = await findNotionObjectByName(client, BACHECA_DB_NAME, "database");
  if (id) return id;
  const db = await client.databases.create({
    parent: { page_id: parentPageId },
    title: [{ type: "text", text: { content: BACHECA_DB_NAME } }],
    properties: {
      oggetto:    { title: {} },
      datGiorno:  { date: {} },
      letta:      { checkbox: {} },
      messaggio:  { rich_text: {} },
      pk:         { rich_text: {} },
    },
  });
  return db.id;
}
