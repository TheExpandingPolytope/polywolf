#version 300 es
precision mediump float;

in vec3 normal;
out vec4 color;
 
void main() {
  color = vec4(normal, 1);
}