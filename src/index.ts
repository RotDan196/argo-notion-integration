import "dotenv/config";
import { Client as ArgoClient } from "./argo-api/Client.js";
import { Client as NotionClient } from "@notionhq/client";
import { setupCompitiDatabase, setupPromemoriaDatabase } from "./setup.js";
import { seedCompitiRecords, seedPromemoriaRecords } from "./seed.js";
import { ok } from "node:assert";
import { organizeWithAI } from "./ai.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PARENT_PAGE = process.env.NOTION_PARENT_PAGE_ID as string;

ok(NOTION_TOKEN, "No NOTION_TOKEN provided");
ok(NOTION_PARENT_PAGE, "No NOTION_PARENT_PAGE provided");

const argoClient = new ArgoClient({});
const notionClient = new NotionClient({ auth: NOTION_TOKEN });

try {
	console.log("🔐 Login Argo in corso...\n");
	await argoClient.login();
	console.log("✓ Login Argo completato!\n");

    const promemoria_id = await setupPromemoriaDatabase(notionClient, NOTION_PARENT_PAGE);
	const compiti_id = await setupCompitiDatabase(notionClient, NOTION_PARENT_PAGE);
	const argoData = { voti, compiti, assenze };
	const aiSummary = await organizeWithAI(argoData);

    await seedPromemoriaRecords(notionClient, promemoria_id, argoClient.dashboard?.promemoria as any);
	await seedCompitiRecords(notionClient, compiti_id, argoClient.dashboard?.registro as any)

} catch (err) {
	console.error(
		"❌ Errore:",
		err instanceof Error ? err.message : err,
	);
	process.exit(1);
}
