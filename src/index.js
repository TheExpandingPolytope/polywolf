import {load} from './gltf_loader.js';
import {shader, program, renderable, render, perspective_camera} from './gl_renderer.js';

//initialize webgl
const canvas = document.getElementById("gl_canvas"),
gl = canvas.getContext('webgl2');

//load gltf file
var triangle_data = load(gl, 'assets/DamagedHelmet.gltf');

//create shaders
var vertex_shader = shader(gl, gl.VERTEX_SHADER, 'src/shaders/vertex.glsl');
var fragment_shader = shader(gl, gl.FRAGMENT_SHADER, 'src/shaders/fragment.glsl');

//load and compile program
var shader_program = program(gl, [vertex_shader, fragment_shader]);

//create camera
var cam = new perspective_camera(2.14, 1, 1, 100);

//create renderable
var triangle = new renderable(shader_program, triangle_data);

//render
render(gl, triangle, cam);