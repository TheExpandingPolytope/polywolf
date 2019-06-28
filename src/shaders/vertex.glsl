layout( location = 0 ) in vec3 position;
layout( location = 1 ) in vec3 normal;
layout( location = 2 ) in vec2 texcoords;

uniform mat4 perspective;
uniform mat4 view;

out vec3 v_position;
out vec3 v_normal;
out vec2 v_texcoords;

uniform mat4 model;

void main(){
    gl_Position = perspective*view*model*vec4(position, 1.0);
    v_position = (view*model*vec4(position, 1.0)).xyz;
    v_normal = mat3(transpose(inverse(view*model))) * normal;
    v_texcoords = texcoords;
}