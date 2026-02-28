import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function organizeWithAI(argoData: object): Promise<string> {
  const prompt = `
Sei un assistente scolastico. Ricevi i dati del registro scolastico Argo in JSON.
Il tuo compito è:
1. Riassumere i voti recenti per materia con media
2. Elencare i compiti e verifiche in scadenza in ordine di urgenza
3. Segnalare assenze e ritardi
4. Dare un breve consiglio su cosa studiare prima

Dati Argo:
${JSON.stringify(argoData, null, 2)}

Rispondi in italiano, in modo chiaro e ben strutturato con titoli e bullet point.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text ?? "";
}
