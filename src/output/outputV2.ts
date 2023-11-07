import {GameData} from "../types";
import * as fs from "fs";
import Jimp from "jimp";
import * as influx1 from "influx";
import * as influx2 from "@influxdata/influxdb-client"

import config from "../../config.json";
import {ClientOptions} from "@influxdata/influxdb-client";
import {GoogleSpreadsheet} from "google-spreadsheet";
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
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

export function capitalizeFirstLetterOfWords(inputString: string) {
    const words = inputString.toLowerCase().split(' ');

    for (let i = 0; i < words.length; i++) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }

    return words.join(' ');
}

export function cleanString(string: string): string {
    return string.replace(/[^a-zA-Z0-9:-\s]/g, '')
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
            "Start Date",
            "End Date",
            "Day",
            "Map",
            "Mode",
            "Team",
            "Role",
            "Hero",
            "Win",
            "Group",
            "Top Kills",
            "Top Assists",
            "Top Deaths",
            "Top Damage",
            "Top Heal",
            "Top Mit",
            "POTG",
            "Saved", // TODO: Add other roles top stats such as Saved Players for Support role
            "E",
            "A",
            "D",
            "Dmg",
            "Heal",
            "Mit",
            "Result Allies",
            "Result Enemies",
            "Time",
            "Total Time",
            "Notes",
            "Total Allies Kills",
            "Total Allies Assists",
            "Total Allies Deaths",
            "Total Allies Dmg",
            "Total Allies Heal",
            "Total Allies Mit",
            "Total Enemies Kills",
            "Total Enemies Assists",
            "Total Enemies Deaths",
            "Total Enemies Dmg",
            "Total Enemies Heal",
            "Total Enemies Mit",
            "Stat 1 Title",
            "Stat 1 Value",
            "Stat 2 Title",
            "Stat 2 Value",
            "Stat 3 Title",
            "Stat 3 Value",
            "Stat 4 Title",
            "Stat 4 Value",
            "Stat 5 Title",
            "Stat 5 Value",
            "Stat 6 Title",
            "Stat 6 Value",
            "Stat 7 Title",
            "Stat 7 Value",
            "Stat 8 Title",
            "Stat 8 Value"
        ];
    }

    makeRow(data: GameData): (string | number | boolean)[] {
        const totalTime = `${differenceInMinutes(data.times.end, data.times.start).toString()}:${(differenceInSeconds(data.times.end, data.times.start) % 60).toString().padStart(2, '0')}`;
        return [
            format(data.times.start, 'dd/MM/yyyy HH:mm:ss'),
            format(data.times.end, 'dd/MM/yyyy HH:mm:ss'),
            capitalizeFirstLetterOfWords(format(data.times.start, 'EEEE', { locale: es })),
            capitalizeFirstLetterOfWords(cleanString(data.match.map)),
            capitalizeFirstLetterOfWords(cleanString(data.match.mode)),
            data.self.team,
            data.self.role,
            data.self.heroes.map(hero => capitalizeFirstLetterOfWords(hero.replace(/[^a-zA-Z0-9]/g, ''))).join('/'),
            data.status === 'win',
            data.self.player.grouped === true,
            data.self.topKills,
            data.self.topAssists,
            data.self.topDeaths,
            data.self.topDamage,
            data.self.topHealing,
            data.self.topMitigation,
            data.self.potg === true,
            data.self.highlightStatsValue1, // TODO: Add other roles top stats such as Saved Players for Support role
            data.self.player.eliminations,
            data.self.player.assists,
            data.self.player.deaths,
            data.self.player.damage,
            data.self.player.healing,
            data.self.player.mitigated,
            data.match.results.allies,
            data.match.results.enemies,
            cleanString(data.match.time.text),
            totalTime,
            capitalizeFirstLetterOfWords(data.notes),
            data.sums.allies.eliminations,
            data.sums.allies.assists,
            data.sums.allies.deaths,
            data.sums.allies.damage,
            data.sums.allies.healing,
            data.sums.allies.mitigated,
            data.sums.enemies.eliminations,
            data.sums.enemies.assists,
            data.sums.enemies.deaths,
            data.sums.enemies.damage,
            data.sums.enemies.healing,
            data.sums.enemies.mitigated,
            capitalizeFirstLetterOfWords(data.self.stats[0].title),
            data.self.stats[0].title !== '' ? `${data.self.stats[0].value}${data.self.stats[0].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[1].title),
            data.self.stats[1].title !== '' ? `${data.self.stats[1].value}${data.self.stats[1].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[2].title),
            data.self.stats[2].title !== '' ? `${data.self.stats[2].value}${data.self.stats[2].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[3].title),
            data.self.stats[3].title !== '' ? `${data.self.stats[3].value}${data.self.stats[3].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[4].title),
            data.self.stats[4].title !== '' ? `${data.self.stats[4].value}${data.self.stats[4].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[5].title),
            data.self.stats[5].title !== '' ? `${data.self.stats[5].value}${data.self.stats[5].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[6].title),
            data.self.stats[6].title !== '' ? `${data.self.stats[6].value}${data.self.stats[6].unit}` : '',
            capitalizeFirstLetterOfWords(data.self.stats[7].title),
            data.self.stats[7].title !== '' ? `${data.self.stats[7].value}${data.self.stats[7].unit}` : '',
        ];
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
        
        /* const SCOPES = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
        ];
        
        const jwt = new JWT({
            email: config.outputs.gsheets.credentials.client_email,
            key: config.outputs.gsheets.credentials.private_key,
            scopes: SCOPES,
        }); */

        this.sheet = new GoogleSpreadsheet(config.outputs.gsheets.sheet);
        /* await this.sheet.useServiceAccountAuth({
            private_key: config.outputs.gsheets.private_key,
            client_email: config.outputs.gsheets.client_email
        }); */
        /* const oauthClient = new OAuth2Client({
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        }); */

        await this.sheet.useServiceAccountAuth(config.outputs.gsheets.credentials);
        await this.sheet.loadInfo();
    }

    async writeGameResult(data: GameData) {
        if (!this.sheet) return
        if (!config.outputs?.gsheets) return;
        const sheet = data.match.competitive === false ? this.sheet.sheetsByIndex[0] : this.sheet.sheetsByIndex[1]
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
