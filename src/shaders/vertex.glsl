#version 300 es

layout( location = 0 ) in vec3 position;
layout( location = 1 ) in vec3 norm;

uniform mat4 perspective;
uniform mat4 view;

out vec3 normal;

void main(){
    gl_Position = perspective*view*vec4(position, 1.0);
    normal = norm;
}