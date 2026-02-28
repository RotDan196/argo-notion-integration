import "dotenv/config";
import { Client as ArgoClient } from "./argo-api/Client.js";
import { Client as NotionClient } from "@notionhq/client";
import {
  setupPromemoriaDatabase, setupCompitiDatabase,
  setupVotiDatabase, setupAssenzeDatabase,
  setupRegistroDatabase, setupBachecaDatabase,
} from "./setup.js";
import {
  seedPromemoriaRecords, seedCompitiRecords,
  seedVotiRecords, seedAssenzeRecords,
  seedRegistroRecords, seedBachecaRecords,
} from "./seed.js";
import { organizeWithAI } from "./ai.js";
import { ok } from "node:assert";

const NOTION_TOKEN       = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE = process.env.NOTION_PARENT_PAGE_ID as string;

ok(NOTION_TOKEN,       "No NOTION_TOKEN provided");
ok(NOTION_PARENT_PAGE, "No NOTION_PARENT_PAGE provided");

const argoClient   = new ArgoClient({});
const notionClient = new NotionClient({ auth: NOTION_TOKEN });

try {
  console.log("🔐 Login Argo in corso...\n");
  await argoClient.login();
  console.log("✓ Login Argo completato!\n");

  const dash = argoClient.dashboard!;

  // ── Setup tutti i database (idempotente) ──────────────────────────────────
  console.log("📦 Setup database Notion...");
  const [promemoria_id, compiti_id, voti_id, assenze_id, registro_id, bacheca_id] = await Promise.all([
    setupPromemoriaDatabase(notionClient, NOTION_PARENT_PAGE),
    setupCompitiDatabase(notionClient, NOTION_PARENT_PAGE),
    setupVotiDatabase(notionClient, NOTION_PARENT_PAGE),
    setupAssenzeDatabase(notionClient, NOTION_PARENT_PAGE),
    setupRegistroDatabase(notionClient, NOTION_PARENT_PAGE),
    setupBachecaDatabase(notionClient, NOTION_PARENT_PAGE),
  ]);
  console.log("✓ Database pronti!\n");

  // ── Seed tutti i database ─────────────────────────────────────────────────
  console.log("📌 Sync Promemoria...");
  await seedPromemoriaRecords(notionClient, promemoria_id, dash.promemoria as any);

  console.log("📋 Sync Compiti...");
  await seedCompitiRecords(notionClient, compiti_id, dash.registro as any);

  console.log("📊 Sync Voti...");
  await seedVotiRecords(notionClient, voti_id, dash.voti as any);

  console.log("📅 Sync Assenze...");
  await seedAssenzeRecords(notionClient, assenze_id, dash.appello as any);

  console.log("📖 Sync Registro...");
  await seedRegistroRecords(notionClient, registro_id, dash.registro as any);

  console.log("📢 Sync Bacheca...");
  await seedBachecaRecords(notionClient, bacheca_id, dash.bacheca as any);

  // ── AI Summary ────────────────────────────────────────────────────────────
  console.log("\n🤖 Generazione riepilogo AI...");
  const aiSummary = await organizeWithAI({
    voti:     dash.voti,
    compiti:  dash.promemoria,
    assenze:  dash.appello,
    registro: dash.registro,
    bacheca:  dash.bacheca,
  });

  await notionClient.pages.create({
    parent: { type: "page_id", page_id: NOTION_PARENT_PAGE },
    properties: {
      title: { title: [{ text: { content: `🤖 Riepilogo AI — ${new Date().toLocaleDateString("it-IT")}` } }] },
    },
    children: [{
      object: "block", type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: aiSummary } }] },
    }],
  });

  await argoClient.logOut();
  console.log("\n✅ Sync completato!");

} catch (err) {
  console.error("❌ Errore:", err instanceof Error ? err.message : err);
  process.exit(1);
}
