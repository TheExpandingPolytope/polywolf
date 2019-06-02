#version 300 es

layout( location = 0 ) in vec3 position;
layout( location = 1 ) in vec3 norm;
layout( location = 2 ) in vec2 tex;

uniform mat4 perspective;
uniform mat4 view;

out vec3 normal;
out vec2 tex_coords;

void main(){
    gl_Position = perspective*view*vec4(position, 1.0);
    normal = norm;
    tex_coords = tex;
}