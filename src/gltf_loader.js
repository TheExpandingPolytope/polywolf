import {mat4, vec4, vec3, quat} from './includes/index.js';
import {draw_data} from './gl_renderer.js';
import {attrib_layout, uniform_names} from './config.js';
import { toRadian } from './includes/common.js';

const attrib_sizes = {
    "SCALAR":1,
    "VEC2":2,
    "VEC3":3,
    "VEC4":4,
},
array_buffer_promises = {
    /*FILL ME UP BRO*/
};
var url = "";
var path = "";
function load(gl, filepath){
    return download(filepath, "text")
    .then(function(request){
        url = request.responseURL;
        path = url.slice(0, url.lastIndexOf("/")+1);
        console.log(url);
        console.log(path);
        return JSON.parse(request.responseText);
    })
    .then(function(gltf){
        return process_scene(gl, gltf);
    });
}
function download_no_promise(filepath, response_type) {
    var request = new XMLHttpRequest();
    request.open('GET', filepath, false);  // `false` makes the request synchronous
    if(response_type) request.responseType = response_type;
    request.send(null);

    if (request.status === 200) {
    return request;
    }
}
function download(filepath, response_type)
{
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

function process_scene(gl, gltf, scene_number)
{
    if(scene_number==undefined) scene_number=0;
    var nodes = gltf.scenes[scene_number].nodes;
    if(nodes.length==0) return;
    var renderables = [];
    for(var i=0; i < nodes.length; i++)
        renderables.push(process_node(gl,gltf,i));
    
    return renderables[0];
}

function process_node(gl, gltf, node_num)
{
    //set node
    var node = gltf.nodes[node_num];
    //set model matrix data
    var m_matrix = mat4.create(),
    has_matrix = node.matrix != undefined,
    has_translate = node.translation !=undefined,
    has_rotation = node.rotation != undefined,
    has_scale = node.scale != undefined;
    mat4.identity(m_matrix);
    if(has_matrix)
        m_matrix = mat4.clone(node.matrix);
    else{
        if(!has_translate) {
            node.translation = vec3.create()
            node.scale = vec3.fromValues(0,0,0);
        };
        if(!has_rotation){
            node.rotation = quat.create();
            quat.identity(node.rotation);
        } 
        if(!has_scale){
            node.scale = vec3.create();
            node.scale = vec3.fromValues(1,1,1);
        }
        mat4.fromRotationTranslationScale(m_matrix,quat.fromValues(...node.rotation),node.translation,node.scale);
    }

    return process_mesh(gl,gltf,node.mesh,m_matrix);

}

function process_mesh(gl,gltf,mesh_num, m_matrix)
{
    //initialize variables
    var mesh = gltf.meshes[mesh_num],
    index_buffer = undefined,
    draw_call_object = {},
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    //vertex attributes
    var count = 0;
    if(mesh.primitives[0].attributes !=undefined){
        for (const key in mesh.primitives[0].attributes) {
            if (mesh.primitives[0].attributes.hasOwnProperty(key)) {
                const attribute = mesh.primitives[0].attributes[key];
                if(key == "POSITION") count = process_accessor(gl, gltf, attribute, key).count;
                else process_accessor(gl, gltf, attribute, key);
            }
        }
    }
    //set draw object and index buffer
    if(mesh.primitives[0].indices ==undefined){
        draw_call_object = {
            "func" : "gl.drawArrays",
            "parameters": [
                gl.TRIANGLES,
                0,
                count,
            ]
        }
    }else{
        //index buffer exists
        var index_accessor = process_accessor(gl, gltf, mesh.primitives[0].indices, null, true);
        index_buffer = index_accessor.buffer;
        draw_call_object = {
            "func" : 'gl.drawElements('+gl.TRIANGLES+','+index_accessor.count+','+index_accessor.type+','+0+')',
            "parameters" : [
                gl.TRIANGLES,
                index_accessor.count,
                index_accessor.type,
                0,
            ]
        }
    }
    gl.bindVertexArray(null);
    return new draw_data(vao, index_buffer, draw_call_object, m_matrix, process_material(gl, gltf, mesh.primitives[0].material));
}

function process_material(gl, gltf, material_num) {
    //set material
    var material = gltf.materials[material_num];

    var textures = [];
    
    if(material.emissiveTexture) textures.push(process_texture(gl, gltf,'emissive_texture', material.emissiveTexture.index));
    if(material.normalTexture) textures.push(process_texture(gl, gltf, 'normal_texture', material.normalTexture.index));
    if(material.occlusionTexture) textures.push(process_texture(gl, gltf, 'occlusion_texture', material.occlusionTexture.index));
    if(material.pbrMetallicRoughness.baseColorTexture) textures.push(process_texture(gl, gltf, 'base_color_texture', material.pbrMetallicRoughness.baseColorTexture.index));
    if(material.pbrMetallicRoughness.metallicRoughnessTexture) textures.push(process_texture(gl, gltf, 'metallic_roughness_texture', material.pbrMetallicRoughness.metallicRoughnessTexture.index));

    return textures;

}

function process_texture(gl, gltf, texture_name, texture_num){
    var image_num = gltf.textures[texture_num].source;
    var image_uri = gltf.images[image_num].uri;
    var image = new Image();
    var buffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, buffer);
    // put a 1x1 red pixel in the texture so it's renderable immediately
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
              gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255,0, 255, 0, 255,0, 0, 255, 255]));
    image.onload = function(){
        gl.bindTexture(gl.TEXTURE_2D, buffer);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    if(image_uri.search("data:") != -1){
        //it is an embeedded link
        image.src = image_uri;
    }else{
        //it is external
        image.src = path+image_uri;
    }

    return {
        'buffer_id' : buffer,
        'name' : texture_name,
        'program_location' : null,
    };
}

