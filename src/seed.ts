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

type Voto = {
  pk: string;
  datGiorno: string;
  desMateria?: string;
  decVoto?: string;
  voto?: string;
  codTipo?: string;
  desGiudizio?: string;
  docente?: string;
};

type Assenza = {
  pk: string;
  datGiorno: string;
  codEvento?: string;
  flgGiustificata?: string;
  desMotivo?: string;
};

type RegistroEntry = {
  pk: string;
  datGiorno: string;
  desArgomento?: string;
  desMateria?: string;
  docente?: string;
  attivita?: string | null;
};

type BachecaEntry = {
  pk: string;
  datGiorno?: string;
  datPubblicazione?: string;
  desOggetto?: string;
  desMessaggio?: string;
};

// ── Promemoria (già esistente, invariata) ─────────────────────────────────────
export async function seedPromemoriaRecords(
  client: NotionClient,
  databaseId: string,
  promemoria: Promemoria[]
) {
  const today = todayISO();
  const existingTitles = await loadExistingTitles(client, databaseId, "desAnnotazioniCompleta");

  for (const p of promemoria) {
    const eventoDate = buildDate(p.datEvento);
    if (!eventoDate?.start || eventoDate.start < today) continue;

    const fullText   = p.desAnnotazioni || "";
    const shortTitle = truncateTitle(fullText);
    if (existingTitles.has(fullText)) { console.log(`Promemoria "${shortTitle}" già presente, skip.`); continue; }

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        desAnnotazioni:         { title:     [{ text: { content: shortTitle } }] },
        desAnnotazioniCompleta: { rich_text: [{ text: { content: fullText } }] },
        pkDocente:              { rich_text: [{ text: { content: p.pkDocente || "" } }] },
        docente:                { rich_text: [{ text: { content: p.docente || "" } }] },
        flgVisibileFamiglia:    { checkbox:  p.flgVisibileFamiglia === "S" },
        datEvento:              { date: eventoDate },
        datGiorno:              { date: buildDate(p.datGiorno) },
        oraInizio:              { rich_text: [{ text: { content: p.oraInizio !== "00:00" ? p.oraInizio ?? "07:50" : "07:50" } }] },
        oraFine:                { rich_text: [{ text: { content: p.oraFine   !== "00:00" ? p.oraFine   ?? "13:10" : "13:10" } }] },
      },
      children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: fullText } }] } }],
    });
    console.log(`Promemoria "${shortTitle}" aggiunto.`);
    existingTitles.add(fullText);
  }
}

// ── Compiti (già esistente, invariata) ────────────────────────────────────────
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
      if (!consegnaDate?.start || consegnaDate.start < today) continue;

      const fullText   = c.compito || "";
      const shortTitle = truncateTitle(fullText);
      if (existingTitles.has(fullText)) { console.log(`Compito "${shortTitle}" già presente, skip.`); continue; }

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
        children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: fullText } }] } }],
      });
      console.log(`Compito "${shortTitle}" aggiunto.`);
      existingTitles.add(fullText);
    }
  }
}

// ── Voti ──────────────────────────────────────────────────────────────────────
export async function seedVotiRecords(client: NotionClient, databaseId: string, voti: Voto[]) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const v of voti) {
    if (existingPks.has(v.pk)) continue;
    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        materia:   { title:     [{ text: { content: v.desMateria ?? "—" } }] },
        voto:      { number:    parseFloat(v.decVoto ?? v.voto ?? "0") || 0 },
        datGiorno: { date:      buildDate(v.datGiorno) },
        tipo:      { select:    { name: v.codTipo ?? "Scritto" } },
        giudizio:  { rich_text: [{ text: { content: v.desGiudizio ?? "" } }] },
        docente:   { rich_text: [{ text: { content: v.docente ?? "" } }] },
        pk:        { rich_text: [{ text: { content: v.pk } }] },
      },
    });
    console.log(`Voto ${v.desMateria} (${v.decVoto ?? v.voto}) aggiunto.`);
    existingPks.add(v.pk);
  }
}

// ── Assenze ───────────────────────────────────────────────────────────────────
export async function seedAssenzeRecords(client: NotionClient, databaseId: string, appello: Assenza[]) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const a of appello) {
    if (existingPks.has(a.pk)) continue;
    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        datGiorno:    { title:    [{ text: { content: a.datGiorno } }] },
        tipo:         { select:   { name: a.codEvento ?? "Assenza" } },
        giustificata: { checkbox: a.flgGiustificata === "S" },
        note:         { rich_text:[{ text: { content: a.desMotivo ?? "" } }] },
        pk:           { rich_text:[{ text: { content: a.pk } }] },
      },
    });
    console.log(`Assenza ${a.datGiorno} aggiunta.`);
    existingPks.add(a.pk);
  }
}

// ── Registro ──────────────────────────────────────────────────────────────────
export async function seedRegistroRecords(client: NotionClient, databaseId: string, registro: RegistroEntry[]) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const r of registro) {
    if (existingPks.has(r.pk)) continue;
    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        argomento: { title:     [{ text: { content: truncateTitle(r.desArgomento ?? "—", 100) } }] },
        materia:   { select:    { name: r.desMateria ?? "—" } },
        datGiorno: { date:      buildDate(r.datGiorno) },
        docente:   { rich_text: [{ text: { content: r.docente ?? "" } }] },
        attivita:  { rich_text: [{ text: { content: r.attivita ?? "" } }] },
        pk:        { rich_text: [{ text: { content: r.pk } }] },
      },
    });
    console.log(`Registro ${r.datGiorno} (${r.desMateria}) aggiunto.`);
    existingPks.add(r.pk);
  }
}

// ── Bacheca ───────────────────────────────────────────────────────────────────
export async function seedBachecaRecords(client: NotionClient, databaseId: string, bacheca: BachecaEntry[]) {
  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const b of bacheca) {
    if (existingPks.has(b.pk)) continue;
    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        oggetto:   { title:    [{ text: { content: truncateTitle(b.desOggetto ?? "Comunicazione", 100) } }] },
        datGiorno: { date:     buildDate(b.datPubblicazione ?? b.datGiorno) },
        letta:     { checkbox: false },
        messaggio: { rich_text:[{ text: { content: b.desMessaggio ?? "" } }] },
        pk:        { rich_text:[{ text: { content: b.pk } }] },
      },
    });
    console.log(`Bacheca "${b.desOggetto}" aggiunta.`);
    existingPks.add(b.pk);
  }
}
