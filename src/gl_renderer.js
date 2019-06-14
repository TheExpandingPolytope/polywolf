import {download, env_map} from "./gltf_loader.js";
import {uniform_names} from "./config.js";
import {perspective, create, lookAt} from './includes/mat4.js';
import {fromValues} from './includes/vec3.js';

Math.clamp=function(min,val,max){ return Math.min(Math.max(min, val), max)};

class draw_data {
    constructor(vao, index_buffer, draw_call_object, matrix, material){
        this.vao = vao;
        this.index_buffer = index_buffer;
        this.draw_call_object = draw_call_object;
        this.matrix = matrix;
        this.material = material;
    }
}

class renderable {
    constructor(gl, shader_program, draw_data){
        return Promise.all([
            shader_program,
            draw_data,
        ]).then(([shader_program, draw_data])=>{
            //set material program locations
            draw_data.material.forEach((texture)=>{
                texture.program_location = gl.getUniformLocation(shader_program, texture.name);
            });
            return [shader_program, draw_data];
        });
    }
}

class scene {
    constructor(renderables){
        this.renderables = renderables;
    }
}

class perspective_camera {
    constructor(fovy, aspect, near, far){
        //set perspective matrix
        this.perspective_matrix = create();
        perspective(this.perspective_matrix, fovy, aspect, near, far);
        //set eye
        this.eye = fromValues(0, 0, 1);
        //set target
        this.target = fromValues(0, 0, 0);
        //set up vector
        this.up = fromValues(0, 1, 0);
        //set view matrix
        this.view_matrix = create();
        lookAt(this.view_matrix, this.eye, this.target, this.up );
    }
    set_perspective_uniform(gl, location){
        gl.uniformMatrix4fv(location, false, this.perspective_matrix);
    }
    set_view_uniform(gl, location){
        gl.uniformMatrix4fv(location, false, this.view_matrix);
    }
    set_orbit_controls(){
        //initialize control variables
        this.mousedown = false;
        this.temp_mouse_x = 0;
        this.temp_mouse_y = 0;
        this.distance = 1;
        this.angle1 = 0;
        this.angle2 = 0;
        this.gain = 10;
        //set listeners
        document.addEventListener('mousedown', (event)=>{
            //set mouse down to true
            this.mousedown = true;
            //record position of mouse
            this.temp_mouse_x = event.clientX;
            this.temp_mouse_y = event.clientY;
            this.temp_angle_1 = this.angle1;
            this.temp_angle_2 = this.angle2;
        });

        document.addEventListener('mouseup',(event)=>{
            this.mousedown = false;
        });

        document.addEventListener('mousemove', (event)=>{
            if(this.mousedown){
                //set mouse coordinates
                var mouse_x = event.clientX,
                mouse_y = event.clientY;
                //set angles
                var dx = this.gain * (mouse_x - this.temp_mouse_x)/window.innerWidth,
                dy = this.gain * (mouse_y - this.temp_mouse_y)/window.innerHeight;
                this.angle1 = this.temp_angle_1 + dx;
                this.angle2 = Math.clamp( -Math.PI/2,this.temp_angle_2 + dy, Math.PI/2);
                //compute eye
                var t = this.distance * Math.cos(this.angle2),
                y = this.distance * Math.sin(this.angle2) + this.target[1],
                x = t * Math.cos(this.angle1) + this.target[0],
                z = t * Math.sin(this.angle1) + this.target[2];
                this.eye = fromValues(x, y, z);
                //compute view matrix
                lookAt(this.view_matrix, this.eye, this.target, this.up );
            }
        });
        document.addEventListener('wheel', (event) =>{
            if (event.deltaY < 0) {
                this.distance -= .1;
              }
              if (event.deltaY > 0) {
                this.distance +=.1;
              }
              //compute eye
              var t = this.distance * Math.cos(this.angle2),
              y = this.distance * Math.sin(this.angle2) + this.target[1],
              x = t * Math.cos(this.angle1) + this.target[0],
              z = t * Math.sin(this.angle1) + this.target[2];
              this.eye = fromValues(x, y, z);
              //compute view matrix
              lookAt(this.view_matrix, this.eye, this.target, this.up );
        });

        document.addEventListener('contextmenu', (event)=>{
            event.preventDefault();
        });
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

function render(gl, camera, renderable){
    //laod environmental map
    var environment = env_map(gl);

    Promise.all([environment.onload, renderable]).then((object)=>{

    renderable.then(([shader_program, draw_data])=>{

        //get environmental map location
        var env_loc = gl.getUniformLocation(shader_program, uniform_names.env_map);

        //get diffuse map location
        var diffuse_loc = gl.getUniformLocation(shader_program, uniform_names.diffuse_map);

        //get view location
        var view_loc = gl.getUniformLocation(shader_program, uniform_names.view);
        var perspective_loc = gl.getUniformLocation(shader_program, uniform_names.perspective);
        
        //render loop
        function animate(){

            //resize canvas
            gl.canvas.width = gl.canvas.clientWidth;
            gl.canvas.height = gl.canvas.clientHeight;

            //set viewport size
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            //set background color
            gl.clearColor(.5,.5, .5, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // turn on depth testing
            gl.enable(gl.DEPTH_TEST);
            // tell webgl to cull faces
            gl.enable(gl.CULL_FACE);
            
            //render environmental map
            environment.render(gl, camera);
            //render renderable
            gl.bindVertexArray(draw_data.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draw_data.index_buffer);
            gl.useProgram(shader_program);

            //set uniforms
            camera.set_perspective_uniform(gl, perspective_loc);
            camera.set_view_uniform(gl, view_loc);

            //set textures
            var i = 0;
            draw_data.material.forEach((texture)=>{
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, texture.buffer_id);
                gl.uniform1i(texture.program_location, i);
                i++;
            });
            //set env map texture
            environment.set_texture_uniform(gl, i, env_loc);

            //set diffuse map texture
            environment.set_diffuse_uniform(gl, ++i, diffuse_loc);

            //draw
            eval(draw_data.draw_call_object.func);
            requestAnimationFrame(animate);
        }

        //run render loop
        animate();
    })
    });
}

export {scene, shader, program, draw_data, render, renderable, perspective_camera};