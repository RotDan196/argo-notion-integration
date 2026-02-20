import "dotenv/config";
import { Client } from "./Client.js";

console.time();
const client = new Client({ debug: true });

await client.login();
const uid = client.dashboard?.bacheca.find((e: any) => e.listaAllegati.length)
	?.listaAllegati[0]?.pk;

console.log(client.dashboard?.promemoria);

await Promise.allSettled([
	client.getCorsiRecupero(),
	client
		.getCurriculum()
		.then((c) =>
			Promise.allSettled([
				client.getStoricoBacheca(c[0]!.pkScheda),
				client.getStoricoBachecaAlunno(c[0]!.pkScheda),
			]),
		),
	client.getDettagliProfilo(),
	client.getOrarioGiornaliero(),
	client.getPCTOData(),
	client.getRicevimenti(),
	client.getTasse(),
	client.getVotiScrutinio(),
	uid && client.getLinkAllegato(uid),
]);
await client.logOut();
console.timeEnd();
