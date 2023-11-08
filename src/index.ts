import {app, BrowserWindow, desktopCapturer, ipcMain, session} from 'electron';
import Jimp from "jimp";
import {Coordinates} from "./coordinates";
import { uIOhook, UiohookKey } from 'uiohook-napi'
import {
    tapAfterEnvironmentToPatchWatching
} from "fork-ts-checker-webpack-plugin/lib/hooks/tap-after-environment-to-patch-watching";
import * as path from "path";
import * as fs from "fs";
import { Logger } from './util';
// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Webpack
// plugin that tells the Electron app where to look for the Webpack-bundled app code (depending on
// whether you're running in development or production).
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const keycodeToCharacter: { [keycode: number]: string } = {
    // 14: 'Backspace',
    // 15: 'Tab',
    // 28: 'Enter',
    // 58: 'CapsLock',
    // 1: 'Escape',
    57: ' ',
    // 3657: 'PageUp',
    // 3665: 'PageDown',
    // 3663: 'End',
    // 3655: 'Home',
    // 57419: 'ArrowLeft',
    // 57416: 'ArrowUp',
    // 57421: 'ArrowRight',
    // 57424: 'ArrowDown',
    // 3666: 'Insert',
    // 3667: 'Delete',
    11: '0',
    2: '1',
    3: '2',
    4: '3',
    5: '4',
    6: '5',
    7: '6',
    8: '7',
    9: '8',
    10: '9',
    30: 'a',
    48: 'b',
    46: 'c',
    32: 'd',
    18: 'e',
    33: 'f',
    34: 'g',
    35: 'h',
    23: 'i',
    36: 'j',
    37: 'k',
    38: 'l',
    50: 'm',
    49: 'n',
    41: 'ñ',
    24: 'o',
    25: 'p',
    16: 'q',
    19: 'r',
    31: 's',
    20: 't',
    22: 'u',
    47: 'v',
    17: 'w',
    45: 'x',
    21: 'y',
    44: 'z',
    82: '0',
    79: '1',
    80: '2',
    81: '3',
    75: '4',
    76: '5',
    77: '6',
    71: '7',
    72: '8',
    73: '9',
    55: '*',
    78: '+',
    74: '-',
    83: '.',
    3637: '/',
    12: '-',
    13: '+',
    26: '\'',
    43: 'º',
    51: ',',
    52: '.',
    // Add more mappings as needed
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

process.on('uncaughtException', function (error) {
    Logger.error(error);

});

const createWindow = async (): Promise<void> => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        height: 900,
        width: 1600,
        webPreferences: {
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            nodeIntegration: true,
            contextIsolation: false,
            nodeIntegrationInWorker: true,
        },
    });
    mainWindow.webContents.setFrameRate(1);


    // globalShortcut.register('Tab',()=>{
    //     Logger.info("tab pressed!")
    // })

    // and load the index.html of the app.
    await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    const appDataDir = path.join(app.getPath("appData"), 'ocrwatch');
    const gamesDir = './output/games';
    if (!fs.existsSync(appDataDir)) {
        fs.mkdirSync(appDataDir);
    }
    if (!fs.existsSync(gamesDir)) {
        fs.mkdirSync(gamesDir, { recursive: true });
    }
    mainWindow.webContents.send('appDataPath', appDataDir);

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        app.quit();
    })

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ['']
            }
        })
    })

    ipcMain.on('initVideo', () => {
        Logger.info("initVideo")
        desktopCapturer.getSources({types: ['screen']}).then(async sources => {
            mainWindow.webContents.send('setSource', sources[0].id);
            for (const source of sources) {
                Logger.info(source);
            }
        })
    })

    // let keyDown = false;

    // not a keylogger, promise!
    let listenAllKeys = false;

    Logger.info(uIOhook)
    uIOhook.on('keydown',e=>{
        // Logger.info("KEY:", e)
        if (e.keycode === UiohookKey.Insert /* && !keyDown */) {
            // keyDown = true;
            mainWindow.webContents.send('getScreenshot', true);
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.W) {
            mainWindow.webContents.send('gameResult', 'win');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.L) {
            mainWindow.webContents.send('gameResult', 'loss');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.E) { // Result: Equals (Draw)
            mainWindow.webContents.send('gameResult', 'draw');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.R) {
            mainWindow.webContents.send('gameResult', 'reset');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.P) {
            mainWindow.webContents.send('setPOTG', true);
        }
        else if (e.ctrlKey && e.altKey && e.keycode === UiohookKey.P) {
            mainWindow.webContents.send('setPOTG', false);
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.A) {
            mainWindow.webContents.send('setTeam', 'Attacker');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.D) {
            mainWindow.webContents.send('setTeam', 'Defender');
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.Home) {
            listenAllKeys = true;
            mainWindow.webContents.send('listenAllKeys', listenAllKeys);
        }
        else if (e.ctrlKey && e.shiftKey && e.keycode === UiohookKey.End) {
            listenAllKeys = false;
            mainWindow.webContents.send('listenAllKeys', listenAllKeys);
        }
        // Set Allies Result
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[0] || e.keycode === UiohookKey.Numpad0)) {
            mainWindow.webContents.send('setResultAllies', 0);
        }
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[1] || e.keycode === UiohookKey.Numpad1)) {
            mainWindow.webContents.send('setResultAllies', 1);
        }
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[2] || e.keycode === UiohookKey.Numpad2)) {
            mainWindow.webContents.send('setResultAllies', 2);
        }
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[3] || e.keycode === UiohookKey.Numpad3)) {
            mainWindow.webContents.send('setResultAllies', 3);
        }
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[4] || e.keycode === UiohookKey.Numpad4)) {
            mainWindow.webContents.send('setResultAllies', 4);
        }
        else if (e.ctrlKey && e.shiftKey && (e.keycode === UiohookKey[5] || e.keycode === UiohookKey.Numpad5)) {
            mainWindow.webContents.send('setResultAllies', 5);
        }
        // Set Enemies Result
        else if (e.altKey && (e.keycode === UiohookKey[0] || e.keycode === UiohookKey.Numpad0)) {
            mainWindow.webContents.send('setResultEnemies', 0);
        }
        else if (e.altKey && (e.keycode === UiohookKey[1] || e.keycode === UiohookKey.Numpad1)) {
            mainWindow.webContents.send('setResultEnemies', 1);
        }
        else if (e.altKey && (e.keycode === UiohookKey[2] || e.keycode === UiohookKey.Numpad2)) {
            mainWindow.webContents.send('setResultEnemies', 2);
        }
        else if (e.altKey && (e.keycode === UiohookKey[3] || e.keycode === UiohookKey.Numpad3)) {
            mainWindow.webContents.send('setResultEnemies', 3);
        }
        else if (e.altKey && (e.keycode === UiohookKey[4] || e.keycode === UiohookKey.Numpad4)) {
            mainWindow.webContents.send('setResultEnemies', 4);
        }
        else if (e.altKey && (e.keycode === UiohookKey[5] || e.keycode === UiohookKey.Numpad5)) {
            mainWindow.webContents.send('setResultEnemies', 5);
        }

        if (listenAllKeys === true) {
            mainWindow.webContents.send('sendKeyStroke', e.keycode, keycodeToCharacter[e.keycode] || '');
        }
    })
    /* uIOhook.on('keyup',e=>{
        // not a keylogger, promise!
        if (e.keycode === UiohookKey.Insert && keyDown) {
            keyDown = false;
            mainWindow.webContents.send('getScreenshot', false);
        }
    }) */
    uIOhook.start();



    // setInterval(async () => {
    //     if (!mainWindow) return;
    //     if (!mainWindow.webContents) return;
    //     await loop(mainWindow)
    // }, 5 * 1000);
    // setTimeout(() => {
    //     loop(mainWindow)
    // }, 2000);
};

ipcMain.handle('getAppData', () => path.join(app.getPath("appData"), 'ocrwatch'));

// async function loop(mainWindow: BrowserWindow) {
//     try {
//         mainWindow.webContents.send('takingScreenshot');
//         const shot = await screenshot.takeScreenshot();
//         if(!shot) return;
//         const jmp = await Jimp.read(Buffer.from(shot.substring('data:image/png;base64,'.length), 'base64'));
//
//         await ocr.processScreenshot(jmp);
//     } catch (e) {
//         console.error(e);
//     }
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
