#version 300 es
precision mediump float;

in vec3 normal;
in vec2 tex_coords;

uniform sampler2D emissive_texture;
uniform sampler2D normal_texture;
uniform sampler2D occlusion_texture;
uniform sampler2D base_color_texture;
uniform sampler2D metallic_roughness_texture;

out vec4 color;
 
void main() {
  color = texture(emissive_texture, tex_coords)+
          texture(base_color_texture, tex_coords);
}