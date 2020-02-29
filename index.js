import {load} from './src/gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLElement {
    constructor(  ) {
        //always call super first in constructor
        super();
        this.style.height = "auto";
        thi
        var shadow = this.attachShadow({mode: 'open'});
        var style = document.createElement('style');

        style.textContent = `
            body:{
                margin:0;
                padding:0;
                height:100%;
                width:100%;
            }
            poly-wolf {
                width:100%;
                height:100%;
            }
            canvas{
                position:absolute;
            }
            button {
                position:absolute;
            }
        `;


        //add canvas
        this.canvas = document.createElement('canvas');

        //set dimensions
        this.canvas.height = this.getAttribute('height');
        this.canvas.width = this.getAttribute('width');


        //set webgl 2 context
        this.gl = this.canvas.getContext('webgl2');

        //set model url
        this.url = this.getAttribute('url')

        //create load button
        this.button = document.createElement('button');
        this.button.innerHTML = `load`;

        shadow.appendChild(this.canvas);
        shadow.append( this.button );
        shadow.append(style);

        this.button.onclick = () =>{
            this.button.innerHTML = 'Loading';
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
window.customElements.define('poly-wolf', PolyWolf);
window.customElements.whenDefined('poly-wolf').then(()=>{
    console.log('poly wolf has been defined');
});


export default PolyWolf;
