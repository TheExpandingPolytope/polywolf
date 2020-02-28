import {load} from './src/gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLDivElement {
    constructor(  ) {
        //always call super first in constructor
        super();

        //set style
        this.style = `
            position:relative;
            background-color:grey;
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
        <img src="https://img.icons8.com/nolan/64/000000/play.png">
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
            //hide button
            //this.button.style.visibility = 'hidden';

            //append loading icon
            /*document.body.innerHTML += `
            <style>.image {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 120px;
                height: 120px;
                margin:-60px 0 0 -60px;
                -webkit-animation:spin 4s linear infinite;
                -moz-animation:spin 4s linear infinite;
                animation:spin 4s linear infinite;
            }
            @-moz-keyframes spin { 100% { -moz-transform: rotate(360deg); } }
            @-webkit-keyframes spin { 100% { -webkit-transform: rotate(360deg); } }
            @keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } }</style>
            `;*/
            this.button.innerHTML = 'Loading';

            //load model
            this.load();
            
        }

    }

    //load and render model
    load( ) {
        load(this.gl, this.url)
        .then((gltf)=>{
            this.button.style.visibility = "hidden";
            
            console.log(gltf);
            gltf._render();
        });
    }

};
window.customElements.define('poly-wolf', PolyWolf, { extends: 'div' });
window.customElements.whenDefined('poly-wolf').then(()=>{
    console.log('poly wolf has been defined');
});

export default PolyWolf;
