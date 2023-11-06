import {GameData} from "../types";
import * as fs from "fs";
import Jimp from "jimp";
import * as influx1 from "influx";
import * as influx2 from "@influxdata/influxdb-client"

import config from "../../config.json";
import {ClientOptions} from "@influxdata/influxdb-client";
import {GoogleSpreadsheet} from "google-spreadsheet";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { JWT, OAuth2Client } from "google-auth-library";

let appDataPath = '';

export function setAppData(path: string) {
    appDataPath = path;
}

export function getDataDir() {
    const dir = appDataPath;
    try{
        if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }catch (e){
        console.log(e)
    }
    return dir;
}

export class Output {

    /**
     * write current game state
     */
    writeGameNow(data: GameData): void | Promise<void> {
        return null;
    }

    /**
     * write game data at end of game (win/loss/draw)
     */
    writeGameResult(data: GameData): void | Promise<void> {
        return null;
    }

    writeImage(data: GameData, jmp: Jimp, canvas: string): void | Promise<void> {
        return null;
    }

}

export class JsonOutput extends Output {

    writeGameResult(data: GameData) {
        console.log(data)
        const name = data.times.start.toISOString().replace(/:/g, '-') + "-" + data.status;
        const out = `./output/games/game-${name}.json`;
        console.log(out);
        JsonOutput.writeJson(`./output/games/game-${name}.json`, data);
    }

    writeImage(data: GameData, jmp: Jimp, canvas: string) {
        const name = data.status + "-" + data.times.start.toISOString().replace(/:/g, '-');
        const out1 = `./output/games/game-${name}.original.png`;
        console.log(out1);
        jmp.write(out1);
        const out2 = `./output/games/game-${name}.labelled.png`;
        console.log(out2)
        fs.writeFileSync(out2, Buffer.from(canvas.substring('data:image/png;base64,'.length), 'base64'))
    }

    static readJson<T>(file: string): T {
        const str = fs.readFileSync(file, 'utf-8');
        return JSON.parse(str) as T;
    }

    static backup(file: string) {
        try{
            if (file.endsWith('.json')) {
                fs.copyFileSync(file, file + '.backup');
            }
        }catch (e){
            console.log(e);
        }
    }

    static writeJson(file: string, data: any) {
        if(!data) {
            console.warn("not writing empty json data to ", file);
            return;
        }
        if(Array.isArray(data)&&data.length<=0) {
            console.warn("not writing empty json array to ", file);
            return;
        }
        if(Object.keys(data).length<=0) {
            console.warn("not writing empty json object to ", file);
            return;
        }

        try {
            fs.writeFileSync(file, JSON.stringify(data, null, 2), {
                encoding: 'utf-8',
                flag: 'w'
            });
        } catch (e) {
            console.log(e)
        }
    }

}

export class RowOutput extends Output {

    getHeader() {
        return [
            "Fecha",
            "Día",
            "Mapa",
            "Tipo",
            "Equipo",
            "Rol",
            "Héroe",
            "Win?",
            "Top Kills?",
            "Top Assists?",
            "Top Deaths?",
            "Top Damage?",
            "Top Heal?",
            "Top Mit?",
            "POTG?",
            "Saved",
            "E",
            "A",
            "M",
            "Dmg",
            "Heal",
            "Mit",
            "Result A.",
            "Result E.",
            "Time",
            "Notes"
        ];
    }

    makeRow(data: GameData): (string | number | boolean)[] {
        return [
            format(data.times.start, 'dd/MM/yyyy HH:mm:ss'),
            format(data.times.start, 'EEEE', { locale: es }),
            this.cleanString(data.match.map),
            this.cleanString(data.match.mode),
            '',
            data.self.role,
            data.self.heroes.map(hero => hero.replace(/[^a-zA-Z0-9]/g, '')).join('/'),
            data.status === 'win' ? 'S' : 'N',
            data.self.topKills,
            data.self.topAssists,
            data.self.topDeaths,
            data.self.topDamage,
            data.self.topHealing,
            data.self.topMitigation,
            '',
            data.self.savedPlayers,
            data.self.player.eliminations,
            data.self.player.assists,
            data.self.player.deaths,
            data.self.player.damage,
            data.self.player.healing,
            data.self.player.mitigated,
            '',
            '',
            this.cleanString(data.match.time.text),
            ''
        ];
    }

