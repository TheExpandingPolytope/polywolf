import {load} from './gltf_loader.js';
import {shader, program, renderable, render, perspective_camera} from './gl_renderer.js';

window.onload = function(){
    //get all polyfox elements
    var polyfox_elements = document.querySelectorAll('div.polyfox');

    //load and render to each canvas
    for (let index = 0; index < polyfox_elements.length; index++) {

        //polyfox element
        var polyfox_element = polyfox_elements[index];

        //get url
        var url = polyfox_element.dataset.url;

        //create canvas
        var canvas = document.createElement('canvas');
        canvas.style = 'position:absolute;';
        canvas.height = polyfox_element.dataset.height;
        canvas.width = polyfox_element.dataset.width; 
        polyfox_element.appendChild(canvas);
        
        //generate gl context
        var gl = polyfox_element.children[0].getContext('webgl2');
        
        //set ui element
        var ui = document.createElement('div');
        ui.style = 'position:absolute;color:white;';
        ui.innerHTML = "Polyfox";
        polyfox_element.appendChild(ui);
        
        
        //initalize camera
        var camera = new perspective_camera(0.2, canvas.width/canvas.height, 0.001, 10000);
        camera.set_orbit_controls(gl);

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
        render(gl, camera, model);
    }
}
