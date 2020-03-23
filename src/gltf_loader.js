import {mat4, vec4, vec3, quat, glMatrix} from './includes/index.js';
import {layout, uniform_names, type, anim_lengths} from './config.js';
import { toRadian } from './includes/common.js';
 
var HDRImage  = require('./includes/hdrpng.js');
 
var url = "";
var path = "";

import nx from './env_map/nx.jpg'; 
import ny from './env_map/ny.jpg';
import px from './env_map/px.jpg';
import py from './env_map/py.jpg';  
import pz from './env_map/pz.jpg';
import nz from './env_map/nz.jpg';

console.log(nx);

var vertex_shader_src_default = `
layout( location = 0 ) in vec3 position;

uniform mat4 perspective;
uniform mat4 view;
uniform mat4 model;

void main(){
    gl_Position = perspective*view*model*vec4(position, 1.0);
}
`;
var fragment_shader_src_default = `
    precision mediump float;
    out vec4 color;
    void main(){
        color = vec4(1.0, 0.0, 0.0, 1.0);
    }
`;

var vertex_shader_src = `
layout( location = 0 ) in vec3 position;
layout( location = 1 ) in vec3 normal;
layout( location = 2 ) in vec2 texcoords;

uniform mat4 perspective;
uniform mat4 view;
uniform mat4 model;

out vec3 v_position;
out vec3 v_normal;
out vec2 v_texcoords;

void main(){
    gl_Position = perspective*view*model*vec4(position, 1.0);
    v_position = (view*model*vec4(position, 1.0)).xyz;
    v_normal = mat3(transpose(inverse(view*model))) * normal;
    v_texcoords = texcoords;
}
`;


var fragment_shader_src = `
#define NUM_LIGHTS 1
precision mediump float;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_texcoords;

uniform sampler2D emissiveTexture;
vec3 emissive;

uniform sampler2D normalTexture;

vec3 normal;

uniform sampler2D occlusionTexture;
float occlusion;

uniform sampler2D baseColorTexture;
vec4 base_color;

uniform sampler2D metallicRoughnessTexture;
float roughness;
float metallic;

uniform samplerCube env_map;
uniform samplerCube diffuse_map;
uniform samplerCube prefilter_map;
uniform sampler2D brdflut_map;

//light variables
vec3 light_positions[1];
vec3 light_colors[1];

const float PI = 3.14159265359;

//set lights functions
void set_lights(){
  light_positions[0] = vec3(5);
  light_colors[0] = vec3(10);
}

//length function 
/*float length(vec3 operand){
  return sqrt((operand.x*operand.x)+(operand.y*operand.y)+(operand.z*operand.z));
}*/
out vec4 color;

//pbr functions
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}  

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}  

float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a      = roughness*roughness;
    float a2     = a*a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;
	
    float num   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
	
    return num / denom;
}

float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float num   = NdotV;
    float denom = NdotV * (1.0 - k) + k;
	
    return num / denom;
}
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2  = GeometrySchlickGGX(NdotV, roughness);
    float ggx1  = GeometrySchlickGGX(NdotL, roughness);
	
    return ggx1 * ggx2;
}

vec3 getNormal(){
  vec3 pos_dx = dFdx(v_position);
  vec3 pos_dy = dFdy(v_position);
  vec3 tex_dx = dFdx(vec3(v_texcoords, 0.0));
  vec3 tex_dy = dFdy(vec3(v_texcoords, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

  vec3 ng = v_normal;

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);

  #ifdef NORMALTEXTURE
  vec3 n = texture(normalTexture, v_texcoords).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(1, 1, 1.0)));
  #else
vec3 n = tbn[2].xyz;
#endif

  return n;
}
 
void main() {
  //set lights
  set_lights();

  //set material info
  #ifdef BASECOLORTEXTURE
  base_color = texture(baseColorTexture, v_texcoords);
  #endif

  normal = getNormal();

  #ifdef METALLICROUGHNESSTEXTURE
  metallic = texture(metallicRoughnessTexture, v_texcoords).b;
  roughness = texture(metallicRoughnessTexture, v_texcoords).g;
  #endif

  #ifdef OCCLUSIONTEXTURE
  occlusion = texture(occlusionTexture, v_texcoords).r;
  #endif

  #ifdef EMISSIVETEXTURE
  emissive = texture(emissiveTexture, v_texcoords).rgb;
  #endif

  //set geometry info
  vec3 n = normalize(normal);
  vec3 v = normalize(-v_position);
  vec3 R = -normalize(reflect(v, n));   


  //calculate surface reflectivity for fresnel schlick
  vec3 f0 = vec3(0.04);
  f0 = mix(f0, base_color.rgb, metallic);

  //init radiance
  vec3 Lo = vec3(0.0);
  for(int i = 0; i < NUM_LIGHTS; ++i){

    //calculate light vector
    vec3 l = normalize(light_positions[i] - v_position);

    //calculate halfway vector
    vec3 h = normalize(l+v);

    float distance    = length(light_positions[i] - v_position);
    float attenuation = 1.0 / (distance * distance);
    vec3 radiance     = light_colors[i] * attenuation;        
    
    // cook-torrance brdf
    float NDF = DistributionGGX(n, h, roughness);        
    float G   = GeometrySmith(n, v, l, roughness);      
    vec3 F    = fresnelSchlickRoughness(max(dot(n, v), 0.0), f0, roughness);;       
    
      
    
    //calculate specular component
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(n, v), 0.0) * max(dot(n, l), 0.0) + 0.001;
    vec3 specular     = numerator / denominator;  
    
    //calulate diffuse
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;	

    // integrate to outgoing radiance Lo
    float NdotL = max(dot(n, l), 0.0);                
    Lo += (kD * base_color.rgb / PI + specular) * radiance * NdotL;
  }

  vec3 F = fresnelSchlickRoughness(max(dot(n, v), 0.0), f0, roughness);

  //diffuse ibl
  vec3 kS = F;
  vec3 kD = vec3(1.0) - kS;
  kD *= 1.0 - metallic;	  
  vec3 irradiance = texture(diffuse_map, n).rgb;
  vec3 diffuse    = irradiance * base_color.rgb;

  //calculate speculare ibl
  const float MAX_REFLECTION_LOD = 40.0;
  vec3 prefilteredColor = texture(prefilter_map, R,  roughness).rgb;   
  vec2 envBRDF  = texture(brdflut_map, vec2(max(dot(n, v), 0.0), roughness)).rg;
  vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
  vec3 ambient    = (kD * diffuse + (specular)) ; 
  
  vec3 c = ambient + Lo;

  #ifdef OCCLUSIONTEXTURE
  c *= occlusion;
  #endif

  #ifdef EMISSIVETEXTURE
  c+=emissive;
  #endif

  //c = c / (c + vec3(1.0));
  c = pow(c, vec3(1.0/1.8));

  //set color 
  color = vec4(c, 1);

}
`;

