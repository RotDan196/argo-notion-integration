import "dotenv/config";
import { Client as NotionClient } from "@notionhq/client";
import { Client as ArgoClient } from "../libs/portaleargo-api/src/Client.js";

const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });

const DB_COMPITI   = process.env.NOTION_DB_COMPITI_ID!;
const DB_VOTI      = process.env.NOTION_DB_VOTI_ID!;
const DB_ASSENZE   = process.env.NOTION_DB_ASSENZE_ID!;
const DB_REGISTRO  = process.env.NOTION_DB_REGISTRO_ID!;
const DB_BACHECA   = process.env.NOTION_DB_BACHECA_ID!;

async function getExistingPks(databaseId: string, pkProp: string): Promise<Set<string>> {
  const pks = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({ database_id: databaseId, start_cursor: cursor });
    for (const page of res.results) {
      const prop = (page as any).properties?.[pkProp];
      if (prop?.rich_text?.[0]?.plain_text) pks.add(prop.rich_text[0].plain_text);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pks;
}

const argo = new ArgoClient();
await argo.login();
const dash = argo.dashboard!;

// ── COMPITI (promemoria) ──────────────────────────────────────────────────────
const existingCompiti = await getExistingPks(DB_COMPITI, "PK");
for (const c of dash.promemoria ?? []) {
  if (existingCompiti.has(c.pk)) continue;
  await notion.pages.create({
    parent: { database_id: DB_COMPITI },
    properties: {
      "Titolo":      { title:     [{ text: { content: c.desAnnotazioni ?? "Compito" } }] },
      "Materia":     { select:    { name: c.desMateria ?? "—" } },
      "Scadenza":    { date:      { start: c.datGiorno } },
      "Completato":  { checkbox:  false },
      "Priorità":    { select:    { name: "🟡 Media" } },
      "Descrizione": { rich_text: [{ text: { content: c.desAnnotazioni ?? "" } }] },
      "Docente":     { rich_text: [{ text: { content: c.docente ?? c.desDocente ?? "—" } }] },
      "Ora":         { rich_text: [{ text: { content: String(c.numOra ?? c.ora ?? "—") } }] },
      "PK":          { rich_text: [{ text: { content: c.pk } }] },
    },
  });
}

// ── VOTI ─────────────────────────────────────────────────────────────────────
const existingVoti = await getExistingPks(DB_VOTI, "PK");
for (const v of dash.voti ?? []) {
  if (existingVoti.has(v.pk)) continue;
  await notion.pages.create({
    parent: { database_id: DB_VOTI },
    properties: {
      "Materia":  { title:     [{ text: { content: v.desMateria ?? "—" } }] },
      "Voto":     { number:    parseFloat(v.decVoto ?? v.voto ?? "0") || 0 },
      "Data":     { date:      { start: v.datGiorno } },
      "Tipo":     { select:    { name: v.codTipo ?? "Scritto" } },
      "Giudizio": { rich_text: [{ text: { content: v.desGiudizio ?? "" } }] },
      "PK":       { rich_text: [{ text: { content: v.pk } }] },
    },
  });
}

// ── ASSENZE (appello) ─────────────────────────────────────────────────────────
const existingAssenze = await getExistingPks(DB_ASSENZE, "PK");
for (const a of dash.appello ?? []) {
  if (existingAssenze.has(a.pk)) continue;
  await notion.pages.create({
    parent: { database_id: DB_ASSENZE },
    properties: {
      "Data":          { title:    [{ text: { content: a.datGiorno } }] },
      "Tipo":          { select:   { name: a.codEvento ?? "Assenza" } },
      "Giustificata":  { checkbox: a.flgGiustificata === "S" },
      "Note":          { rich_text:[{ text: { content: a.desMotivo ?? "" } }] },
      "PK":            { rich_text:[{ text: { content: a.pk } }] },
    },
  });
}

// ── REGISTRO ──────────────────────────────────────────────────────────────────
const existingRegistro = await getExistingPks(DB_REGISTRO, "PK");
for (const r of dash.registro ?? []) {
  if (existingRegistro.has(r.pk)) continue;
  await notion.pages.create({
    parent: { database_id: DB_REGISTRO },
    properties: {
      "Argomento": { title:     [{ text: { content: r.desArgomento ?? "—" } }] },
      "Materia":   { select:    { name: r.desMateria ?? "—" } },
      "Data":      { date:      { start: r.datGiorno } },
      "Professore":{ rich_text: [{ text: { content: r.docente ?? "—" } }] },
      "PK":        { rich_text: [{ text: { content: r.pk } }] },
    },
  });
}

// ── BACHECA ───────────────────────────────────────────────────────────────────
const existingBacheca = await getExistingPks(DB_BACHECA, "PK");
for (const b of dash.bacheca ?? []) {
  if (existingBacheca.has(b.pk)) continue;
  await notion.pages.create({
    parent: { database_id: DB_BACHECA },
    properties: {
      "Titolo":    { title:    [{ text: { content: b.desOggetto ?? "Comunicazione" } }] },
      "Data":      { date:     { start: b.datPubblicazione ?? b.datGiorno } },
      "Letta":     { checkbox: false },
      "Contenuto": { rich_text:[{ text: { content: b.desMessaggio ?? "" } }] },
      "PK":        { rich_text:[{ text: { content: b.pk } }] },
    },
  });
}

await argo.logOut();
console.log("✅ Sync completato!");
