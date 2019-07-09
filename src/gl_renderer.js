import {download, env_map} from "./gltf_loader.js";
import {uniform_names} from "./config.js";
import {perspective, create, lookAt, rotate, identity, rotateX} from './includes/mat4.js';
import {fromValues, sub, divide, dist} from './includes/vec3.js';

Math.clamp=function(min,val,max){ return Math.min(Math.max(min, val), max)};

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
    set_orbit_controls(gl, max, min, center){
        //initialize control variables
        this.mousedown = false;
        this.temp_mouse_x = 0;
        this.temp_mouse_y = 0;
        this.distance = 7*Math.sqrt((max[0]*max[0])+(max[1]*max[1])+(max[2]*max[2]));
        console.log(this.distance);
        this.angle1 = 0;
        this.angle2 = 0;
        this.gain = 10;
        this.eye = fromValues(this.distance, 0, 0);
        this.target = center;
        console.log("max" + max);
        console.log("min" + min);
        console.log("target" + this.target);
        //compute view matrix
        lookAt(this.view_matrix, this.eye, this.target, this.up );
        

        //set listeners
        gl.canvas.addEventListener('mousedown', (event)=>{
            //set mouse down to true
            this.mousedown = true;
            //record position of mouse
            this.temp_mouse_x = event.clientX;
            this.temp_mouse_y = event.clientY;
            this.temp_angle_1 = this.angle1;
            this.temp_angle_2 = this.angle2;
        });

        gl.canvas.addEventListener('mouseup',(event)=>{
            this.mousedown = false;
        });

        gl.canvas.addEventListener('mousemove', (event)=>{
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
        gl.canvas.addEventListener('wheel', (event) =>{
            event.preventDefault();
            //caltulate mouse scroll
            var delta = dist(this.eye, this.target)*.1;
            if (event.deltaY < 0) {
                this.distance -= delta;
              }
              if (event.deltaY > 0) {
                this.distance += delta;
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

        gl.canvas.addEventListener('contextmenu', (event)=>{
            event.preventDefault();
        });
    }
}

function render(gl, gltf){
    //laod environmental map
    var environment = env_map(gl);

    Promise.all([environment.onload, renderable]).then((object)=>{

    renderable.then(([shader_program, draw_data])=>{
        
        //camera
        //initalize camera
        var camera = new perspective_camera(0.2, gl.canvas.width/gl.canvas.height, 0.001, 10000);
        camera.set_orbit_controls(gl, draw_data.draw_call_object.max, draw_data.draw_call_object.min, draw_data.draw_call_object.center);

        //get environmental map location
        var env_loc = gl.getUniformLocation(shader_program, uniform_names.env_map);

        //get diffuse map location
        var diffuse_loc = gl.getUniformLocation(shader_program, uniform_names.diffuse_map);

        //get prefilter map location
        var prefilter_loc = gl.getUniformLocation(shader_program, uniform_names.prefilter_map);

        //get brdflut map location
        var brdflut_loc = gl.getUniformLocation(shader_program, uniform_names.brdflut_map);

        //get view location
        var view_loc = gl.getUniformLocation(shader_program, uniform_names.view);
        var perspective_loc = gl.getUniformLocation(shader_program, uniform_names.perspective);

        //get model location
        var model_loc = gl.getUniformLocation(shader_program, 'model');
        //set model data
        var model = draw_data.matrix;
        //rotateX(model, model, 1.57);        
        //gl.depthFunc(gl.GREATER);
        //render loop
        function animate(){

            //set viewport size
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

            //set background color
            gl.clearColor(0.1, 0.1, 0.1, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            // turn on depth testing
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.GREATER);
            // tell webgl to cull faces
            gl.enable(gl.CULL_FACE);
            
            //render environmental map
            //environment.render(gl, camera);

            //render renderable
            gl.bindVertexArray(draw_data.vao);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, draw_data.index_buffer);
            gl.useProgram(shader_program);

            //set uniforms
            camera.set_perspective_uniform(gl, perspective_loc);
            camera.set_view_uniform(gl, view_loc);

            //set model uniform
            gl.uniformMatrix4fv(model_loc, gl.FALSE, model);

            //set textures
            var i = 0;
            draw_data.material.forEach((texture)=>{
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, texture.buffer_id);
                gl.uniform1i(texture.program_location, i);
                i++;
            });

            //set diffuse map texture
            environment.set_diffuse_uniform(gl, i, diffuse_loc);

            //set prefilter map texture
            environment.set_prefilter_uniform(gl, ++i, prefilter_loc);

            //set brdflut map texture
            environment.set_brdflut_uniform(gl, ++i, brdflut_loc);

            //draw
            eval(draw_data.draw_call_object.func);
            requestAnimationFrame(animate);
        }

        //run render loop
        animate();
    })
    });
}