Math.clamp=function(min,val,max){ return Math.min(Math.max(min, val), max)};

class perspective_camera {
    constructor(fovy, aspect, near, far){
        //set perspective parameters
        this.fovy = fovy;
        this.aspect = aspect;
        this.near = near;
        this.far = far;

        //set perspective matrix
        this.perspective_matrix = mat4.create();
        mat4.perspective(this.perspective_matrix, this.fovy, this.aspect, this.near, this.far);

        //set eye
        this.eye =vec3.fromValues(0, 0, 1);
        //set target
        this.target =vec3.fromValues(0, 0, 0);
        //set up vector
        this.up =vec3.fromValues(0, 1, 0);
        //set view matrix
        this.view_matrix = mat4.create();
        mat4.lookAt(this.view_matrix, this.eye, this.target, this.up );
    }
    set_perspective_uniform(gl, location){
        gl.uniformMatrix4fv(location, false, this.perspective_matrix);
    }
    set_view_uniform(gl, location){
        gl.uniformMatrix4fv(location, false, this.view_matrix);
    }
    set_orbit_controls(gl, max, min){
        //initialize control variables
        this.mousedown = false;
        this.temp_mouse_x = 0;
        this.temp_mouse_y = 0;
        this.distance = 14*Math.sqrt((max[0]*max[0])+(max[1]*max[1])+(max[2]*max[2]));
        console.log(this.distance);

        //set camera far to twice the distance
        mat4.perspective(this.perspective_matrix, this.fovy, this.aspect, this.near, this.distance*10);
        this.angle1 = 0;
        this.angle2 = 0;
        this.gain = 10;
        this.eye =vec3.fromValues(this.distance, 0, 0);
        this.target = vec3.fromValues((max[0]+min[0])/2,(max[1]+min[1])/2,(max[2]+min[2])/2);
        //this.eye = vec3.fromValues(1, 0, 0);
        //this.target = vec3.fromValues(0, 0, 0);

        //compute view matrix
        mat4.lookAt(this.view_matrix, this.eye, this.target, this.up );
        

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
                this.eye =vec3.fromValues(x, y, z);
                //compute view matrix
                mat4.lookAt(this.view_matrix, this.eye, this.target, this.up );
            }
        });
        gl.canvas.addEventListener('wheel', (event) =>{
            event.preventDefault();
            //caltulate mouse scroll
            var delta = vec3.dist(this.eye, this.target)*.1;
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
              this.eye =vec3.fromValues(x, y, z);
              //compute view matrix
              mat4.lookAt(this.view_matrix, this.eye, this.target, this.up );
        });

        gl.canvas.addEventListener('contextmenu', (event)=>{
            event.preventDefault();
        });
    }
}


function load(gl, filepath){
    url = "";
    path = "";
    return download(filepath, "text")
    .then(function(request){
        url = request.responseURL;
        path = url.slice(0, url.lastIndexOf("/")+1);
        return JSON.parse(request.responseText);
    })
    .then(function(gltf){
        return process_scene(gl, gltf);
    });
}

function download(filepath, response_type)
{
    //check if 
    if(filepath.search("data:") == -1){
        filepath = path+filepath;
    }

    var xhr = new XMLHttpRequest();  
    return new Promise(function(resolve,reject){
        xhr.onreadystatechange = ()=>{
            if(xhr.readyState !== 4) return false;
            if(xhr.readyState==4 && xhr.status==200){
                resolve(xhr);
            }else{
                reject({
                    status:xhr.status,
                    statusText:xhr.statusText,
                });
            }
        }
        xhr.open('GET',filepath);
        if(response_type) xhr.responseType = response_type;
        xhr.send();
    });
}

function download_image(filepath)
{
    //check if 
    if(filepath.search("data:") == -1){
        filepath = path+filepath;
    }

    return new Promise((resolve, reject) => {
        //set image
        let image = new Image();

        //resolve image on load
        image.onload = function(){
            resolve(image);
        }

        //reject image on error
        image.onerror =  function() {
          reject(new Error(`Failed to load image's URL: ${filepath}`));
        };

        //load image
        image.src = filepath;
    });
}


function timestamp() {
    return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
}

function process_scene(gl, gltf, scene_number)
{
    //set camera controls parameters
    gltf._max = vec3.fromValues(0, 0, 0);
    gltf._min = vec3.fromValues(0, 0, 0);

    //set all loads array
    gltf._loads = [];

    //set renders array
    gltf._renders = [];

    //set animations array
    gltf._animations = [];
    
    //set scene number
    if(scene_number==undefined) 
        scene_number=0;

    //set nodes
    var nodes = gltf.scenes[scene_number].nodes;

    //check to see if there are any nodes in the scene
    if(nodes.length==0) 
        return false;

    //create default fallback material
    set_default_material(gl, gltf);

    //process nodes 
    for(var i=0; i < nodes.length; i++)
        process_node(gl,gltf,nodes[i]);

    //process animations
    if(gltf.animations)
        for(var i=0; i < gltf.animations.length; i++)
            process_animation(gl, gltf, gltf.animations[i]);


    //load environment
    env_map(gl, gltf);

    //set camera
    gltf._camera = new perspective_camera(0.2, gl.canvas.width/gl.canvas.height, 0.1, 100);

    //set animation function
    gltf._animate =  gltf.animations && gltf._animations ? function(time){
        //by default use the first animation
        gltf._animations[0](time);
    } : ()=>{};
    var now, dt, last = timestamp()/1000;

    //set render function
    gltf._render = function(){
        //animate
        now = timestamp()/1000; 
        dt = (last - now);
        //console.log(dt);
        gltf._animate( dt );

        //render
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gltf._renders.forEach((func)=>{
            func();
        });

        //set last time
        last = now;

        //loop
        requestAnimationFrame(gltf._render);
    }

    //return promise once everything is loaded
    return Promise.all(gltf._loads).then(()=>{

        //set orbital controls 
        gltf._camera.set_orbit_controls(gl, gltf._max, gltf._min);

        //return/ resolve gltf object
        return gltf;
    });
    
}


