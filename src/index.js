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
        <div class="play-btn">
        <a href="#">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
            <polygon class="play-btn__svg" points="9.33 6.69 9.33 19.39 19.3 13.04 9.33 6.69"/>
            <path class="play-btn__svg" d="M26,13A13,13,0,1,1,13,0,13,13,0,0,1,26,13ZM13,2.18A10.89,10.89,0,1,0,23.84,13.06,10.89,10.89,0,0,0,13,2.18Z"/>
            </svg> 
        </a>
        </div>
        `
        this.button.style = `
            margin: 0;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
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
