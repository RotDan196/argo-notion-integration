import type { Client as NotionClient } from "@notionhq/client";
import { buildDate, loadExistingTitles, todayISO, truncateTitle } from "./utils.js";

// ── Soglie date ───────────────────────────────────────────────────────────────
const VOTI_START_DATE = "2026-01-25";
const ONE_MONTH_AGO = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
})();

// ── Mapping codici Argo → label Notion ───────────────────────────────────────
function mapTipoVoto(codice: string): "Scritto" | "Orale" | "Pratico" {
  const map: Record<string, "Scritto" | "Orale" | "Pratico"> = {
    "V": "Scritto", "S": "Scritto", "T": "Scritto", "C": "Scritto",
    "O": "Orale",   "I": "Orale",   "G": "Orale",
    "P": "Pratico", "L": "Pratico",
  };
  return map[String(codice ?? "").toUpperCase()] ?? "Scritto";
}

function mapTipoAssenza(codice: string): "Assenza" | "Ritardo" | "Uscita anticipata" {
  const map: Record<string, "Assenza" | "Ritardo" | "Uscita anticipata"> = {
    "A":  "Assenza",
    "R":  "Ritardo", "ER": "Ritardo", "ED": "Ritardo", "EI": "Ritardo",
    "U":  "Uscita anticipata", "UA": "Uscita anticipata",
    "UE": "Uscita anticipata", "FU": "Uscita anticipata",
  };
  return map[String(codice ?? "").toUpperCase()] ?? "Assenza";
}

function sanitizeSelectName(name: string): string {
  if (!name) return "—";
  return name.replace(/,/g, "").trim();
}

type Promemoria = {
  pkDocente: string;
  desAnnotazioni: string;
  datEvento?: string;
  datGiorno?: string;
  docente: string;
  oraInizio?: string;
  oraFine?: string;
  flgVisibileFamiglia: string;
};

type Registro = {
  datEvento: string;
  isFirmato: boolean;
  desUrl: string | null;
  pkDocente: string;
  compiti: { compito: string; dataConsegna: string }[];
  datGiorno: string;
  docente: string;
  materia: string;
  pkMateria: string;
  attivita: string | null;
  ora: number;
};

type AnyRecord = Record<string, any>;

// ── Promemoria ────────────────────────────────────────────────────────────────
export async function seedPromemoriaRecords(
  client: NotionClient,
  databaseId: string,
  promemoria: Promemoria[]
) {
  const today = todayISO();
  const existingTitles = await loadExistingTitles(client, databaseId, "desAnnotazioniCompleta");

  for (const p of promemoria) {
    const eventoDate = buildDate(p.datEvento);
    if (!eventoDate?.start) continue;
    if (eventoDate.start < ONE_MONTH_AGO) continue;
    if (eventoDate.start < today) continue;

    const fullText   = p.desAnnotazioni || "";
    const shortTitle = truncateTitle(fullText);
    if (existingTitles.has(fullText)) continue;

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        desAnnotazioni:         { title:     [{ text: { content: shortTitle } }] },
        desAnnotazioniCompleta: { rich_text: [{ text: { content: fullText } }] },
        pkDocente:              { rich_text: [{ text: { content: p.pkDocente || "" } }] },
        docente:                { rich_text: [{ text: { content: p.docente || "" } }] },
        flgVisibileFamiglia:    { checkbox:  p.flgVisibileFamiglia === "S" },
        datEvento:              { date: eventoDate },
        datGiorno:              { date: buildDate(p.datGiorno) ?? null },
        oraInizio:              { rich_text: [{ text: { content: p.oraInizio !== "00:00" ? p.oraInizio ?? "07:50" : "07:50" } }] },
        oraFine:                { rich_text: [{ text: { content: p.oraFine   !== "00:00" ? p.oraFine   ?? "13:10" : "13:10" } }] },
      },
      children: [{
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: fullText } }] },
      }],
    });
    console.log(`Promemoria "${shortTitle}" aggiunto.`);
    existingTitles.add(fullText);
  }
}