//load accessor data
function process_anim_accessor(gl, gltf, accessor_num, sampler, is_input, animation){
    //set accessor
    var accessor = gltf.accessors[accessor_num];

    //process accessor, bufferView, and buffer ( load buffer data )
    //set buffer view
    var bufferView = gltf.bufferViews[accessor.bufferView];
    
    //set buffer
    var buffer = gltf.buffers[bufferView.buffer];

    //load buffer data if not set
    if(!buffer._onload){
        //set onload to a promise
        buffer._onload = download(buffer.uri, 'arraybuffer');
        //add to all loads
        gltf._loads.push(buffer._onload);
    }
    
    //set data
    buffer._onload.then((data)=>
    {
        //set array buffer positions
        var byte_offset = bufferView.byteOffset;
        var length = bufferView.byteLength;
        if(accessor.byteOffset) 
        {
            byte_offset += accessor.byteOffset;
            length -= accessor.byteOffset;
        }


        //load data to array
        console.log(length);
        var value = new Float32Array(data.response, byte_offset,accessor.count*type[accessor.type]);
        console.log(value);
        if(is_input){
            sampler._inputs = value;
            //find greatest and smallest input value
            sampler._max_input = -100000;
            sampler._min_input = 100000;
            sampler._inputs.forEach((input)=>{
                if(input > sampler._max_input){
                    sampler._max_input = input;
                }
                if(input <sampler._min_input){
                    sampler._min_input = input;
                }
            });
            //set global animation min and max times
            if(sampler._min_input < animation._min_time){
                animation._min_time = sampler._min_input;
            }
            if(sampler._max_input > animation._max_time){
                animation._max_time = sampler._max_input;
            }

        }
        else
            sampler._outputs = value;
    });
}

//update node matrix model and its children
function update_node_model(gltf, node, parent) 
{
    set_node_matrix(node, parent);
    if(node.children)
        for(var i = 0; i < node.children.length; i++)
            update_node_model(gltf,gltf.nodes[node.children[i]], node);
}

function process_anim_sampler(gl, gltf, sampler, animation)
{
    console.log("processing sampler");
    //set input data
    process_anim_accessor(gl, gltf, sampler.input, sampler, true, animation);

    //set output data
    process_anim_accessor(gl, gltf, sampler.output, sampler, false, animation);
}

//append an animation function to root
function process_animation(gl, gltf, animation) 
{
    //define our animation name if not defined
    animation.name = animation.name ? animation.name : "unnamed_anim";

    //set our min and max times
    animation._min_time = 100000;
    animation._max_time = -100000;
    //process samplers
    if(animation.samplers)
        for(var i = 0; i < animation.samplers.length; i++)
            process_anim_sampler(gl, gltf, animation.samplers[i],animation);

    //
    var time = 0;
    //create animation function
    animation._animate = function( t ) {

        time = time + Math.abs(t);
        if( time > animation._max_time)
            time = animation._min_time;

        animation.channels.forEach( (channel) =>{

            var node = gltf.nodes[channel.target.node];
            var path = node[channel.target.path];
            var sampler = animation.samplers[channel.sampler];
            
            
            
            if(time < sampler._min_input || time > sampler._max_input)
                return;

            var closest_distance_less = 100000;
            var closest_distance_great = 100000;
            var t1=0 ,t2=0;
            var between = [undefined, undefined];
            if(sampler._inputs)
            sampler._inputs.forEach( (input, index) =>{
                var current_distance =  time - input;
                    
                if( current_distance > 0){
                    if(Math.abs(current_distance)< closest_distance_less){
                        t1 = input;
                        between[0] = index;
                        closest_distance_less = Math.abs(current_distance);
                    }
                    //then less than
                    
                }else{
                    //greater than
                    if(Math.abs(current_distance)< closest_distance_great){
                        t2 = input;
                        between[1] = index;
                        closest_distance_great = Math.abs(current_distance);
                    }
                    
                }
            });

            //set interpolated value
            //if(between[0] == undefined || between[1] == undefined)
              //  return;
            //console.log(between);
            //console.log(  channel.target.path + ":" + t1 + " " + time + " " + t2 );
            var dt = t2-t1;
            var dt2 = time - t1;
            var dproportion = dt2/dt;

            var val = [];
            var val1 = [];
            var val2 = [];
            var dvar;
            for(var i=0; i < anim_lengths[channel.target.path]; i++){
                val1.push(sampler._outputs[(between[0]*anim_lengths[channel.target.path])+i]);
                val2.push(sampler._outputs[(between[1]*anim_lengths[channel.target.path])+i]);
                dvar = val2[i]-val1[i];
                val.push(val1[i]+dproportion*dvar);
            }
            node[channel.target.path] = val;
            //console.log(node._model);
            //update model
            console.log(  channel.target.path + ":" + val);
            update_node_model(gltf, node);

        });

    }
    gltf._animations.push(animation._animate);

}

//set final node matrix
//global transform matrix
function set_node_matrix(node, parent)
{
    //set model matrix data
    var m_matrix = mat4.create();
    mat4.identity(m_matrix);

    //if have matrix
    if(node.matrix){
        m_matrix = mat4.clone(node.matrix);
    }
    else{
        //set translation of matrix
        if(!node.translation) {
            node.translation = vec3.fromValues(0,0,0);
        };

        //set rotation of matrix
        if(!node.rotation){
            node.rotation = quat.create();
            quat.identity(node.rotation);
        }

        //set scale of matrix
        if(!node.scale){
            node.scale = vec3.create();
            node.scale = vec3.fromValues(1,1,1);
        }

        //set matrix from rotation translation and scale
        var temp_quat = quat.create();
        quat.normalize(temp_quat, quat.fromValues(...node.rotation));
        mat4.fromRotationTranslation(m_matrix, temp_quat, node.translation)
        mat4.scale(m_matrix, m_matrix, node.scale);
    }

    //set node model
    node._model = ( parent != undefined ) ? mat4.multiply(mat4.create(), parent._model, m_matrix) : m_matrix;
}


//process node, set matrix
function process_node(gl, gltf, node_num, parent_num)
{
    //set node
    var node = gltf.nodes[node_num];

    //set parent
    var parent = ( parent_num != undefined ) ?  gltf.nodes[parent_num] : undefined;
    
    //set model matrix
    set_node_matrix(node, parent);

    //process skin if have
    //PROCESS SKIN FIRST TO ADD SKINNING DATA TO NODE'S MESH MATERIAL
    if(node.skin >= 0)
        process_skin(gl, gltf, node.skin, node);

    //process mesh if have
    if(node.mesh >= 0)
        process_mesh(gl, gltf, node.mesh, node);

    
    //process children nodes
    if(node.children)
        for(var i = 0; i < node.children.length; i++)
            process_node(gl, gltf, node.children[i], node_num);

}

