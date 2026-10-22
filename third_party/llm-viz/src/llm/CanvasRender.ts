// Adapted from bbycroft/llm-viz (MIT), pinned 9da9374. See third_party/llm-viz/README.md at the repository root.
import { IDataAndModel, IModelState, initModel } from './GptModel';
import { IRenderState, IRenderView } from './render/modelRender';
import { IFontAtlasData } from './render/fontRender';
import { Random } from '../utils/random';
import { initProgramState, IProgramState, runProgram } from './Program';
import { Vec3 } from '../utils/vector';
import { constructModel, createGpuModelForWasm } from './GptModelWasm';
interface ICanvasData {
    dataAndModel: IDataAndModel | null;
}

export class CanvasRender {
    renderState: IRenderState;
    progState: IProgramState;
    modelState: IModelState | null = null;
    random: Random;
    stopped = false;
    canvasSizeDirty = true;

    constructor(canvasEl: HTMLCanvasElement, private canvasData: ICanvasData, fontAtlasData: IFontAtlasData) {
        this.progState = initProgramState(canvasEl, fontAtlasData);
        this.progState.markDirty = this.markDirty;
        this.progState.walkthrough.markDirty = this.markDirty;
        this.renderState = this.progState.render;
        this.random = new Random(4);
    }

    destroy() {
        this.stopped = true;
        cancelAnimationFrame(this.rafHandle);
        if (this.renderState && !this.renderState.canvasEl.isConnected) this.renderState.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }

    setData(data: ICanvasData) {
        this.canvasData = data;

        if (data.dataAndModel && !this.progState.gptGpuModel && this.progState.render) {
            this.progState.gptGpuModel = initModel(this.renderState, data.dataAndModel, 1);
            this.progState.native = data.dataAndModel.native;
            this.progState.wasmGptModel = constructModel(data.dataAndModel.model, data.dataAndModel.model.config, data.dataAndModel.native);
            this.progState.jsGptModel = createGpuModelForWasm(this.renderState.gl, data.dataAndModel.model.config);
            // initWebGpu();
            // setModelInputData(this.renderState, this.progState.gptGpuModel, this.random);
            // runModel(this.renderState, this.progState.gptGpuModel);
        }
        this.markDirty();
    }

    prevTime: number = performance.now();
    rafHandle: number = 0;
    isDirty = false;
    isWaitingForSync = false;

    markDirty = () => {
        if (!this.canvasData || this.stopped) {
            return;
        }

        this.isDirty = true;
        if (!this.rafHandle) {
            this.prevTime = performance.now();
            this.rafHandle = requestAnimationFrame(this.loop);
        }
    }

    loop = (time: number) => {
        if (!(this.isDirty || this.isWaitingForSync) || this.stopped) {
            this.rafHandle = 0;
            return;
        }
        let wasDirty = this.isDirty;

        this.isDirty = false;
        this.isWaitingForSync = false;

        let dt = time - this.prevTime;
        this.prevTime = time;
        if (dt < 8) dt = 16; // sometimes we get -ve dt due to perf.now() vs requestAnimationFrame() timing, so put to 16ms in that case

        // we separate waitingForSync from dirty, so we don't have to render if we're only waiting for sync
        this.checkSyncObjects();
        let prevSyncCount = this.progState.render?.syncObjects.length ?? 0;

        if (wasDirty || this.isDirty) {
            this.render(time, dt);
        }

        let newSyncCount = this.progState.render?.syncObjects.length ?? 0;
        if (newSyncCount !== prevSyncCount) {
            this.isWaitingForSync = true;
        }

        this.rafHandle = requestAnimationFrame(this.loop);
    }

    checkSyncObjects() {
        if (!this.progState.render) {
            return;
        }

        let gl = this.renderState.gl;
        let objs = this.progState.render.syncObjects;
        let anyToRemove = false;

        for (let i = 0; i < objs.length; i++) {
            let obj = objs[i];
            if (obj.isReady) {
                anyToRemove = true;
                continue;
            }
            let syncStatus = gl.clientWaitSync(obj.sync, 0, 0);
            if (syncStatus === gl.TIMEOUT_EXPIRED) {
                this.isWaitingForSync = true;
            } else {
                obj.isReady = true;
                obj.elapsedMs = performance.now() - obj.startTime;
                gl.deleteSync(obj.sync);
                anyToRemove = true;
            }
        }
        if (anyToRemove) {
            this.progState.render.syncObjects = objs.filter(o => !o.isReady);
            this.markDirty();
        }
    }

    render(time: number, dt: number) {
        if (!this.progState.render) {
            return;
        }

        let canvasEl = this.renderState.canvasEl;

        if (this.canvasSizeDirty) {
            let bcr = canvasEl.getBoundingClientRect();
            let scale = Math.min(window.devicePixelRatio, 2);
            canvasEl.width = bcr.width * scale;
            canvasEl.height = bcr.height * scale;
            this.progState.render.size = new Vec3(bcr.width, bcr.height);
            this.canvasSizeDirty = false;
        }

        let view: IRenderView = { time, dt, markDirty: this.markDirty };
        runProgram(view, this.progState);
        this.progState.htmlSubs.notify();
    }

}
