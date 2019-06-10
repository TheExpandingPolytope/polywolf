import {load} from './gltf_loader.js';
import {shader, program, renderable, render, perspective_camera} from './gl_renderer.js';

//initialize webgl
const canvas = document.getElementById("gl_canvas"),
gl = canvas.getContext('webgl2');

//load gltf file
var helmet_data = load(gl, 'assets/DamagedHelmet.gltf');

//create shaders
var vertex_shader = shader(gl, gl.VERTEX_SHADER, 'src/shaders/vertex.glsl');
var fragment_shader = shader(gl, gl.FRAGMENT_SHADER, 'src/shaders/fragment.glsl');

//load and compile program
var shader_program = program(gl, [vertex_shader, fragment_shader]);

//create camera
var cam = new perspective_camera(1.14, gl.canvas.width/gl.canvas.height, 0.001, 100);
cam.set_orbit_controls();

//create renderable
var helmet = new renderable(gl, shader_program, helmet_data);

//render
render(gl, cam, helmet);