import {load} from './gltf_loader.js';
import {shader, program, renderable, render, perspective_camera} from './gl_renderer.js';

//set ui element
var ui = document.createElement('div');
ui.style = 'position:absolute;color:white;';
ui.innerHTML = "";

//create canvas
var canvas = document.createElement('canvas');
canvas.style.position='absolute';
var gl;

function onload(){
    
    //get polyfox element
    var element = document.querySelector('.polyfox');
    element.style.position = 'static';
    element.style.width = element.dataset.width;
    element.style.height = element.dataset.height;
    element.style.backgroundColor = '#141414';
    
    //get url
    var url = element.dataset.url;

    //set canvas height and width
    canvas.height = element.dataset.height;
    canvas.width = element.dataset.width;

    //get context
    gl = canvas.getContext('webgl2');
    
    //add elements to view
    element.appendChild(canvas);
    element.appendChild(ui);

    //load mesh data
    var mesh_data = load(gl, url);

    //create model
    var model = new renderable(gl, mesh_data);

    //render model
    render(gl, model);

}
window.onload = onload();
