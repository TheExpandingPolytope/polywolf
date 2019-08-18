import {load} from './gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLCanvasElement {
    constructor() {
        //always call super first in constructor
        super();
        
        // Create a shadow root
        var shadow = this.attachShadow({mode: 'open'});

        // Create spans
        var wrapper = document.createElement('span');
        wrapper.setAttribute('class','wrapper');
        var icon = document.createElement('span');
        icon.setAttribute('class','icon');
        icon.setAttribute('tabindex', 0);
        var info = document.createElement('span');
        info.setAttribute('class','info');

        // Take attribute content and put it inside the info span
        var text = this.getAttribute('text');
        info.textContent = text;

        // Insert icon
        var imgUrl;
        if(this.hasAttribute('img')) {
        imgUrl = this.getAttribute('img');
        } else {
        imgUrl = 'img/default.png';
        }
        var img = document.createElement('img');
        img.src = imgUrl;
        icon.appendChild(img);

        // Create some CSS to apply to the shadow dom
        var style = document.createElement('style');

        style.textContent = '.wrapper {' +
        // CSS truncated for brevity

        // attach the created elements to the shadow dom

        shadow.appendChild(style);
        shadow.appendChild(wrapper);
        wrapper.appendChild(icon);
        wrapper.appendChild(info);

    }

    connectedCallback(){
        console.log("added polywold");
        console.log(this.getAttribute('url'));
        //set webgl 2 context
        this.gl = this.getContext('webgl2');

        //set model url
        this.url = this.getAttribute('url');

        //load and render model
        load(this.gl, this.url)
        .then((gltf)=>{
            console.log(gltf);
            gltf._render();
        });
    }
}
customElements.define('poly-wolf', PolyWolf, { extends: 'canvas' });

