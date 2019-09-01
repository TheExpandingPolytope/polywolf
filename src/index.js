import {load} from './gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLElement {
    constructor(  ) {
        //always call super first in constructor
        super();

        //add canvas
        this.canvas = document.createElement('canvas');
        this.appendChild(this.canvas);

        //set dimensions
        this.canvas.height = this.getAttribute('height');
        this.canvas.width = this.getAttribute('width');

        //set opacity
        this.canvas.style.opacity = '0.9';

        //set webgl 2 context
        this.gl = this.canvas.getContext('webgl2');

        //set model url
        this.url = this.getAttribute('url')

        
        //load and render model
        load(this.gl, this.getAttribute('url'))
        .then((gltf)=>{
            console.log(gltf);
            gltf._render();
        });
    }

};

window.customElements.define('poly-wolf', PolyWolf);
window.customElements.whenDefined('poly-wolf').then(()=>{
    console.log('poly wolf has been defined');
})
