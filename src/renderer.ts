/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

import {desktopCapturer, ipcRenderer} from 'electron';
import {Coordinates} from "./coordinates";
import {createWorker, Worker} from "tesseract.js";
import Jimp from "jimp";
import {Rect} from "./types";

console.log('👋 This message is being logged by "renderer.js", included via webpack');

setTimeout(() => {
    ipcRenderer.send('initVideo');
}, 1000);
setTimeout(() => {
    ipcRenderer.send('takeScreenshot');
}, 1200);

const imageTypes: Set<string> = new Set<string>();

document.getElementById('screenshotBtn').addEventListener('click', e => {
    console.log("screenshotBtn takeScreenshot")
    ipcRenderer.send('takeScreenshot');
});

const imageSelect = document.getElementById('imageSelect') as HTMLSelectElement;

imageSelect.addEventListener('click', e => {
    updatePreview();
});
imageSelect.addEventListener('change', e => {
    updatePreview();
});

const canvas = document.getElementById('screenshotCanvas') as HTMLCanvasElement;

function updatePreview() {
    const img = document.getElementById('img-' + imageSelect.value) as HTMLImageElement;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    //TODO: toggle
    ctx.strokeStyle = 'blue';
    ctx.strokeRect(Coordinates.scoreboard.allies.from[0], Coordinates.scoreboard.allies.from[1],
        Coordinates.scoreboard.allies.size[0], Coordinates.scoreboard.allies.size[1]);
    ctx.strokeStyle = 'red';
    ctx.strokeRect(Coordinates.scoreboard.enemies.from[0], Coordinates.scoreboard.enemies.from[1],
        Coordinates.scoreboard.enemies.size[0], Coordinates.scoreboard.enemies.size[1]);

    ctx.strokeStyle = 'green';
    ctx.strokeRect(Coordinates.self.name.from[0], Coordinates.self.name.from[1],
        Coordinates.self.name.size[0], Coordinates.self.name.size[1])
    ocr(canvas, Coordinates.self.name as Rect, 'self-name');
    ctx.strokeRect(Coordinates.self.hero.from[0], Coordinates.self.hero.from[1],
        Coordinates.self.hero.size[0], Coordinates.self.hero.size[1])
    ocr(canvas, Coordinates.self.hero as Rect, 'self-hero');

    ctx.strokeRect(Coordinates.match.wrapper.from[0], Coordinates.match.wrapper.from[1],
        Coordinates.match.wrapper.size[0], Coordinates.match.wrapper.size[1])
    ctx.strokeStyle = 'gold';
    ctx.strokeRect(Coordinates.match.time.from[0], Coordinates.match.time.from[1],
        Coordinates.match.time.size[0], Coordinates.match.time.size[1])
    ocr(canvas, Coordinates.match.time as Rect, 'match-time');


}

const workerPool: Worker[] = [];
let workerIndex = 0;
const workerBusys: Map<string, boolean> = new Map<string, boolean>();

for (let i = 0; i < 10; i++) {
    (async () => {
        const worker = await createWorker({
            logger: m => console.log(m),
        });
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        workerPool[i] = worker;
    })();
}

async function ocr(canvas: HTMLCanvasElement, rect: Rect, id: string) {
    if (workerBusys.get(id)) {
        return;
    }
    workerBusys.set(id, true);

    // const recognized = await Tesseract.recognize(canvas);
    const worker = workerPool[workerIndex++];
    if (workerIndex >= 10) {
        workerIndex = 0;
    }
    let recognized;
    try {
        recognized = await worker.recognize(canvas, {
            rectangle: {
                left: rect.from[0],
                top: rect.from[1],
                width: rect.size[0],
                height: rect.size[1]
            }
        }, {
            text: true,
            pdf: false,
            tsv: false,
            hocr: false,
            blocks: false
        });
    } catch (e) {
        console.log(e)
    }
    workerBusys.set(id, false);
    console.log(recognized);
    console.log(recognized.data.text)

    ipcRenderer.send('recognizedText', id, recognized.data.text)
    let element = document.querySelector('.text-debug#' + id);
    if (!element) {
        element = document.createElement('span');
        element.className = 'text-debug';
        element.id = id;
        document.getElementById('textDebug').appendChild(element);
    }
    element.textContent = `[${id}] ${recognized.data.text}`;
}


// ipcRenderer.on('screenshotContent', async (event, sourceId) => {
//     console.log("source",sourceId)
//     document.getElementById('screenshotPreview').src = sourceId
// });

const screenshotStatus = document.getElementById('screenshotStatus');
ipcRenderer.on('takingScreenshot', e => {
    screenshotStatus.textContent = "Taking screenshot";
})

ipcRenderer.on('imageContent', async (event, imageType, content) => {
    screenshotStatus.textContent = "Got new screenshot";

    let element = document.getElementById(`img-${imageType}`) as HTMLImageElement;
    if (!element) {
        element = document.createElement('img') as HTMLImageElement;
        element.className = 'image-content';
        element.id = `img-${imageType}`;
        element.style.display = 'none';
        document.body.appendChild(element);

        imageTypes.add(imageType);
        const select = (document.getElementById('imageSelect') as HTMLSelectElement);
        const option = document.createElement('option') as HTMLOptionElement;
        option.value = imageType;
        option.text = imageType;
        select.appendChild(option);
    }
    element.src = content;

    // wait for new image content to load before re-drawing
    setTimeout(() => {
        updatePreview();
    }, 200);
})
