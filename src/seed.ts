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
  flgVisibileFamiglia: string; // "S" o "N"
};

type Registro = {
  datEvento: string;
  isFirmato: boolean;
  desUrl: string | null;
  pkDocente: string;
  compiti: {
    compito: string;
    dataConsegna: string;
  }[];
  datGiorno: string;
  docente: string;
  materia: string;
  pkMateria: string;
  attivita: string | null;
  ora: number;
}

export async function seedPromemoriaRecords(
  client: NotionClient,
  databaseId: string,
  promemoria: Promemoria[]
) {
  const today = todayISO();
  console.log("Soglia promemoria (oggi):", today);

  const existingTitles = await loadExistingTitles(
    client,
    databaseId,
    "desAnnotazioniCompleta"
  );

  for (const p of promemoria) {
    const eventoDate = buildDate(p.datEvento);
    if (!eventoDate?.start) continue;

    if (eventoDate.start < today) continue;

    const fullText = p.desAnnotazioni || "";
    const shortTitle = truncateTitle(fullText);

    if (existingTitles.has(fullText)) {
      console.log(`Promemoria "${shortTitle}" già presente, skip.`);
      continue;
    }

    const properties: Record<string, any> = {
      desAnnotazioni: {
        title: [{ text: { content: shortTitle } }],
      },
      desAnnotazioniCompleta: {
        rich_text: [{ text: { content: fullText } }],
      },
      pkDocente: {
        rich_text: [{ text: { content: p.pkDocente || "" } }],
      },
      docente: {
        rich_text: [{ text: { content: p.docente || "" } }],
      },
      flgVisibileFamiglia: {
        checkbox: p.flgVisibileFamiglia === "S",
      },
      datEvento: {
        date: eventoDate,
      },
      datGiorno: {
        date: buildDate(p.datGiorno),
      },
      oraInizio: {
        rich_text: [
          {
            text: {
              content: p.oraInizio != "00:00" ? p.oraInizio : "07:50",
            },
          },
        ],
      },
      oraFine: {
        rich_text: [
          {
            text: {
              content: p.oraFine != "00:00" ? p.oraFine : "13:10",
            },
          },
        ],
      },
    };

    await client.pages.create({
      parent: { database_id: databaseId },
      properties,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: fullText },
              },
            ],
          },
        },
      ],
    });

    existingTitles.add(shortTitle);
  }
}

export async function seedCompitiRecords(
  client: NotionClient,
  databaseId: string,
  registro: Registro[]
) {
  const today = todayISO();
  console.log("Soglia compiti (oggi):", today);

  const existingTitles = await loadExistingTitles(
    client,
    databaseId,
    "compitoCompleto"
  );

  for (const r of registro) {
    for (const c of r.compiti || []) {
      const consegnaDate = buildDate(c.dataConsegna);
      if (!consegnaDate?.start) continue;

      if (consegnaDate.start < today) continue;

      const fullText = c.compito || "";
      const shortTitle = truncateTitle(fullText);

      if (existingTitles.has(fullText)) {
        console.log(`Compito "${shortTitle}" già presente, skip.`);
        continue;
      }

      const properties: Record<string, any> = {
        compito: {
          title: [{ text: { content: shortTitle } }],
        },
        compitoCompleto: {
          rich_text: [{ text: { content: fullText } }],
        },
        dataConsegna: {
          date: consegnaDate,
        },
        materia: {
          rich_text: [{ text: { content: r.materia || "" } }],
        },
        docente: {
          rich_text: [{ text: { content: r.docente || "" } }],
        },
        ora: {
          number: r.ora || 0,
        },
      };

      await client.pages.create({
        parent: { database_id: databaseId },
        properties,
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: { content: fullText },
                },
              ],
            },
          },
        ],
      });

      existingTitles.add(shortTitle);
    }
  }
}