//processes accessors and buffer data
function process_accessor(gl, gltf, accessor_num,attrib_layout_name, is_indices){ 
    //init
    var accessor = gltf.accessors[accessor_num],
    bufferView = gltf.bufferViews[accessor.bufferView],
    buffer = gltf.buffers[bufferView.buffer],
    buffer_id = gl.createBuffer();

    //set array buffer positions
    var byte_offset = bufferView.byteOffset,
    length = bufferView.byteLength;
    if(accessor.byteOffset) {
        byte_offset += accessor.byteOffset;
        length -= accessor.byteOffset;
    }

    /*check if buffer is already loaded*/
    if(!array_buffer_promises[bufferView.buffer]) {
        //if not loaded, load it to array buffer
        if(buffer.uri.search("data:") != -1){
            //it is an embeedded link
            console.log(buffer.uri);
            array_buffer_promises[bufferView.buffer] = download(buffer.uri, "arraybuffer");
        }else{
            //it is external
            console.log(path+buffer.uri)
            array_buffer_promises[bufferView.buffer] = download(path+buffer.uri, "arraybuffer");
        }
    }

    //wait till data is loaded then load to gl buffer
    array_buffer_promises[bufferView.buffer].then(function(data){
        var array_buffer = data.response;
        if(!is_indices){
            var array_data = new Float32Array(array_buffer, byte_offset,length/Float32Array.BYTES_PER_ELEMENT);
            set_buffer(gl,array_data, buffer_id, attrib_layout_name, accessor.type, accessor.componentType );
        }else{
            var array_data = new Uint16Array(array_buffer, byte_offset, length/Uint16Array.BYTES_PER_ELEMENT);
            set_indices_buffer(gl, array_data, buffer_id);
        }
    });

    return {
        "buffer":buffer_id,
        "count": accessor.count,
        "type": accessor.componentType,
    }
}

//loads buffer data and sets vertex attrib pointer
function set_buffer(gl, array_data, gl_buffer_id, attrib_layout_name,attrib_type, data_type){
    //set buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER,gl_buffer_id);
    gl.bufferData(gl.ARRAY_BUFFER, array_data, gl.STATIC_DRAW);

    //set vertex attrib pointer
    gl.enableVertexAttribArray(attrib_layout[attrib_layout_name]);
    gl.vertexAttribPointer(attrib_layout[attrib_layout_name], attrib_sizes[attrib_type], data_type, false, 0, 0);
}

//loads element array buffer
function set_indices_buffer(gl, array_data, gl_buffer_id){
    //set buffer data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl_buffer_id);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_data, gl.STATIC_DRAW);
}

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
function env_map(gl){
    //enable seamless cube maps
    gl.enable(gl.TEXTURE_CUBE_MAP_SEAMLESS);
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
    gl.enableVertexAttribArray(attrib_layout['POSITION']);
    gl.vertexAttribPointer(attrib_layout['POSITION'], 3, gl.FLOAT, gl.FALSE, 0, 0);
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
       color = texture(env_map, normalize(v_normal));
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
    const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, src: 'assets/env_map/px.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, src: 'assets/env_map/nx.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, src: 'assets/env_map/py.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, src: 'assets/env_map/ny.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, src: 'assets/env_map/pz.jpg' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, src: 'assets/env_map/nz.jpg' },
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

            /*//bind diffuse map ONLY IF WANT TO VIEW DIFFUSE IINSTEAD OF ENV MAP
            gl.activeTexture(gl.TEXTURE1);
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
            var image = new Image();
            image.onload = function(){ 
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
    return env_map_obj;
}

//generate irradiance map from environment cube map WebglTexture
function irradiance_gen(gl, env_map_texture, cube_vao) {
    //set shaders
    var vs_src = `#version 300 es
    layout( location = `+attrib_layout['POSITION']+` ) in vec3 position;

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
    layout( location = `+attrib_layout['POSITION']+` ) in vec3 position;

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
    var mip_levels = 5;
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
    gl.enableVertexAttribArray(attrib_layout['POSITION']);
    gl.vertexAttribPointer(attrib_layout['POSITION'], 3, gl.FLOAT, gl.FALSE, 0, 0);
*/
    
    //initialize program
    var vs_src = `#version 300 es
    layout( location = `+attrib_layout['POSITION']+` ) in vec3 position;

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