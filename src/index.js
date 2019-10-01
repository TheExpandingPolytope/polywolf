import {load} from './gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLDivElement {
    constructor(  ) {
        //always call super first in constructor
        super();

        //set style
        this.style = `
            position:relative;
        `;

        //add canvas
        this.canvas = document.createElement('canvas');
        this.appendChild(this.canvas);

        //set dimensions
        this.canvas.height = this.getAttribute('height');
        this.canvas.width = this.getAttribute('width');

        //set container dimensions
        this.style.height = this.canvas.height;
        this.style.width = this.canvas.width;

        //set opacity
        this.canvas.style = `
            position:absolute;
            opacity:0.9;
        `;

        //set webgl 2 context
        this.gl = this.canvas.getContext('webgl2');

        //set model url
        this.url = this.getAttribute('url')

        //create load button
        this.button = document.createElement('div');
        this.button.innerHTML = `
        <img src="https://img.icons8.com/color/48/000000/circled-play--v1.png">
        `
        this.button.style = `
            margin: 0;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color:black;
        `;
        this.appendChild( this.button );

        //load model once button is clicked
        this.button.onclick = () =>{
            //load model
            this.load();
            //hide button
            this.button.style.visibility = 'hidden';
        }

    }

    //load and render model
    load( ) {
        load(this.gl, this.url)
        .then((gltf)=>{
            console.log(gltf);
            gltf._render();
        });
    }

};
window.customElements.define('poly-wolf', PolyWolf, { extends: 'div' });
window.customElements.whenDefined('poly-wolf').then(()=>{
    console.log('poly wolf has been defined');
})
