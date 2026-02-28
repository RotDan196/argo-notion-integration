import "dotenv/config";
import { Client as ArgoClient } from "./argo-api/Client.js";
import { Client as NotionClient } from "@notionhq/client";
import { setupCompitiDatabase, setupPromemoriaDatabase } from "./setup.js";
import { seedCompitiRecords, seedPromemoriaRecords } from "./seed.js";
import { organizeWithAI } from "./ai.js";
import { ok } from "node:assert";

const NOTION_TOKEN        = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE  = process.env.NOTION_PARENT_PAGE_ID as string;

ok(NOTION_TOKEN,       "No NOTION_TOKEN provided");
ok(NOTION_PARENT_PAGE, "No NOTION_PARENT_PAGE provided");

const argoClient   = new ArgoClient({});
const notionClient = new NotionClient({ auth: NOTION_TOKEN });

// ── helper: recupera PKs già presenti per evitare duplicati ──────────────────
async function getExistingPks(databaseId: string): Promise<Set<string>> {
  const pks = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await notionClient.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });
    for (const page of res.results) {
      const prop = (page as any).properties?.["PK"];
      if (prop?.rich_text?.[0]?.plain_text)
        pks.add(prop.rich_text[0].plain_text);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pks;
}

// ── helper: crea un database Notion sotto la pagina padre ────────────────────
async function createDatabase(title: string, properties: object): Promise<string> {
  // Cerca se esiste già una pagina figlia con quel titolo
  const children = await notionClient.blocks.children.list({ block_id: NOTION_PARENT_PAGE });
  for (const block of children.results) {
    if ((block as any).type === "child_database") {
      const db = await notionClient.databases.retrieve({ database_id: block.id });
      const dbTitle = (db as any).title?.[0]?.plain_text ?? "";
      if (dbTitle === title) return block.id; // già esiste
    }
  }
  const db = await notionClient.databases.create({
    parent: { type: "page_id", page_id: NOTION_PARENT_PAGE },
    title: [{ type: "text", text: { content: title } }],
    properties: properties as any,
  });
  return db.id;
}

try {
  console.log("🔐 Login Argo in corso...\n");
  await argoClient.login();
  console.log("✓ Login Argo completato!\n");

  const dash = argoClient.dashboard!;

  // ── Setup databases (esistenti) ────────────────────────────────────────────
  const promemoria_id = await setupPromemoriaDatabase(notionClient, NOTION_PARENT_PAGE);
  const compiti_id    = await setupCompitiDatabase(notionClient, NOTION_PARENT_PAGE);

  // ── Setup databases (nuovi) ────────────────────────────────────────────────
  const voti_id = await createDatabase("📊 Voti", {
    "Materia":  { title: {} },
    "Voto":     { number: { format: "number" } },
    "Data":     { date: {} },
    "Tipo":     { select: { options: [{ name: "Scritto" }, { name: "Orale" }, { name: "Pratico" }] } },
    "Giudizio": { rich_text: {} },
    "PK":       { rich_text: {} },
  });

  const assenze_id = await createDatabase("📅 Assenze", {
    "Data":         { title: {} },
    "Tipo":         { select: { options: [{ name: "Assenza" }, { name: "Ritardo" }, { name: "Uscita anticipata" }] } },
    "Giustificata": { checkbox: {} },
    "Note":         { rich_text: {} },
    "PK":           { rich_text: {} },
  });

  const registro_id = await createDatabase("📖 Registro", {
    "Argomento":  { title: {} },
    "Materia":    { select: {} },
    "Data":       { date: {} },
    "Professore": { rich_text: {} },
    "PK":         { rich_text: {} },
  });

  const bacheca_id = await createDatabase("📢 Bacheca", {
    "Titolo":    { title: {} },
    "Data":      { date: {} },
    "Letta":     { checkbox: {} },
    "Contenuto": { rich_text: {} },
    "PK":        { rich_text: {} },
  });

  // ── Seed databases (esistenti) ─────────────────────────────────────────────
  await seedPromemoriaRecords(notionClient, promemoria_id, dash.promemoria as any);
  await seedCompitiRecords(notionClient, compiti_id, dash.registro as any);

  // ── Seed databases (nuovi) ─────────────────────────────────────────────────
  const existingVoti = await getExistingPks(voti_id);
  for (const v of dash.voti ?? []) {
    if (existingVoti.has(v.pk)) continue;
    await notionClient.pages.create({
      parent: { database_id: voti_id },
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

  const existingAssenze = await getExistingPks(assenze_id);
  for (const a of dash.appello ?? []) {
    if (existingAssenze.has(a.pk)) continue;
    await notionClient.pages.create({
      parent: { database_id: assenze_id },
      properties: {
        "Data":         { title:    [{ text: { content: a.datGiorno } }] },
        "Tipo":         { select:   { name: a.codEvento ?? "Assenza" } },
        "Giustificata": { checkbox: a.flgGiustificata === "S" },
        "Note":         { rich_text:[{ text: { content: a.desMotivo ?? "" } }] },
        "PK":           { rich_text:[{ text: { content: a.pk } }] },
      },
    });
  }

  const existingRegistro = await getExistingPks(registro_id);
  for (const r of dash.registro ?? []) {
    if (existingRegistro.has(r.pk)) continue;
    await notionClient.pages.create({
      parent: { database_id: registro_id },
      properties: {
        "Argomento":  { title:     [{ text: { content: r.desArgomento ?? "—" } }] },
        "Materia":    { select:    { name: r.desMateria ?? "—" } },
        "Data":       { date:      { start: r.datGiorno } },
        "Professore": { rich_text: [{ text: { content: r.docente ?? "—" } }] },
        "PK":         { rich_text: [{ text: { content: r.pk } }] },
      },
    });
  }

  const existingBacheca = await getExistingPks(bacheca_id);
  for (const b of dash.bacheca ?? []) {
    if (existingBacheca.has(b.pk)) continue;
    await notionClient.pages.create({
      parent: { database_id: bacheca_id },
      properties: {
        "Titolo":    { title:    [{ text: { content: b.desOggetto ?? "Comunicazione" } }] },
        "Data":      { date:     { start: b.datPubblicazione ?? b.datGiorno } },
        "Letta":     { checkbox: false },
        "Contenuto": { rich_text:[{ text: { content: b.desMessaggio ?? "" } }] },
        "PK":        { rich_text:[{ text: { content: b.pk } }] },
      },
    });
  }

  // ── AI Summary ─────────────────────────────────────────────────────────────
  const argoData = {
    voti:      dash.voti,
    compiti:   dash.promemoria,
    assenze:   dash.appello,
    registro:  dash.registro,
    bacheca:   dash.bacheca,
  };
  const aiSummary = await organizeWithAI(argoData);
  console.log("\n🤖 Riepilogo AI:\n", aiSummary);

  // Scrivi il riepilogo AI su Notion come pagina
  await notionClient.pages.create({
    parent: { type: "page_id", page_id: NOTION_PARENT_PAGE },
    properties: {
      title: { title: [{ text: { content: `🤖 Riepilogo AI — ${new Date().toLocaleDateString("it-IT")}` } }] },
    },
    children: [{
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: aiSummary } }] },
    }],
  });

  await argoClient.logOut();
  console.log("\n✅ Sync completato!");

} catch (err) {
  console.error("❌ Errore:", err instanceof Error ? err.message : err);
  process.exit(1);
}
