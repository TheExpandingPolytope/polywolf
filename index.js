import {load} from './src/gltf_loader.js';

var style = document.createElement('style');
style.innerText = `
    poly-wolf {
        --background: #1E88E5;
        --color: white;
        --padding: 2rem 4rem;
        --font-size: 1.5rem;
      }
    }
`;
document.body.append(style);

//define custom element poly wolf
class PolyWolf extends HTMLElement {
    constructor(  ) {
        //always call super first in constructor
        super();
        this.style.height = "100%";
        var shadow = this.attachShadow({mode: 'open'});
        var style = document.createElement('style');

        style.textContent = `
        div {
            background: var(--background);
            color: var(--color);
            font-size: var(--font-size);
            border: 0;
            border-radius:10px;
          }
          canvas{
              position:relative;
          }
          button{
              position:relative;
              height:20px;
              width:30px;
              left:-30px;
              top:-20px;
          }
        `;


        //add canvas
        this.canvas = document.createElement('canvas');

        //set dimensions
        this.style.height = this.canvas.height = this.getAttribute('height');
        this.style.width = this.canvas.width = this.getAttribute('width');
        

        //set webgl 2 context
        this.gl = this.canvas.getContext('webgl2');

        //set model url
        this.url = this.getAttribute('url')

        //create load button
        this.button = document.createElement('button');
        this.button.innerHTML = `load`;
        
        var el = document.createElement('div');

        el.appendChild(this.canvas);
        el.append( this.button );
        shadow.append(el);
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

export default PolyWolf;
