import {load} from './gltf_loader.js';

//define custom element poly wolf
class PolyWolf extends HTMLDivElement {
    constructor() {
      // Always call super first in constructor
      super();
  
      // Element functionality written in here
    }
}
customElements.define('poly-wolf', PolyWolf, { extends: 'div' });

//set ui element
var ui = document.createElement('div');
ui.style = 'visibility:hidden;position:absolute;bottom:0;color:white;height:38px; width:100%;display:flex;justify-content:space-between;';

//set another elemnt
var p = document.createElement('div');
p.style = 'position:absolute; top:0; color:white; height:38px;font-size:12px;padding:10px;visibility:hidden;';

//set logo element
var img = new Image(100, 100);
img.style = 'position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);';
img.src = 'polywolf.jpg';


//create canvas
var canvas = document.createElement('canvas');
canvas.style='position:absolute;';
var gl;

function onload(){

    //get polyfox element
    var element = document.querySelector('.polywolf');
    element.style.position = "relative";
    element.style.width = element.dataset.width;
    element.style.height = element.dataset.height;
    element.style.backgroundColor = "#191919";
    
    //get url
    var url = element.dataset.src;
    ui.innerHTML = `
    <svg height="100%" version="1.1" viewBox="0 0 36 36" ><use class="ytp-svg-shadow" xlink:href="#ytp-id-85"></use><path class="ytp-svg-fill" d="M 12,26 18.5,22 18.5,14 12,10 z M 18.5,22 25,18 25,18 18.5,14 z" id="ytp-id-85" fill="#fff"></path></svg>
    <div>
        <svg height="100%" version="1.1" viewBox="0 0 36 36" ><use class="ytp-svg-shadow" xlink:href="#ytp-id-19"></use><path d="m 23.94,18.78 c .03,-0.25 .05,-0.51 .05,-0.78 0,-0.27 -0.02,-0.52 -0.05,-0.78 l 1.68,-1.32 c .15,-0.12 .19,-0.33 .09,-0.51 l -1.6,-2.76 c -0.09,-0.17 -0.31,-0.24 -0.48,-0.17 l -1.99,.8 c -0.41,-0.32 -0.86,-0.58 -1.35,-0.78 l -0.30,-2.12 c -0.02,-0.19 -0.19,-0.33 -0.39,-0.33 l -3.2,0 c -0.2,0 -0.36,.14 -0.39,.33 l -0.30,2.12 c -0.48,.2 -0.93,.47 -1.35,.78 l -1.99,-0.8 c -0.18,-0.07 -0.39,0 -0.48,.17 l -1.6,2.76 c -0.10,.17 -0.05,.39 .09,.51 l 1.68,1.32 c -0.03,.25 -0.05,.52 -0.05,.78 0,.26 .02,.52 .05,.78 l -1.68,1.32 c -0.15,.12 -0.19,.33 -0.09,.51 l 1.6,2.76 c .09,.17 .31,.24 .48,.17 l 1.99,-0.8 c .41,.32 .86,.58 1.35,.78 l .30,2.12 c .02,.19 .19,.33 .39,.33 l 3.2,0 c .2,0 .36,-0.14 .39,-0.33 l .30,-2.12 c .48,-0.2 .93,-0.47 1.35,-0.78 l 1.99,.8 c .18,.07 .39,0 .48,-0.17 l 1.6,-2.76 c .09,-0.17 .05,-0.39 -0.09,-0.51 l -1.68,-1.32 0,0 z m -5.94,2.01 c -1.54,0 -2.8,-1.25 -2.8,-2.8 0,-1.54 1.25,-2.8 2.8,-2.8 1.54,0 2.8,1.25 2.8,2.8 0,1.54 -1.25,2.8 -2.8,2.8 l 0,0 z" fill="#fff" id="ytp-id-19"></path></svg>
        <svg height="100%" version="1.1" viewBox="0 0 36 36" ><g class="ytp-fullscreen-button-corner-0"><use class="ytp-svg-shadow" xlink:href="#ytp-id-57"></use><path class="ytp-svg-fill" d="m 10,16 2,0 0,-4 4,0 0,-2 L 10,10 l 0,6 0,0 z" id="ytp-id-57" fill="#fff"></path></g><g class="ytp-fullscreen-button-corner-1"><use class="ytp-svg-shadow" xlink:href="#ytp-id-58"></use><path class="ytp-svg-fill" d="m 20,10 0,2 4,0 0,4 2,0 L 26,10 l -6,0 0,0 z" id="ytp-id-58" fill="#fff"></path></g><g class="ytp-fullscreen-button-corner-2"><use class="ytp-svg-shadow" xlink:href="#ytp-id-59"></use><path class="ytp-svg-fill" d="m 24,24 -4,0 0,2 L 26,26 l 0,-6 -2,0 0,4 0,0 z" id="ytp-id-59" fill="#fff"></path></g><g class="ytp-fullscreen-button-corner-3"><use class="ytp-svg-shadow" xlink:href="#ytp-id-60"></use><path class="ytp-svg-fill" d="M 12,20 10,20 10,26 l 6,0 0,-2 -4,0 0,-4 0,0 z" id="ytp-id-60" fill="#fff"></path></g></svg>
    </div>
`;
    //set canvas height and width
    canvas.height = element.dataset.height;
    canvas.width = element.dataset.width;

    //get context
    gl = canvas.getContext('webgl2');
    
    //add elements to view
    element.appendChild(canvas);
    element.appendChild(ui);
    element.appendChild(img);
    p.innerHTML = url.slice(url.lastIndexOf("/")+1, 100);
    element.appendChild(p);

    //load mesh data
    img.onclick = ()=>{
        img.style.visibility = 'hidden';
        ui.style.visibility = 'visible';
        p.style.visibility = 'visible';
        load(gl, url).then((gltf)=>{
            console.log(gltf);
            gltf._render();
        });
    }

}

window.onload = onload();