// ── Compiti ───────────────────────────────────────────────────────────────────
export async function seedCompitiRecords(
  client: NotionClient,
  databaseId: string,
  registro: Registro[]
) {
  const today = todayISO();
  const existingTitles = await loadExistingTitles(client, databaseId, "compitoCompleto");

  for (const r of registro) {
    for (const c of r.compiti || []) {
      const consegnaDate = buildDate(c.dataConsegna);
      if (!consegnaDate?.start) continue;
      if (consegnaDate.start < ONE_MONTH_AGO) continue;
      if (consegnaDate.start < today) continue;

      const fullText   = c.compito || "";
      const shortTitle = truncateTitle(fullText);
      if (existingTitles.has(fullText)) continue;

      await client.pages.create({
        parent: { database_id: databaseId },
        properties: {
          compito:         { title:     [{ text: { content: shortTitle } }] },
          compitoCompleto: { rich_text: [{ text: { content: fullText } }] },
          dataConsegna:    { date: consegnaDate },
          materia:         { rich_text: [{ text: { content: r.materia || "" } }] },
          docente:         { rich_text: [{ text: { content: r.docente || "" } }] },
          ora:             { number: r.ora || 0 },
        },
        children: [{
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: fullText } }] },
        }],
      });
      console.log(`Compito "${shortTitle}" aggiunto.`);
      existingTitles.add(fullText);
    }
  }
}

// ── Voti ──────────────────────────────────────────────────────────────────────
export async function seedVotiRecords(
  client: NotionClient,
  databaseId: string,
  voti: AnyRecord[]
) {
  const existingVoci = await loadExistingTitles(client, databaseId, "voce");

  for (const v of voti ?? []) {
    const data = v.datGiorno ?? v.datEvento ?? "";
    if (data < VOTI_START_DATE) continue;

    const materia  = v.desMateria ?? v.materia ?? "—";
    const votoRaw  = v.valore ?? v.descrizioneVoto ?? 0;
    const votoNum  = parseFloat(String(votoRaw).replace("+", ".25").replace("-", ".75")) || 0;
    const voce     = `${materia} — ${data}`;
    if (existingVoci.has(voce)) continue;

    const tipo     = mapTipoVoto(v.codTipo ?? v.tipoValutazione ?? "");
    const giudizio = v.desCommento ?? v.descrizioneProva ?? "";
    const docente  = v.docente ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        voce:      { title:     [{ text: { content: voce } }] },
        materia:   { rich_text: [{ text: { content: materia } }] },
        voto:      { number:    votoNum },
        datGiorno: { date:      buildDate(data) ?? null },
        tipo:      { select:    { name: tipo } },
        giudizio:  { rich_text: [{ text: { content: giudizio } }] },
        docente:   { rich_text: [{ text: { content: docente } }] },
      },
    });
    console.log(`Voto ${materia} (${votoRaw}) aggiunto.`);
    existingVoci.add(voce);
  }
}

// ── Medie per Materia ─────────────────────────────────────────────────────────
export async function seedMediaVotiRecords(
  client: NotionClient,
  databaseId: string,
  voti: AnyRecord[]
) {
  const byMateria = new Map<string, number[]>();
  for (const v of voti ?? []) {
    const data = v.datGiorno ?? v.datEvento ?? "";
    if (data < VOTI_START_DATE) continue;

    const materia = v.desMateria ?? v.materia ?? "—";
    const votoRaw = v.valore ?? v.descrizioneVoto ?? 0;
    const num     = parseFloat(String(votoRaw).replace("+", ".25").replace("-", ".75"));
    if (isNaN(num) || num === 0) continue;

    if (!byMateria.has(materia)) byMateria.set(materia, []);
    byMateria.get(materia)!.push(num);
  }

  let cursor: string | undefined;
  do {
    const res = await client.databases.query({ database_id: databaseId, start_cursor: cursor });
    for (const page of res.results) {
      await client.pages.update({ page_id: page.id, archived: true });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  for (const [materia, valori] of byMateria.entries()) {
    const media = valori.reduce((a, b) => a + b, 0) / valori.length;
    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        materia:  { title:  [{ text: { content: materia } }] },
        media:    { number: Math.round(media * 100) / 100 },
        numVoti:  { number: valori.length },
        minVoto:  { number: Math.min(...valori) },
        maxVoto:  { number: Math.max(...valori) },
      },
    });
    console.log(`Media ${materia}: ${media.toFixed(2)} (${valori.length} voti)`);
  }
}

