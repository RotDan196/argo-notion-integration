import type { Client as NotionClient } from "@notionhq/client";
import { buildDate, loadExistingTitles, todayISO, truncateTitle } from "./utils.js";

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

// Utility per pulire i nomi usati nelle Select di Notion (No virgole)
function sanitizeSelectName(name: string): string {
  if (!name) return "—";
  return name.replace(/,/g, "").trim();
}

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
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const v of voti ?? []) {
    const pk = v.pk ?? v.pkVoto ?? v.id ?? JSON.stringify(v);
    if (existingPks.has(pk)) continue;

    // fix: in base ai log, il voto numerico sta in "valore" o "descrizioneVoto" se è una stringa (es. "8+")
    const votoRaw = v.valore ?? v.descrizioneVoto ?? 0;
    // Rimuoviamo i "+" e i "-" per convertire in numero per la colonna Notion
    const stringVotoClean = String(votoRaw).replace("+", ".25").replace("-", ".75");
    const votoNum = parseFloat(stringVotoClean) || 0;

    const materia  = v.desMateria ?? v.materia ?? v.materiaLight ?? "—";
    const data     = v.datGiorno ?? v.datEvento ?? "";
    const tipo     = v.codTipo ?? v.tipoValutazione ?? "Scritto";
    const giudizio = v.desCommento ?? v.descrizioneProva ?? "";
    const docente  = v.docente ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        materia:   { title:     [{ text: { content: materia } }] },
        voto:      { number:    votoNum },
        datGiorno: { date:      buildDate(data) ?? null },
        tipo:      { select:    { name: sanitizeSelectName(tipo) } }, // Sanitizza anche qui per sicurezza
        giudizio:  { rich_text: [{ text: { content: giudizio } }] },
        docente:   { rich_text: [{ text: { content: docente } }] },
        pk:        { rich_text: [{ text: { content: pk } }] },
      },
    });
    console.log(`Voto ${materia} (${votoRaw}) aggiunto.`);
    existingPks.add(pk);
  }
}

// ── Assenze ───────────────────────────────────────────────────────────────────
export async function seedAssenzeRecords(
  client: NotionClient,
  databaseId: string,
  appello: AnyRecord[]
) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const a of appello ?? []) {
    const pk = a.pk ?? a.pkAssenza ?? a.id ?? JSON.stringify(a);
    if (existingPks.has(pk)) continue;

    const data  = a.data ?? a.datEvento ?? "";
    const tipo  = a.codEvento ?? a.descrizione ?? "Assenza";
    const giust = a.giustificata === true || a.daGiustificare === false;
    const note  = a.nota ?? a.commentoGiustificazione ?? "";

    if (!data) continue;

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        datGiorno:    { title:    [{ text: { content: data } }] },
        tipo:         { select:   { name: sanitizeSelectName(tipo) } },
        giustificata: { checkbox: giust },
        note:         { rich_text:[{ text: { content: note } }] },
        pk:           { rich_text:[{ text: { content: pk } }] },
      },
    });
    console.log(`Assenza ${data} aggiunta.`);
    existingPks.add(pk);
  }
}

// ── Registro ──────────────────────────────────────────────────────────────────
export async function seedRegistroRecords(
  client: NotionClient,
  databaseId: string,
  registro: AnyRecord[]
) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const r of registro ?? []) {
    const pk = r.pk ?? r.pkRegistro ?? r.id ?? JSON.stringify(r);
    if (existingPks.has(pk)) continue;

    const argomento = r.attivita ?? r.argomento ?? "—";
    const materia   = sanitizeSelectName(r.materia ?? r.desMateria ?? "—"); // FIX: NO VIRGOLE QUI
    const data      = r.datGiorno ?? r.datEvento ?? "";
    const docente   = r.docente ?? r.pkDocente ?? "";
    const attivita  = r.attivita ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        argomento: { title:     [{ text: { content: truncateTitle(argomento, 100) } }] },
        materia:   { select:    { name: materia } },
        datGiorno: { date:      buildDate(data) ?? null },
        docente:   { rich_text: [{ text: { content: docente } }] },
        attivita:  { rich_text: [{ text: { content: attivita } }] },
        pk:        { rich_text: [{ text: { content: pk } }] },
      },
    });
    console.log(`Registro ${data} (${materia}) aggiunto.`);
    existingPks.add(pk);
  }
}

// ── Bacheca ───────────────────────────────────────────────────────────────────
export async function seedBachecaRecords(
  client: NotionClient,
  databaseId: string,
  bacheca: AnyRecord[]
) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const b of bacheca ?? []) {
    const pk = b.pk ?? b.pkBacheca ?? b.id ?? JSON.stringify(b);
    if (existingPks.has(pk)) continue;

    const oggetto  = b.desOggetto ?? b.oggetto ?? b.titolo ?? "Comunicazione";
    const data     = b.datPubblicazione ?? b.datGiorno ?? b.data ?? b.datEvento ?? "";
    const msg      = b.desMessaggio ?? b.messaggio ?? b.testo ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        oggetto:   { title:    [{ text: { content: truncateTitle(oggetto, 100) } }] },
        datGiorno: { date:     buildDate(data) ?? null },
        letta:     { checkbox: false },
        messaggio: { rich_text:[{ text: { content: msg } }] },
        pk:        { rich_text:[{ text: { content: pk } }] },
      },
    });
    console.log(`Bacheca "${oggetto}" aggiunta.`);
    existingPks.add(pk);
  }
}