    cleanString(string: string): string {
        return string.replace(/[^a-zA-Z0-9:-\s]/g, '')
    }

    writeRow(out: string, row: string) {
        fs.writeFileSync(out, row + '\n', {
            encoding: 'utf-8',
            flag: 'a'
        })
    }

}

export class TSVOutput extends RowOutput {

    writeGameResult(data: GameData) {
        const row = this.makeRow(data).join("\t");
        const out = "./output/games.tsv";
        if (!fs.existsSync(out)) {
            this.writeRow(out, this.getHeader().join('\t'))
        }
        this.writeRow(out, row);
    }

}

export class CSVOutput extends RowOutput {

    writeGameResult(data: GameData) {
        const row = this.makeRow(data).join(",");
        const out = "./output/games.csv";
        if (!fs.existsSync(out)) {
            this.writeRow(out, this.getHeader().join(','))
        }
        this.writeRow(out, row);
    }

}

export class GoogleSheetsOutput extends RowOutput {

    private sheet: GoogleSpreadsheet;

    /* constructor() {
        super();
        if(!config.outputs?.gsheets) return;
        this.sheet = new GoogleSpreadsheet(config.outputs.gsheets.sheet);
        this.sheet.useServiceAccountAuth({
            private_key: config.outputs.gsheets.private_key,
            client_email: config.outputs.gsheets.client_email
        })
            .then(() => {
                return this.sheet.loadInfo()
            })
    } */

    async initialize() {
        if (!config.outputs?.gsheets) return;
        
        const SCOPES = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
        ];
        
        const jwt = new JWT({
            email: config.outputs.gsheets.credentials.client_email,
            key: config.outputs.gsheets.credentials.private_key,
            scopes: SCOPES,
        });

        this.sheet = new GoogleSpreadsheet(config.outputs.gsheets.sheet, jwt);
        /* await this.sheet.useServiceAccountAuth({
            private_key: config.outputs.gsheets.private_key,
            client_email: config.outputs.gsheets.client_email
        }); */
        /* const oauthClient = new OAuth2Client({
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        }); */

        await this.sheet.useServiceAccountAuth(config.outputs.gsheets.credentials);
        await this.sheet.loadInfo(); // Esperar a que se complete la carga de información
    }

    async writeGameResult(data: GameData) {
        if (!this.sheet) return
        if (!config.outputs?.gsheets) return;
        const sheet = this.sheet.sheetsByIndex[0]
        if (sheet.rowCount <= 0) {
            // await sheet.addRow(this.getHeader());
            await sheet.setHeaderRow(this.getHeader());
        }
        await sheet.addRow(this.makeRow(data));
    }

}

export class Influx1Output extends Output {

    private influx: influx1.InfluxDB;

    constructor() {
        super();
        if (!config || !config.outputs || !config.outputs.influx || !config.outputs.influx.enabled) return
        const influxConfig: influx1.ISingleHostConfig & any = config.outputs.influx;
        influxConfig.schema = [
            {
                measurement: config.outputs.influx.measurement || 'ocrwatch_games',
                fields: {
                    duration: influx1.FieldType.INTEGER
                },
                tags: [
                    'account',
                    'hero',
                    'mode',
                    'map',
                    'competitive',
                    'state'
                ]
            }
        ]
        this.influx = new influx1.InfluxDB(influxConfig);
    }

    writeGameResult(data: GameData) {
        if (!this.influx) return;
        //TODO
    }

}

export class Influx2Output extends Output {

    private influx: influx2.InfluxDB;
    private writeApi: influx2.WriteApi;

    constructor() {
        super();
        if (!config || !config.outputs || !config.outputs.influx2 || !config.outputs.influx2.enabled) return
        const influxConfig: ClientOptions & any = config.outputs.influx2;
        this.influx = new influx2.InfluxDB(influxConfig)
        this.writeApi = this.influx.getWriteApi(influxConfig.org, influxConfig.bucket);
    }

    writeGameResult(data: GameData) {
        if (!this.influx || !this.writeApi) return;
        //TODO
    }

}
