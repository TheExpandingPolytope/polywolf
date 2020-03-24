import {load} from './src/gltf_loader.js';
document.body.innerHTML += `
<style>
@-webkit-keyframes spin {
    to {
      -webkit-transform: rotate(360deg);
              transform: rotate(360deg);
    }
  }
  @keyframes spin {
    to {
      -webkit-transform: rotate(360deg);
              transform: rotate(360deg);
    }
  }
  .stroke-dotted {
    opacity: 0;
    stroke-dasharray: 4,5;
    stroke-width: 1px;
    -webkit-transform-origin: 50% 50%;
            transform-origin: 50% 50%;
    -webkit-animation: spin 4s infinite linear;
            animation: spin 4s infinite linear;
    -webkit-transition: opacity 1s ease,  stroke-width 1s ease;
    transition: opacity 1s ease,  stroke-width 1s ease;
  }
  
  .stroke-solid {
    stroke-dashoffset: 0;
    stroke-dashArray: 300;
    stroke-width: 4px;
    -webkit-transition: stroke-dashoffset 1s ease,  opacity 1s ease;
    transition: stroke-dashoffset 1s ease,  opacity 1s ease;
  }
  
  .icon {
    -webkit-transform-origin: 50% 50%;
            transform-origin: 50% 50%;
    -webkit-transition: -webkit-transform 200ms ease-out;
    transition: -webkit-transform 200ms ease-out;
    transition: transform 200ms ease-out;
    transition: transform 200ms ease-out, -webkit-transform 200ms ease-out;
  }
  
  #play:hover .stroke-dotted {
    stroke-width: 4px;
    opacity: 1;
  }
  #play:hover .stroke-solid {
    opacity: 0;
    stroke-dashoffset: 300;
  }
  #play:hover .icon {
    -webkit-transform: scale(1.05);
            transform: scale(1.05);
  }
  
  #play {
    cursor: pointer;
    position: absolute;
    top: 50%;
    left: 50%;
    -webkit-transform: translateY(-50%) translateX(-50%);
            transform: translateY(-50%) translateX(-50%);
  }
  
</style>
`
//define custom element poly wolf
class PolyWolf extends HTMLDivElement {
    constructor(  ) {
        //always call super first in constructor
        super();

        //set style
        this.style = `
            position:relative;
            background-color:white;
            padding:0;
            margin:0;
            border-width:0.5px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2), 0 3px 10px 0 rgba(0, 0, 0, 0.19);
            background-color: #55555;
            cursor:grab;
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
        <svg version="1.1" id="play" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" height="50px" width="50px"
	 viewBox="0 0 100 100" enable-background="new 0 0 100 100" xml:space="preserve">
  <path class="stroke-solid" fill="none" stroke="rgba(0,0,0,.4)"  d="M49.9,2.5C23.6,2.8,2.1,24.4,2.5,50.4C2.9,76.5,24.7,98,50.3,97.5c26.4-0.6,47.4-21.8,47.2-47.7
    C97.3,23.7,75.7,2.3,49.9,2.5"/>
  <path class="stroke-dotted" fill="none" stroke="rgba(0,0,0,.4)"  d="M49.9,2.5C23.6,2.8,2.1,24.4,2.5,50.4C2.9,76.5,24.7,98,50.3,97.5c26.4-0.6,47.4-21.8,47.2-47.7
    C97.3,23.7,75.7,2.3,49.9,2.5"/>
  <path class="icon" fill="rgba(0,0,0,.4)" d="M38,69c-1,0.5-1.8,0-1.8-1.1V32.1c0-1.1,0.8-1.6,1.8-1.1l34,18c1,0.5,1,1.4,0,1.9L38,69z"/>
</svg>
        `
        this.button.style = `
            margin: 0;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius:20px;
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
            this.button.innerHTML = `Loading`+this.url;

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
        })
        .catch((err)=>{
          this.button.innerHTML = 'failed to loader'+this.url;
        });
    }

};
window.customElements.define('poly-wolf', PolyWolf, { extends: 'div' });
window.customElements.whenDefined('poly-wolf').then(()=>{
    console.log('poly wolf has been defined');
})
