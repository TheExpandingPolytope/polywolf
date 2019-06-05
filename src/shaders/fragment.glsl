#version 300 es
#define NUM_LIGHTS 1
precision mediump float;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_texcoords;

uniform sampler2D emissive_texture;
uniform sampler2D normal_texture;
uniform sampler2D occlusion_texture;
uniform sampler2D base_color_texture;
uniform sampler2D metallic_roughness_texture;

//material variables
vec4 base_color;
vec3 normal;
float metallic;
float roughness;
float occlusion;
vec3 emissive;

//light variables
vec3 light_positions[NUM_LIGHTS];
vec3 light_colors[NUM_LIGHTS];

out vec4 color;

//cook torrance

 
void main() {
  //set material info
  base_color = texture(base_color_texture, v_texcoords);
  normal = normalize(v_normal + texture(normal_texture, v_texcoords).xyz);
  metallic = texture(metallic_roughness_texture, v_texcoords).b;
  roughness = texture(metallic_roughness_texture, v_texcoords).g;
  occlusion = texture(occlusion_texture, v_texcoords).r;
  emissive = texture(emissive_texture, v_texcoords).rgb;

  //set geometry info

  //set color
  color = base_color;

}