//append _inverseBindMatrices, an array of 
function process_skin_accessor(gl, gltf, accessor_num, skin)
{
    //set accessor
    var accessor = gltf.accessors[accessor_num];

    //process accessor, bufferView, and buffer ( load buffer data )
    //set buffer view
    var bufferView = gltf.bufferViews[accessor.bufferView];
    
    //set buffer
    var buffer = gltf.buffers[bufferView.buffer];

    //load buffer data if not set
    if(!buffer._onload){
        //set onload to a promise
        buffer._onload = download(buffer.uri, 'arraybuffer');
        //add to all loads
        gltf._loads.push(buffer._onload);
    }
    //init inverseBindMatrices
    skin._inverseBindMatrices = [];

    //init globalJointTransforms
    skin._globalJointTransforms = [];

    //init JointMatrices
    skin._jointMatrices = [];

    //set data
    buffer._onload.then((data)=>{
        //set array buffer positions
        var byte_offset = bufferView.byteOffset;
        var length = bufferView.byteLength;
        if(accessor.byteOffset) 
        {
            byte_offset += accessor.byteOffset;
            length -= accessor.byteOffset;
        }

        //load data to array
        var value = new Float32Array(data.response, byte_offset,accessor.count*type[accessor.type]);
        
        //set inverse bind matrices
        //and add them to their corresponding joints
        for (let index = 0; index < value.length; index += 16) {
            //get current joint
            var joint_num = skin.joints[index];
            var joint = gltf.nodes[joint_num];

            //set inverse bind matrix
            joint._inverseBindMatrix = array.slice(index, index + 16);

            //set globalJoint Transform matrix
            joint._globalJointTransform = joint._model;

            //set and init jointMatrix
            joint._jointMatrix = new Float32Array(16);

            //push matrices to skin
            skin._inverseBindMatrices.push(joint._inverseBindMatrix);
            skin._globalJointTransforms.push(joint._globalJointTransform);
            skin._jointMatrices.push(joint._jointMatrix);

            //add our update jointBindPose function
            joint._updateJointBindPose = function(){
                mat4.multiply(joint._jointMatrix, joint._globalJointTransform, joint._inverseBindMatrix);
            }

            //update jointbindpose ASSUME THAT GLOBALJOINTTRANSFORM HAS BEEN UPDATED
            joint._updateJointBindPose();
        }
    });
}

//process skin, create skin update function
//for computing joint matrix if translation/rotation/scale/model has changed
function process_skin(gl, gltf, skin_num, node)
{
    var skin = gltf.skins[skin_num];


    //process inverseBindMatrices and append an array of 4x4 matrices
    //also adds inverseBindMatrices to corresponding nodes
    //appends compute jointBindPose to each node as well
    if(skin.inverseBindMatrices >= 0)
        process_skin_accessor(gl, gltf, skin.inverseBindMatrices, skin)

    //add jointMatrices to our material for shader compilation

}

//process mesh, set primitive vao's
function process_mesh(gl, gltf, mesh_num, node)
{
    //initialize variables
    var mesh = gltf.meshes[mesh_num];

    //process primitives in mesh
    if(mesh.primitives)
    for(var i = 0; i < mesh.primitives.length; i++){

        //prepare primitive rendering function constants
        var accessor, material;

        //set primitives
        var primitive = mesh.primitives[i];

        //create vao
        primitive._vao = gl.createVertexArray();
        gl.bindVertexArray(primitive._vao);
        
        //process attributes in primitive
        if(primitive.attributes)
            for(const key in primitive.attributes) 
                process_accessor(gl, gltf, primitive.attributes[key], key, primitive._vao, node); 


        //process indices
        if(primitive.indices >= 0){
            process_accessor(gl, gltf, primitive.indices,undefined, primitive._vao);
            accessor = gltf.accessors[primitive.indices];
        }
        else
            //no index buffer
            console.log("This mesh does not have an index buffer");

        gl.bindVertexArray(null);

        //process material
        if(primitive.material >= 0){
            process_material(gl, gltf, primitive.material);
            material = gltf.materials[primitive.material]
        }
        else
            //set primitive.material to default
            material = gltf._default_material;
        
                
        //set primitive rendering function 
        primitive._render = function(){
            
            //
            //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            //bind vao
            gl.bindVertexArray(primitive._vao);

            //bind element array buffer
            //gl.bindBuffer(bufferView.target, accessor._buffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, accessor._buffer);

            //use shader
            gl.useProgram(material._shader_program);

            //set uniforms
            var perspective_loc = gl.getUniformLocation(material._shader_program, "perspective");
            var view_loc = gl.getUniformLocation(material._shader_program, "view");
            gl.uniformMatrix4fv(perspective_loc, gl.FALSE, gltf._camera.perspective_matrix);
            gl.uniformMatrix4fv(view_loc, gl.FALSE, gltf._camera.view_matrix);

            var model_loc = gl.getUniformLocation(material._shader_program, 'model');

            //set model uniform
            gl.uniformMatrix4fv(model_loc, gl.FALSE, node._model);
            
            //set jointTransform uniforms
            //primitive._jointMatrices.forEach( (jointMatrix, index)=>{
              //  gl.uniformMatrix4fv(gl.getUniformLocation(material._shader_program, 'jointTransform['+index+']'), false, jointMatrix);
            //});
            //load material
            var index = 0;

            //Do not load textures or environment map if the material is the default one
            if(!material._is_defualt){
                material._textures.forEach((element)=>{
                    var uniform_loc = material._uniform_locs[element.name];
                    //add texture
                    var texture = gltf.textures[element.index];
                    gl.activeTexture(gl.TEXTURE0 + index);
                    gl.bindTexture(gl.TEXTURE_2D, texture._buffer);
                    gl.uniform1i(uniform_loc, index);
                    index++;
                });
    
                var diffuse_loc = gl.getUniformLocation(material._shader_program, "diffuse_map");
                var prefilter_loc = gl.getUniformLocation(material._shader_program, "prefilter_map");
                var brdflut_loc = gl.getUniformLocation(material._shader_program, "brdflut_map");
    
                //set environment uniforms
                gltf._environment.set_diffuse_uniform(gl, index, diffuse_loc);
                gltf._environment.set_prefilter_uniform(gl, ++index, prefilter_loc);
                gltf._environment.set_brdflut_uniform(gl, ++index, brdflut_loc);
            }
            
            

            //draw
            //gl.drawElements(primitive.mode, accessor.count, accessor.componentType, 0);
            gl.drawElements(gl.TRIANGLES, accessor.count, accessor.componentType, 0);

        }

        gltf._renders.push(primitive._render);

    }
    
}

