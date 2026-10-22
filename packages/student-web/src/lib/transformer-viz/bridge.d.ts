export type Concept = 'embedding'|'norm'|'attention'|'softmax'|'projection'|'mlp'|'residual'|'output';
export type Selection = {name:string;shape:number[];index:number[];value:number|null;concept:Concept};
export type Snapshot = {time:number;duration:number;running:boolean;concept:Concept|null;tokens:number[];probabilities:number[];selection:Selection|null};
export type ModelInput = {id:string;title:string;Q:number[][];K:number[][];V:number[][]};
export interface Explorer {
 destroy():void; focus(id:Concept):void; overview():void; play():void; scrub(value:number):void; speed(value:number):void; rotate():void; zoom(factor:number):void; input(text:string):void; step():void;
 attentionInput(layer?:number,head?:number):ModelInput;
 attentionWeights(layer?:number,head?:number):number[][];
}
export function conceptFor(name:string):Concept;
export function createExplorer(canvas:HTMLCanvasElement,onFrame:(snapshot:Snapshot)=>void,onPick:(selection:Selection)=>void,signal?:AbortSignal):Promise<Explorer>;
