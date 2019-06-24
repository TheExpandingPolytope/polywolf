import {load} from './gltf_loader.js';
import {shader, program, renderable, render, perspective_camera} from './gl_renderer.js';
var gl;

function onload(){
    //get all polyfox elements
    var polyfox_element = document.querySelectorAll('div.polyfox')[0];
    
    //load and render to each canvas



        //get url
        var url = polyfox_element.dataset.url;

        //create canvas
        var canvas = document.createElement('canvas');
        canvas.style = 'position:absolute;';
        canvas.height = polyfox_element.dataset.height;
        canvas.width = polyfox_element.dataset.width; 
        polyfox_element.appendChild(canvas);
        canvas.addEventListener("webglcontextlost", function(event) {
            event.preventDefault();
            polyfox_element.innerHTML = "";
            onload();
        }, false);

        //generate gl context
        gl = polyfox_element.children[0].getContext('webgl2');
        
        //set ui element
        var ui = document.createElement('div');
        ui.style = 'position:absolute;color:white;';
        ui.innerHTML = "Polyfox <span style='font-size:10px;'>click and drag to move camera</span>";
        polyfox_element.appendChild(ui);

        

        //load mesh data
        var mesh_data = load(gl, url);

        //load and compile shaders
        var shader_program = program(gl, [
            shader(gl, gl.VERTEX_SHADER, 'src/shaders/vertex.glsl'),
            shader(gl, gl.FRAGMENT_SHADER, 'src/shaders/fragment.glsl')
        ]);

        //create model
        var model = new renderable(gl, shader_program, mesh_data);

        //render model
        render(gl, model);


}
window.onload = onload();