//processes accessors and buffer data
function process_accessor(gl, gltf, accessor_num, key, vao, node){ 
    //set accessor
    var accessor = gltf.accessors[accessor_num];

    //create buffer
    accessor._buffer = gl.createBuffer();


    //process accessor, bufferView, and buffer ( load buffer data )
    //set buffer view
    var bufferView = gltf.bufferViews[accessor.bufferView];
    
    //set buffer
    var buffer = gltf.buffers[bufferView.buffer];

    //load buffer data if not set
    if(!buffer._onload){
        //set onload to a promise
        buffer._onload = download(buffer.uri, 'arraybuffer');

        //add to all loads
        gltf._loads.push(buffer._onload);
    }

    //set buffer data
    buffer._onload.then((data)=>
    {
        //set array buffer positions
        var byte_offset = bufferView.byteOffset;
        var length = bufferView.byteLength;
        if(accessor.byteOffset) 
        {
            byte_offset += accessor.byteOffset;
            length -= accessor.byteOffset;
        }
        
        //bind vao
        gl.bindVertexArray(vao);

        if(key != undefined)
        { 
            //load data to array
            var array = new Float32Array(data.response, byte_offset,length/Float32Array.BYTES_PER_ELEMENT);
            
            //set buffer data
            /*gl.bindBuffer(bufferView.target, accessor._buffer);
            gl.bufferData(bufferView.target, array, gl.STATIC_DRAW);*/
            gl.bindBuffer(gl.ARRAY_BUFFER, accessor._buffer);
            gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

            //set vertex attrib pointer
            gl.enableVertexAttribArray(layout[key]);
            gl.vertexAttribPointer(layout[key], type[accessor.type], accessor.componentType, false, 0, 0);

            //gl.bindBuffer(bufferView.target, null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            //if accessor is position, set min and maximum value
            if(key == "POSITION" && node._model){
                var min = vec4.transformMat4(vec4.create(),vec4.fromValues(accessor.min[0], accessor.min[1], accessor.min[2], 1.0),node._model);
                var max =  vec4.transformMat4(vec4.create(),vec4.fromValues(accessor.max[0], accessor.max[1], accessor.max[2], 1.0),node._model);
                console.log(node._model);
                gltf._min[0] = gltf._min[0] > min[0] ? min[0] : gltf._min[0];
                gltf._min[1] = gltf._min[1] > min[1] ? min[1] : gltf._min[1];
                gltf._min[2] = gltf._min[2] > min[2] ? min[2] : gltf._min[2];
                gltf._max[0] = gltf._max[0] < max[0] ? max[0] : gltf._max[0];
                gltf._max[1] = gltf._max[1] < max[1] ? max[1] : gltf._max[1];
                gltf._max[2] = gltf._max[2] < max[2] ? max[2] : gltf._max[2];
            }
            

        }else
        {
            //load data to array
            var array = new Uint16Array(data.response, byte_offset, length/Uint16Array.BYTES_PER_ELEMENT);
            
            //create and set buffer data
            accessor._buffer = gl.createBuffer();
            /*gl.bindBuffer(bufferView.target, accessor._buffer);
            gl.bufferData(bufferView.target, array, gl.STATIC_DRAW);*/
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, accessor._buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array, gl.STATIC_DRAW);

            //gl.bindBuffer(bufferView.target, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }

        //unbind vao
        //gl.bindVertexArray(null);
    });

}

//build and return gltf shader program
function shader_program(gl, params, vs_src, fs_src){
    //set params text
    var param_text = '#version 300 es \n';
    if(params != undefined)
    for(var i = 0; i < params.length; i++){
        var key = params[i].toUpperCase();
        param_text += '#define '+key+'\n';
    }

    //create and compile vertex shader
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, param_text + vs_src);
    gl.compileShader(vs);
    //IF DEBUG
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
        //console.log(gl.getShaderInfoLog(vs));
        gl.deleteShader(vs);
        return false;
    }

    //create and compile fragment shader
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, param_text + fs_src);
    //console.log(param_text + fragment_shader_src);
    gl.compileShader(fs);
    //IF DEBUG
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
        return false;
    }

    //link program
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(prog));
        gl.deleteProgram(prog);
        return false;
    }

    return prog;
    
}
//create default material
function set_default_material(gl, gltf){
    //compile program
    //set default material
    var material = gltf._default_material = {}

    //set to default
    material._is_defualt = true;

    //set program
    material._shader_program = shader_program(gl, [], vertex_shader_src_default, fragment_shader_src_default)

}
//process textures and compile shader program
function process_material(gl, gltf, material_num) {
    //set material
    var material = gltf.materials[material_num];

    //set shader params
    material._shader_params = [];

    //set textures
    material._textures = [];
    
    //traverse material object
    for(const key in material) {
        
        if(key != "_shader_params" && key != "name" && key != "_textures" && key != "_uniform_locs")
        //check if a texture
        if(key.includes('Texture')){
            material._shader_params.push(key)
            material._textures.push({"index":material[key].index, "name": key});
            process_texture(gl, gltf, material[key].index);
        }
        //check if a factor
        else if(key.includes('Factor')){
            material._shader_params.push(key)
        } 
        //then must be another material
        else{
            var _material = material[key];
            for(const _key in _material) 
            {
                console.log(_key);
                //check if a texture
                if(_key.includes('Texture')){
                    //add shader param
                    material._shader_params.push(_key);
                    material._textures.push({"index":_material[_key].index, "name": _key});
                    process_texture(gl, gltf, _material[_key].index);
                }
                //check if a factor
                else if(_key.includes('Factor')){
                    //add shader param
                    material._shader_params.push(_key);
                }
            }
        }
    }

    //create and set shader program
    material._shader_program = shader_program(gl, material._shader_params, vertex_shader_src, fragment_shader_src);

    //set uniform locations

    material._uniform_locs = {};
    material._shader_params.forEach((key)=>{
        material._uniform_locs[key] = gl.getUniformLocation(material._shader_program, key);
    });
}

function process_texture(gl, gltf, texture_num){
    //set texture
    var texture = gltf.textures[texture_num];

    //create texture
    texture._buffer = gl.createTexture();

    //set image 
    var _image = gltf.images[texture.source];

    //set sampler
    var sampler = texture.sampler||gltf.samplers ? gltf.samplers[texture.sampler] : undefined;

    //load image data from source
    if(!_image._onload){
        //set onload to a promise
        _image._onload = download_image(_image.uri).then((image)=>{
            //bind buffer
            gl.bindTexture(gl.TEXTURE_2D, texture._buffer);
    
            //set sampler data
            if(sampler){
            if(sampler.wrapS){
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, sampler.wrapS);
            }
            if(sampler.wrapT){
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, sampler.wrapT);
            }
            if(sampler.minFilter){
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, sampler.minFilter);
            }
            if(sampler.magFilter){
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, sampler.magFilter);
            }
            }else{
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
    
            //set data
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            gl.generateMipmap(gl.TEXTURE_2D);
            
            gl.bindTexture(gl.TEXTURE_2D, null);

            return _image.uri;
        });;

        //add to all load
        gltf._loads.push(_image._onload);
    }

    //set texture buffer data

}


