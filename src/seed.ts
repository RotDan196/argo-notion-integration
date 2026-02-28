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

// any per voti/assenze/registro/bacheca così leggiamo i campi reali al runtime
type AnyRecord = Record<string, any>;

// ── Promemoria ────────────────────────────────────────────────────────────────
export async function seedPromemoriaRecords(
  client: NotionClient,
  databaseId: string,
  promemoria: Promemoria[]
) {
  const today = todayISO();
  console.log("Soglia promemoria (oggi):", today);
  const existingTitles = await loadExistingTitles(client, databaseId, "desAnnotazioniCompleta");

  for (const p of promemoria) {
    const eventoDate = buildDate(p.datEvento);
    if (!eventoDate?.start) continue;
    if (eventoDate.start < today) continue;

    const fullText   = p.desAnnotazioni || "";
    const shortTitle = truncateTitle(fullText);

    if (existingTitles.has(fullText)) {
      console.log(`Promemoria "${shortTitle}" già presente, skip.`);
      continue;
    }

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
  console.log("Soglia compiti (oggi):", today);
  const existingTitles = await loadExistingTitles(client, databaseId, "compitoCompleto");

  for (const r of registro) {
    for (const c of r.compiti || []) {
      const consegnaDate = buildDate(c.dataConsegna);
      if (!consegnaDate?.start) continue;
      if (consegnaDate.start < today) continue;

      const fullText   = c.compito || "";
      const shortTitle = truncateTitle(fullText);

      if (existingTitles.has(fullText)) {
        console.log(`Compito "${shortTitle}" già presente, skip.`);
        continue;
      }

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
  if (voti?.length > 0) console.log("🔍 Campi voto disponibili:", Object.keys(voti[0]));

  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const v of voti ?? []) {
    const pk = v.pk ?? v.pkVoto ?? v.id ?? JSON.stringify(v);
    if (existingPks.has(pk)) continue;

    // Prova tutti i possibili nomi del campo voto nell'API Argo
    const votoRaw = v.decVoto ?? v.votoValore ?? v.voto ?? v.codVoto ?? v.valVoto ?? v.votoDecimale;
    const votoNum = votoRaw != null ? parseFloat(String(votoRaw)) || 0 : 0;
    const votoStr = votoRaw != null ? String(votoRaw) : "—";

    const materia  = v.desMateria ?? v.materia ?? v.desBreveMateria ?? "—";
    const data     = v.datGiorno ?? v.datVoto ?? v.data ?? "";
    const tipo     = v.codTipo ?? v.tipoVoto ?? v.desTipo ?? "Scritto";
    const giudizio = v.desGiudizio ?? v.giudizio ?? v.nota ?? "";
    const docente  = v.docente ?? v.desDocente ?? v.nomDocente ?? "";

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        materia:   { title:     [{ text: { content: materia } }] },
        voto:      { number:    votoNum },
        datGiorno: { date:      buildDate(data) ?? null },
        tipo:      { select:    { name: tipo } },
        giudizio:  { rich_text: [{ text: { content: giudizio } }] },
        docente:   { rich_text: [{ text: { content: docente } }] },
        pk:        { rich_text: [{ text: { content: pk } }] },
      },
    });
    console.log(`Voto ${materia} (${votoStr}) aggiunto.`);
    existingPks.add(pk);
  }
}

// ── Assenze ───────────────────────────────────────────────────────────────────
export async function seedAssenzeRecords(
  client: NotionClient,
  databaseId: string,
  appello: AnyRecord[]
) {
  if (appello?.length > 0) console.log("🔍 Campi assenza disponibili:", Object.keys(appello[0]));

  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const a of appello ?? []) {
    const pk = a.pk ?? a.pkAssenza ?? a.id ?? JSON.stringify(a);
    if (existingPks.has(pk)) continue;

    // Prova tutti i possibili nomi del campo data nell'API Argo
    const data  = a.datGiorno ?? a.datAssenza ?? a.data ?? a.datEvento ?? "";
    const tipo  = a.codEvento ?? a.tipoAssenza ?? a.desEvento ?? a.tipo ?? "Assenza";
    const giust = a.flgGiustificata === "S" || a.giustificata === true || a.flgGiust === "S";
    const note  = a.desMotivo ?? a.nota ?? a.note ?? "";

    // Se non c'è data, skip
    if (!data) {
      console.log(`Assenza senza data, skip. Campi: ${Object.keys(a).join(", ")}`);
      continue;
    }

    await client.pages.create({
      parent: { database_id: databaseId },
      properties: {
        datGiorno:    { title:    [{ text: { content: data } }] },
        tipo:         { select:   { name: tipo } },
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
  if (registro?.length > 0) console.log("🔍 Campi registro disponibili:", Object.keys(registro[0]));

  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const r of registro ?? []) {
    const pk = r.pk ?? r.pkRegistro ?? r.id ?? JSON.stringify(r);
    if (existingPks.has(pk)) continue;

    const argomento = r.desArgomento ?? r.argomento ?? r.attivita ?? r.nota ?? "—";
    const materia   = r.desMateria ?? r.materia ?? "—";
    const data      = r.datGiorno ?? r.datEvento ?? r.data ?? "";
    const docente   = r.docente ?? r.desDocente ?? "";
    const attivita  = r.attivita ?? r.attività ?? r.desAttivita ?? "";

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
  if (bacheca?.length > 0) console.log("🔍 Campi bacheca disponibili:", Object.keys(bacheca[0]));

  const existingPks = await loadExistingTitles(client, databaseId, "pk");
  for (const b of bacheca ?? []) {
    const pk = b.pk ?? b.pkBacheca ?? b.id ?? JSON.stringify(b);
    if (existingPks.has(pk)) continue;

    const oggetto  = b.desOggetto ?? b.oggetto ?? b.titolo ?? b.desTitolo ?? "Comunicazione";
    const data     = b.datPubblicazione ?? b.datGiorno ?? b.data ?? b.datEvento ?? "";
    const msg      = b.desMessaggio ?? b.messaggio ?? b.testo ?? b.contenuto ?? "";

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