// ── Assenze ───────────────────────────────────────────────────────────────────
export async function seedAssenzeRecords(
  client: NotionClient,
  databaseId: string,
  appello: AnyRecord[]
) {
  const existingVoci = await loadExistingTitles(client, databaseId, "voce");

  for (const a of appello ?? []) {
    const data = a.data ?? a.datEvento ?? "";
    if (!data || data < ONE_MONTH_AGO) continue;

    const tipo  = mapTipoAssenza(a.codEvento ?? "");
    const voce  = `${data} — ${tipo}`;
    if (existingVoci.has(voce)) continue;

    const giust = a.giustificata === true || a.daGiustificare === false;
    const note  = a.nota ?? a.commentoGiustificazione ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        voce:         { title:    [{ text: { content: voce } }] },
        datGiorno:    { date:     buildDate(data) ?? null },
        tipo:         { select:   { name: tipo } },
        giustificata: { checkbox: giust },
        note:         { rich_text:[{ text: { content: note } }] },
      },
    });
    console.log(`Assenza ${data} (${tipo}) aggiunta.`);
    existingVoci.add(voce);
  }
}

// ── Registro ──────────────────────────────────────────────────────────────────
export async function seedRegistroRecords(
  client: NotionClient,
  databaseId: string,
  registro: AnyRecord[]
) {
  const existingArgomenti = await loadExistingTitles(client, databaseId, "argomento");

  for (const r of registro ?? []) {
    const data     = r.datGiorno ?? r.datEvento ?? "";
    if (data < ONE_MONTH_AGO) continue;

    const attivita  = r.attivita ?? "";
    const argomento = truncateTitle(attivita || "—", 100);
    const materia   = sanitizeSelectName(r.materia ?? r.desMateria ?? "—");
    const docente   = r.docente ?? "";

    if (existingArgomenti.has(argomento)) continue;

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        argomento: { title:     [{ text: { content: argomento } }] },
        materia:   { select:    { name: materia } },
        datGiorno: { date:      buildDate(data) ?? null },
        docente:   { rich_text: [{ text: { content: docente } }] },
        attivita:  { rich_text: [{ text: { content: attivita } }] },
      },
    });
    console.log(`Registro ${data} (${materia}) aggiunto.`);
    existingArgomenti.add(argomento);
  }
}

// ── Bacheca ───────────────────────────────────────────────────────────────────
export async function seedBachecaRecords(
  client: NotionClient,
  databaseId: string,
  bacheca: AnyRecord[]
) {
  // FIX: dedup su "data — oggetto" (chiave composita) invece di solo oggetto
  // così comunicazioni diverse con lo stesso titolo non vengono saltate
  const existingVoci = await loadExistingTitles(client, databaseId, "oggetto");

  for (const b of bacheca ?? []) {
    const data    = b.datPubblicazione ?? b.datGiorno ?? b.data ?? b.datEvento ?? "—";
    const titolo  = b.desOggetto ?? b.oggetto ?? b.titolo ?? b.desTitolo ?? "Comunicazione";
    const voce    = truncateTitle(`${data} — ${titolo}`, 100); // ← chiave composita unica
    const msg     = b.desMessaggio ?? b.messaggio ?? b.testo ?? b.contenuto ?? "";

    if (existingVoci.has(voce)) continue;

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        oggetto:   { title:    [{ text: { content: voce } }] },
        datGiorno: { date:     data !== "—" ? (buildDate(data) ?? null) : null },
        letta:     { checkbox: false },
        messaggio: { rich_text:[{ text: { content: truncateTitle(msg, 2000) } }] },
      },
      children: msg ? [{
        object: "block", type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: msg } }] },
      }] : undefined,
    });
    console.log(`Bacheca "${voce}" aggiunta.`);
    existingVoci.add(voce);
  }
}