/*
//loads buffer data and sets vertex attrib pointer
function set_buffer(gl, array_data, gl_buffer_id, layout_name,attrib_type, data_type){
    //set buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER,gl_buffer_id);
    gl.bufferData(gl.ARRAY_BUFFER, array_data, gl.STATIC_DRAW);

    //set vertex attrib pointer
    gl.enableVertexAttribArray(layout[layout_name]);
    gl.vertexAttribPointer(layout[layout_name], attrib_sizes[attrib_type], data_type, false, 0, 0);
}

//loads element array buffer
function set_indices_buffer(gl, array_data, gl_buffer_id){
    //set buffer data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl_buffer_id);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_data, gl.STATIC_DRAW);
}
*/





// ENVIRONMENT MAP LOAD

// ENVIRONMENT MAP LOAD

// ENVIRONMENT MAP LOAD
function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}
function load_image(url, on_load){
    var image = new Image();
    image.onload = on_load;
    image.src = url;
    return image;
}
//loads environmental map and returns a renderable
function env_map(gl, gltf){
    //enable seamless cube maps
    //SET CUBE MAP VERTEX DATA
    const vertex_data = new Float32Array([
        -1.0,  1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,

            -1.0, -1.0,  1.0,
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
            -1.0, -1.0,  1.0,

            1.0, -1.0, -1.0,
            1.0, -1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0, -1.0,
            1.0, -1.0, -1.0,

            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,

            -1.0,  1.0, -1.0,
            1.0,  1.0, -1.0,
            1.0,  1.0,  1.0,
            1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0,

            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            1.0, -1.0,  1.0]);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(layout['POSITION']);
    gl.vertexAttribPointer(layout['POSITION'], 3, gl.FLOAT, gl.FALSE, 0, 0);
    gl.bindVertexArray(null);

    //shaders
    const VERTEX_ATTRIB_POSITION = 0;
    var vs_src = `#version 300 es
    layout( location = `+VERTEX_ATTRIB_POSITION+` ) in vec3 position;

    uniform mat4 perspective;
    uniform mat4 view;

    out vec3 v_normal;

    
    void main(){
        vec4 pos = perspective*view*vec4(position*vec3(100), 1.0);
        gl_Position = pos.xyzw;
        v_normal = position;
    }
    `;
    var fs_src = `#version 300 es
    precision mediump float;
 
    in vec3 v_normal;
    out vec4 color;
     
    uniform samplerCube env_map;
    uniform samplerCube diffuse_map;
    uniform samplerCube prefilter_map;
    uniform sampler2D brdflut_map;
     
    void main() {
       color = texture(env_map, v_normal);
    }
    `;
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs,vs_src);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(vs));
        gl.deleteShader(vs);
    }
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs,fs_src);
    gl.compileShader(fs);
    if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
    }
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    //SET CUBE MAP IMAGE DATA
    var diffuse;
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.NONE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    /*const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, src: 'assets/env_map/environment_right_0.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, src: 'assets/env_map/environment_left_0.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, src: 'assets/env_map/environment_top_0.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, src: 'assets/env_map/environment_bottom_0.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, src: 'assets/env_map/environment_front_0.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, src: 'assets/env_map/environment_back_0.jpg' },
    ];*/

    /*const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, src: 'assets/env_map/px.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, src: 'assets/env_map/nx.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, src: 'assets/env_map/py.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, src: 'assets/env_map/ny.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, src: 'assets/env_map/pz.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, src: 'assets/env_map/nz.jpg' },
    ];*/

    const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, src: px },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, src: nx },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, src: py },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, src: ny },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, src: pz },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, src: nz },
    ];
    
    var images = [];
    var env_map_obj = {
        onload: null,
        vao: vao,
        vert_buffer: buffer,
        texture: texture,
        diffuse: diffuse,
        program: program,
        texture_loc: gl.getUniformLocation(program, uniform_names['env_map']),
        diffuse_loc: gl.getUniformLocation(program, uniform_names['diffuse_map']), // only if want to view diffuse in cube map
        prefilter_loc: gl.getUniformLocation(program, 'prefilter_map'),
        brdflut_loc: gl.getUniformLocation(program, 'brdflut_map'),
        perspective_loc: gl.getUniformLocation(program, uniform_names['perspective']),
        view_loc: gl.getUniformLocation(program, uniform_names['view']),
        render: function(gl, camera){
            gl.bindVertexArray(this.vao);
            gl.useProgram(this.program);

            //bind environment map
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP,this.texture);
            gl.uniform1i(this.texture_loc, 0);

            //bind diffuse map ONLY IF WANT TO VIEW DIFFUSE IINSTEAD OF ENV MAP
            /*gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.diffuse);
            gl.uniform1i(this.diffuse_loc, 1);

            //bind prefilter map ONLY IF WANT TO VIEW PREFILTER INSTEAD
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.prefilter);
            gl.uniform1i(this.prefilter_loc, 2);

            //bind brdflut map
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, this.brdflut);
            gl.uniform1i(this.brdflut_loc, 3);*/

            //set camera data
            camera.set_perspective_uniform(gl, this.perspective_loc);
            camera.set_view_uniform(gl, this.view_loc);

            //draw cube map
            gl.drawArrays(gl.TRIANGLES, 0, 36);
            gl.bindVertexArray(null);
        },
        set_texture_uniform: function(gl, active_texture_index, texture_uniform_location){
            gl.activeTexture(gl.TEXTURE0+active_texture_index);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
            gl.uniform1i(texture_uniform_location, active_texture_index);
        },
        set_diffuse_uniform: function(gl, active_texture_index, texture_uniform_location){
            gl.activeTexture(gl.TEXTURE0+active_texture_index);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.diffuse);
            gl.uniform1i(texture_uniform_location, active_texture_index);
        },
        set_prefilter_uniform: function(gl, active_texture_index, texture_uniform_location){
            gl.activeTexture(gl.TEXTURE0+active_texture_index);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.prefilter);
            gl.uniform1i(texture_uniform_location, active_texture_index);
        },
        set_brdflut_uniform: function(gl, active_texture_index, texture_uniform_location){
            gl.activeTexture(gl.TEXTURE0+active_texture_index);
            gl.bindTexture(gl.TEXTURE_2D, this.brdflut);
            gl.uniform1i(texture_uniform_location, active_texture_index);
        },
    } 
    var onload_promise = new Promise((resolve)=>{
        faces.forEach((face)=>{
            const {target , src} = face;
            //var image = new Image();
            var image = new Image();
            image.onload = function(){ 
                //document.body.append(image);
                images.push({'image':image, 'target':target});
                //if all images are loaded load environmental map
                if(images.length >= faces.length){
                    //set texture data
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_MODE, gl.NONE);
                    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
                    for(var i=0; i<images.length; i++){
                        gl.texImage2D(
                            images[i].target,
                            0,
                            gl.RGBA,
                            gl.RGBA,
                            gl.UNSIGNED_BYTE,
                            images[i].image
                        );       
                    }
                    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

                    //generate indirect ibl
                    env_map_obj.diffuse = irradiance_gen(gl, texture, vao);
                    env_map_obj.prefilter = prefilter_gen(gl, texture, vao);
                    env_map_obj.brdflut = brdflut_gen(gl, env_map);
                    resolve(images);
                }
            }
            image.src = src;
        });
    });   


    env_map_obj.onload = onload_promise;
    gltf._loads.push(env_map_obj.onload);
    gltf._environment = env_map_obj;
}

