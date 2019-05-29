import {download} from "./gltf_loader.js";

class draw_data {
    constructor(vao, index_buffer, draw_call_object, matrix){
        this.vao = vao;
        this.index_buffer = index_buffer;
        this.draw_call_object = draw_call_object;
        this.matrix = matrix;
    }
}

class renderable {
    constructor(shader_program, draw_data){
          return Promise.all([
            shader_program,
            draw_data,
        ]);
    }
}

function shader(gl, type, shader_path) {
    return download(shader_path, "text")
    .then(function(source){
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source.responseText);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
        else{
            console.log(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
        }
    });
}

function program(gl, shader_promises) {
    return Promise.all(shader_promises)
    .then(function(shaders){
        //create program
        var program = gl.createProgram();
        for(var i = 0; i < shaders.length; i++){
            gl.attachShader(program, shaders[i]);
        }
        gl.linkProgram(program);
        if(gl.getProgramParameter(program, gl.LINK_STATUS)){
            return program;
        }
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    });
}
function render(gl, renderable){
    renderable.then(([shader_program, draw_data])=>{
                        
        function animate(){
            //resize canvas
            gl.canvas.width = gl.canvas.clientWidth;
            gl.canvas.height = gl.canvas.clientHeight;
            //set viewport size
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            //set background color
            gl.clearColor(1, 1, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            //render renderable
            gl.bindVertexArray(draw_data.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draw_data.index_buffer);
            gl.useProgram(shader_program);
            eval(draw_data.draw_call_object.func);
            requestAnimationFrame(animate);
        }
        animate();
    })
}

export {shader, program, draw_data, render, renderable};