import Jimp from "jimp";
import cv from "@techstark/opencv-js";

export interface Rect {
    from: [number, number];
    size: [number, number];

    [key: string]: any | Rect;
}

export interface Offset {
    x: number;
    w: number;
}

export interface OcrRequest {
    id: string;
    rect: Rect | null;
    jmp: Jimp|cv.Mat;
    mode: string;
}

export interface OcrResult {
    text: string;
    confidence: number;
}

export interface PlayerData {
    primary: string
    secondary: string
    roleColor: { r: number; g: number; b: number; }
    role: string;
    grouped: boolean;
    name: string;
    eliminations: number
    assists: number
    deaths: number
    damage: number
    healing: number
    mitigated: number
    vacant: boolean
}

export interface SelfStat {
    text: string
    title: string
    value: number|string
    unit: string;
}

export type GameStatus = 'in_progress' | 'win' | 'draw' | 'loss' | 'reset'

export interface GameData {
    times: {
        start: Date,
        end: Date
    },
    notes: string,
    status: GameStatus,
    self: {
        name: string,
        hero: string,
        heroes: string[],
        stats: SelfStat[],
        player: Partial<PlayerData>,
        role: string,
        team: string,
        topKills: string,
        topAssists: string,
        topDeaths: string,
        topDamage: string,
        topHealing: string,
        topMitigation: string,
        highlightStatsValue1: number,
        potg: boolean
    },
    match: {
        info: string,
        mode: string,
        gamemode: string,
        map: string,
        competitive: boolean,
        time: {
            text: string,
            duration: number
        },
        status: {
            type: string,
            text: string,
            lines: string[],
            state: string,
            allies: {
                time: '',
                distance: ''
            },
            enemies: {
                time: '',
                distance: ''
            }
        }
        results: {
            allies: number,
            enemies: number
        }
    },
    performance: any,
    allies: PlayerData[],
    enemies: PlayerData[],
    sums: {
        allies: Partial<PlayerData>,
        enemies: Partial<PlayerData>
    }
}



export interface Session {
    states: string[]
    statesByRole: { [role: string]: string[] }
    /* @deprecated */
    rank: string
    rankByRole: { [role: string]: string }
}

export interface GlobalSession extends Session {
    lastAccount: string;
    lastRole: string;
    accounts: {[key: string]: Session}
}