//generate irradiance map from environment cube map WebglTexture
function irradiance_gen(gl, env_map_texture, cube_vao) {
    //set shaders
    var vs_src = `#version 300 es
    layout( location = `+layout['POSITION']+` ) in vec3 position;

    uniform mat4 perspective;
    uniform mat4 view;

    out vec3 v_normal;

    
    void main(){
        vec4 pos = perspective*view*vec4(position, 1.0);
        gl_Position = pos.xyzw;
        v_normal = position;
    }`;
    var fs_src = `#version 300 es
    precision mediump float;
 
    in vec3 v_normal;
    out vec4 color;
    
    const float PI = 3.14159265359;
     
    uniform samplerCube env_map;
     
    void main() {
        vec3 normal = normalize(v_normal);

        vec3 irradiance = vec3(0.0);

        vec3 up    = vec3(0.0, 1.0, 0.0);
        vec3 right = cross(up, normal);
        up         = cross(normal, right);

        float sampleDelta = 0.025;
        float nrSamples = 0.0; 
        for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
        {
            for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
            {
                // spherical to cartesian (in tangent space)
                vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
                // tangent space to world
                vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal; 

                irradiance += texture(env_map, sampleVec).rgb * cos(theta) * sin(theta);
                nrSamples++;
            }
        }
        irradiance = PI * irradiance * (1.0 / float(nrSamples));
        
        color = vec4(irradiance, 1.0);
    }
    `;

    //create convolution shader program
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vs_src);
    gl.compileShader(vs);
    if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(vs));
        gl.deleteShader(vs);
    }
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fs_src);
    gl.compileShader(fs);
    if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
    }
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    //set program locations
    var texture_loc = gl.getUniformLocation(program, uniform_names['env_map']);
    var perspective_loc = gl.getUniformLocation(program, uniform_names['perspective']);
    var view_loc = gl.getUniformLocation(program, uniform_names['view']);

    //initialize irradiance cube map data
    var irradiance_cube_map_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, irradiance_cube_map_texture);
    for(var i = 0; i < 6; i++){
        gl.texImage2D(
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,0, gl.RGBA, 1, 1, 0, gl.RGBA,
              gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255,0, 255, 0, 255,0, 0, 255, 255])
            );    
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    //init render and framebuffer
    var fbo  = gl.createFramebuffer();
    var rbo = gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    //set perspective and view data
    var projection = mat4.perspective(mat4.create(),toRadian(90), 1.0, 0.1, 10.0);
    var view = [
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 1.0,  0.0,  0.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues(-1.0,  0.0,  0.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  1.0,  0.0), vec3.fromValues(0.0,  0.0,  1.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0, -1.0,  0.0), vec3.fromValues(0.0,  0.0, -1.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  0.0,  1.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  0.0, -1.0), vec3.fromValues(0.0, -1.0,  0.0))
         ];

    //generate irradiance map texture
    gl.bindVertexArray(cube_vao); //bind cube vertex data
    gl.useProgram(program);

    //bind environment cube map
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP,env_map_texture);
    gl.uniform1i(texture_loc, 0);

    //set perspective uniform
    gl.uniformMatrix4fv(perspective_loc, gl.FALSE, projection); 
    
    gl.viewport(0, 0, 32, 32);
    for(var i = 0; i < 6; i++){
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        //render cubemap to texture
        gl.uniformMatrix4fv(view_loc, gl.FALSE, view[i]);//set view uniform
        gl.framebufferTexture2D(gl.FRAMEBUFFER, 
                                gl.COLOR_ATTACHMENT0, 
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                                irradiance_cube_map_texture, 
                                0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    return irradiance_cube_map_texture;
}

function prefilter_gen(gl, env_map, cube_vao){
    //initialize prefilter map
    var prefilter_map = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, prefilter_map);
    for(var i = 0; i < 6; i++){
        gl.texImage2D(
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,0, gl.RGBA, 128, 128, 0, gl.RGBA,
            gl.UNSIGNED_BYTE, null
        );      
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

    //initialize prefilter shader program
    var vs_src = `#version 300 es
    layout( location = `+layout['POSITION']+` ) in vec3 position;

    uniform mat4 perspective;
    uniform mat4 view;

    out vec3 v_normal;
    
    void main(){
        vec4 pos = perspective*view*vec4(position, 1.0);
        gl_Position = pos.xyzw;
        v_normal = position;
    }`;
    var fs_src = `#version 300 es
    precision mediump float;
    
    const float PI = 3.14159265359;

    in vec3 v_normal;
    out vec4 color;

    float VanDerCorpus(uint n, uint base)
    {
        float invBase = 1.0 / float(base);
        float denom   = 1.0;
        float result  = 0.0;

        for(uint i = 0u; i < 32u; ++i)
        {
            if(n > 0u)
            {
                denom   = mod(float(n), 2.0);
                result += denom * invBase;
                invBase = invBase / 2.0;
                n       = uint(float(n) / 2.0);
            }
        }

        return result;
    }
    vec2 Hammersley(uint i, uint N)
    {
        return vec2(float(i)/float(N), VanDerCorpus(i, 2u));
    }

    vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
    {
        float a = roughness*roughness;
        
        float phi = 2.0 * PI * Xi.x;
        float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
        float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
        
        // from spherical coordinates to cartesian coordinates
        vec3 H;
        H.x = cos(phi) * sinTheta;
        H.y = sin(phi) * sinTheta;
        H.z = cosTheta;
        
        // from tangent-space vector to world-space sample vector
        vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent   = normalize(cross(up, N));
        vec3 bitangent = cross(N, tangent);
        
        vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
        return normalize(sampleVec);
    }  

     
    uniform samplerCube env_map;
    uniform float roughness;  

    void main() {        
        vec3 N = normalize(v_normal);    
        vec3 R = N;
        vec3 V = R;

        const uint SAMPLE_COUNT = 1024u;
        float totalWeight = 0.0;   
        vec3 prefilteredColor = vec3(0.0);     
        for(uint i = 0u; i < SAMPLE_COUNT; ++i)
        {
            vec2 Xi = Hammersley(i, SAMPLE_COUNT);
            vec3 H  = ImportanceSampleGGX(Xi, N, roughness);
            vec3 L  = normalize(2.0 * dot(V, H) * H - V);

            float NdotL = max(dot(N, L), 0.0);
            if(NdotL > 0.0)
            {
                prefilteredColor += texture(env_map, L).rgb * NdotL;
                totalWeight      += NdotL;
            }
        }
        prefilteredColor = prefilteredColor / totalWeight;

        color = vec4(prefilteredColor, 1.0);
    }
    `;
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vs_src);
    gl.compileShader(vs);
    if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(vs));
        gl.deleteShader(vs);
    }
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fs_src);
    gl.compileShader(fs);
    if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
    }
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    //set program locations
    var env_map_loc = gl.getUniformLocation(program, uniform_names['env_map']);
    var roughness_loc = gl.getUniformLocation(program, 'roughness');
    var perspective_loc = gl.getUniformLocation(program, uniform_names['perspective']);
    var view_loc = gl.getUniformLocation(program, uniform_names['view']);

    //set camera view data
    var views = [
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 1.0,  0.0,  0.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues(-1.0,  0.0,  0.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  1.0,  0.0), vec3.fromValues(0.0,  0.0,  1.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0, -1.0,  0.0), vec3.fromValues(0.0,  0.0, -1.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  0.0,  1.0), vec3.fromValues(0.0, -1.0,  0.0)),
        mat4.lookAt( mat4.create(), vec3.fromValues(0.0, 0.0, 0.0), vec3.fromValues( 0.0,  0.0, -1.0), vec3.fromValues(0.0, -1.0,  0.0))
    ];

    //init frame buffer
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    //run prefilter
    gl.bindVertexArray(cube_vao);
    gl.useProgram(program);

    //set envirnomental map texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP,env_map);
    gl.uniform1i(env_map_loc, 0);

    //set perspective
    gl.uniformMatrix4fv(perspective_loc,gl.FALSE, mat4.perspective(mat4.create(),toRadian(90), 1.0, 0.1, 10.0));

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    var mip_levels = 10;
    for(var mip = 0; mip<mip_levels; ++mip){
        //set viewport dimensions
        var width = 128*Math.pow(0.5, mip);
        var height = 128 * Math.pow(0.5, mip);
        gl.viewport(0, 0, width, height);

        //set roughness uniform
        var roughness = mip/(mip_levels - 1);
        gl.uniform1f(roughness_loc, roughness);

        for(var i = 0; i<6; ++i){
            //set view
            gl.uniformMatrix4fv(view_loc, gl.FALSE, views[i]);

            //render to texture
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,prefilter_map,mip);
            gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);

    return prefilter_map;
}

