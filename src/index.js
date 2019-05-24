import * as gltf_loader from './gltf_loader.js';
const canvas = document.getElementById("gl_canvas"),
gl = canvas.getContext('webgl');
gltf_loader.download('assets/DamagedHelmet.gltf', "text")
    .then(function(request){
        return JSON.parse(request.responseText);
    })
    .then(function(gltf){
        gltf_loader.process_scene(gl, gltf);
    })
    .catch(function(error){
        console.log(error);
    });
