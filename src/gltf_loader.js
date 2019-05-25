import {mat4, vec4, vec3, quat} from './includes/index.js';

const attrib_layout = {
    "POSITION" : 0,
    "NORMAL" : 1,
    "TEXCOORD_0" : 2,
},
attrib_sizes = {
    "SCALAR":1,
    "VEC2":2,
    "VEC3":3,
    "VEC4":4,
},
array_buffer_promises = {
    /*FILL ME UP BRO*/
};

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
    for(var i=0; i < nodes.length; i++)
        process_node(gl,gltf,i);
}

function process_node(gl,gltf, node_num)
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

    process_mesh(gl,gltf,node.mesh);

}

function process_mesh(gl,gltf,mesh_num)
{
    //set mesh
    var mesh = gltf.meshes[mesh_num];
    //indices
    var index_buffer;
    if(mesh.indices !=undefined) process_accessor(gltf, mesh.primitives[0].indices, true);
    //vertex attributes
    if(mesh.primitives[0].attributes !=undefined){
        for (const key in mesh.primitives[0].attributes) {
            if (mesh.primitives[0].attributes.hasOwnProperty(key)) {
                const attribute = mesh.primitives[0].attributes[key];
                process_accessor(gl,gltf,attribute,key);
            }
    }else{
        //index buffer exists
        index_accessor = process_accessor(gltf, mesh.primitives[0].indices, true);
        index_buffer = index_accessor.buffer;
        draw_call_object = {
            "call" : gl.drawElements,
            "mode" : gl.TRIANGLES,
            "count" : index_accessor.count,
            "type" : gl.UNSIGNED_BYTE,
            "offset" : 0,
        }
    }
}

//processes accessors and buffer data
function process_accessor(gl, gltf, accessor_num,attrib_layout_name, is_indices){  
    //init
    var accessor = gltf.accessors[accessor_num],
    bufferView = gltf.bufferViews[accessor.bufferView],
    buffer = gltf.buffers[bufferView.buffer],
    buffer_id = gl.createBuffer(),
    array_buffer_promise = array_buffer_promises[bufferView.buffer]; 

    //set array buffer positions
    var byte_offset = bufferView.byteOffset,
    length = bufferView.byteLength;
    if(accessor.byteOffset) {
        byte_offset += accessor.byteOffset;
        length -= accessor.byteOffset;
    }

    /*check if buffer is already loaded*/
    if(!array_buffer_promise) {
        //if not loaded, load it to array buffer
        array_buffer_promise = download(buffer.uri, "arraybuffer");
    }

    //wait till data is loaded then load to gl buffer
    console.log("loading buffer #" + bufferView.buffer);
    array_buffer_promise.then(function(data){
        var array_buffer = data.response;
        if(!is_indices){
            var array_data = new Float32Array(array_buffer,byte_offset,length/Float32Array.BYTES_PER_ELEMENT);
            set_buffer(gl,array_data, buffer_id, attrib_layout_name, accessor.type, accessor.componentType );
        }else{
            var array_data = new Uint32Array(array_buffer, byte_offset, length/Uint32Array.BYTES_PER_ELEMENT)
            set_indices_buffer(gl, array_data, buffer_id);
        }
        console.log("finished loading buffer #" + bufferView.buffer);
    });
}

//loads buffer data and sets vertex attrib pointer
function set_buffer(gl,array_data, gl_buffer_id, attrib_layout_name,attrib_type, data_type){
    //set buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER,gl_buffer_id);
    gl.bufferData(gl.ARRAY_BUFFER, array_data, gl.STATIC_DRAW);
    //set vertex attrib pointer
    gl.vertexAttribPointer(attrib_layout[attrib_layout_name], attrib_sizes[attrib_type], data_type, false, 0, 0);
    gl.enableVertexAttribArray(attrib_layout[attrib_layout_name]);
}

//loads element array buffer
function set_indices_buffer(gl, array_data, gl_buffer_id){
    //set buffer data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl_buffer_id);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array_data, gl.STATIC_DRAW);
}

export {download, process_scene};