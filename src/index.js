import {load} from './gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLCanvasElement {
    constructor( url ) {
        //always call super first in constructor
        super();

        //set webgl 2 context
        this.gl = this.getContext('webgl2');

        //set model url
        this.setAttribute('url', url);

        //
        this.height = 400;
        this.width = 600;

        //load and render model
        load(this.gl, this.getAttribute('url'))
        .then((gltf)=>{
            console.log(gltf);
            gltf._render();
        });
    }

}
customElements.define('poly-wolf', PolyWolf, { extends: 'canvas' });

var poly = new PolyWolf("assets/DamagedHelmet.gltf");
document.body.appendChild(poly);

var corset = new PolyWolf("assets/Corset.gltf");
document.body.appendChild(corset);

var boombox = new PolyWolf("assets/BoomBox.gltf");
document.body.appendChild(boombox);