function brdflut_gen(gl, env_map){

    const vao = gl.createVertexArray();
    /*const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertex_data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(layout['POSITION']);
    gl.vertexAttribPointer(layout['POSITION'], 3, gl.FLOAT, gl.FALSE, 0, 0);
*/
    
    //initialize program
    var vs_src = `#version 300 es
    layout( location = `+layout['POSITION']+` ) in vec3 position;

    out vec2 v_position;
    
    void main(){
        float x = float(((uint(gl_VertexID) + 2u) / 3u)%2u); 
        float y = float(((uint(gl_VertexID) + 1u) / 3u)%2u); 

        gl_Position = vec4(-1.0f + x*2.0f, -1.0f+y*2.0f, 0.0f, 1.0f);
        v_position = vec2(x, y);
    }`;
    var fs_src = `#version 300 es
    precision mediump float;

    in vec2 v_position;
    out vec4 color;

    const float PI = 3.14159265359;


    float VanDerCorpus(uint n, uint base)
    {
        float invBase = 1.0 / float(base);
        float denom   = 1.0;
        float result  = 0.0;

        for(uint i = 0u; i < 32u; ++i)
        {
            if(n > 0u)
            {
                denom   = mod(float(n), 2.0);
                result += denom * invBase;
                invBase = invBase / 2.0;
                n       = uint(float(n) / 2.0);
            }
        }

        return result;
    }
    vec2 Hammersley(uint i, uint N)
    {
        return vec2(float(i)/float(N), VanDerCorpus(i, 2u));
    }

    vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
    {
        float a = roughness*roughness;
        
        float phi = 2.0 * PI * Xi.x;
        float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
        float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
        
        // from spherical coordinates to cartesian coordinates
        vec3 H;
        H.x = cos(phi) * sinTheta;
        H.y = sin(phi) * sinTheta;
        H.z = cosTheta;
        
        // from tangent-space vector to world-space sample vector
        vec3 up        = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent   = normalize(cross(up, N));
        vec3 bitangent = cross(N, tangent);
        
        vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
        return normalize(sampleVec);
    }  

    float GeometrySchlickGGX(float NdotV, float roughness)
{
    float a = roughness;
    float k = (a * a) / 2.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
} 
    vec2 IntegrateBRDF(float NdotV, float roughness)
{
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    vec3 N = vec3(0.0, 0.0, 1.0);

    const uint SAMPLE_COUNT = 1024u;
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H  = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}
// ----------------------------------------------------------------------------
void main() 
{
    vec2 integratedBRDF = IntegrateBRDF(v_position.x, v_position.y);
    color = vec4(integratedBRDF, 0.0, 1.0);
}`;
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vs_src);
    gl.compileShader(vs);
    if(!gl.getShaderParameter(vs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(vs));
        gl.deleteShader(vs);
    }
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fs_src);
    gl.compileShader(fs);
    if(!gl.getShaderParameter(fs, gl.COMPILE_STATUS)){
        console.log(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
    }
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    var fbo = gl.createFramebuffer();
    var rbo = gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    /*gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, 512, 512);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);*/
    
    //initialize brdflut texture
    var brdflut = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, brdflut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 512, 512, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, brdflut, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    //render brdf lut to texture
    gl.viewport(0, 0, 512, 512);

    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.drawArrays(gl.TRIANGLES, 0, 6);



    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return brdflut;

}

export {download, load, env_map};