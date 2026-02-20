import type { Client as NotionClient } from "@notionhq/client";
import { buildDate, truncateTitle } from "./utils.ts";

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
  const latest = await client.databases.query({
    database_id: databaseId,
    sorts: [
      {
        property: "datEvento",
        direction: "descending",
      },
    ],
    page_size: 1,
  });

  let lastDate: string | null = null;

  if (latest.results.length > 0) {
    const page: any = latest.results[0];
    lastDate = page.properties.datEvento?.date?.start || null;
  }

  console.log("Ultima data presente:", lastDate);

  for (const p of promemoria) {
    const eventoDate = buildDate(p.datEvento);

    if (!eventoDate?.start) continue;
    if (lastDate && eventoDate.start <= lastDate) {
      console.log(`Evento ${eventoDate.start} già sincronizzato, skip.`);
      continue;
    }

    const fullText = p.desAnnotazioni || "";
    const shortTitle = truncateTitle(fullText);

    const properties: Record<string, any> = {
      desAnnotazioni: {
        title: [
          {
            text: { content: shortTitle },
          },
        ],
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
                text: {
                  content: fullText,
                },
              },
            ],
          },
        },
      ],
    });
  }
}

export async function seedCompitiRecords(
  client: NotionClient,
  databaseId: string,
  registro: Registro[]
) {
  const latest = await client.databases.query({
    database_id: databaseId,
    sorts: [
      {
        property: "dataConsegna",
        direction: "descending",
      },
    ],
    page_size: 1,
  });

  let lastDate: string | null = null;

  if (latest.results.length > 0) {
    const page: any = latest.results[0];
    lastDate = page.properties.dataConsegna?.date?.start || null;
  }

  console.log("Ultima data compiti presente:", lastDate);

  for (const r of registro) {

    for (const c of r.compiti || []) {

      const consegnaDate = buildDate(c.dataConsegna);
      if (!consegnaDate?.start) continue;

      if (lastDate && consegnaDate.start <= lastDate) {
        console.log(`Compito ${consegnaDate.start} già sincronizzato, skip.`);
        continue;
      }

      const fullText = c.compito || "";
      const shortTitle = truncateTitle(fullText);

      const properties: Record<string, any> = {
        compito: {
          title: [
            {
              text: { content: shortTitle },
            },
          ],
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
                  text: {
                    content: fullText,
                  },
                },
              ],
            },
          },
        ],
      });

    }
  }
}