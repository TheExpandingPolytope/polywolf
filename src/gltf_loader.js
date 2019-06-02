import {mat4, vec4, vec3, quat} from './includes/index.js';
import {draw_data} from './gl_renderer.js';
import {attrib_layout} from './config.js';

const attrib_sizes = {
    "SCALAR":1,
    "VEC2":2,
    "VEC3":3,
    "VEC4":4,
},
array_buffer_promises = {
    /*FILL ME UP BRO*/
};

function load(gl, filepath){
    return download(filepath, "text")
    .then(function(request){
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
    
    console.log(renderables);
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
    if(has_matrix)
        m_matrix = mat4.clone(node.matrix);
    else{
        if(!has_translate) node.translation = vec3.create();
        if(!has_rotation) node.rotation = quat.create();
        if(!has_scale) node.scale = vec3.create();
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
    
    textures.push(process_texture(gl, gltf,'emissive_texture', material.emissiveTexture.index));
    textures.push(process_texture(gl, gltf, 'normal_texture', material.normalTexture.index));
    textures.push(process_texture(gl, gltf, 'occlusion_texture', material.occlusionTexture.index));
    textures.push(process_texture(gl, gltf, 'base_color_texture', material.pbrMetallicRoughness.baseColorTexture.index));
    textures.push(process_texture(gl, gltf, 'metallic_roughness_texture', material.pbrMetallicRoughness.metallicRoughnessTexture.index));

    return textures;

}

function process_texture(gl, gltf, texture_name, texture_num){
    var image_num = gltf.textures[texture_num].source;
    var image_uri = gltf.images[image_num].uri;
    var image = new Image();
    var buffer = gl.createTexture();
    image.onload = function(){
        gl.bindTexture(gl.TEXTURE_2D, buffer);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    image.src = image_uri;

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
        array_buffer_promises[bufferView.buffer] = download(/*'assets/'+*/buffer.uri, "arraybuffer");
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

export {download, load};