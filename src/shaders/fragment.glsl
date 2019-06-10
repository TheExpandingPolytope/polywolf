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
vec3 light_positions[1];
vec3 light_colors[1];

const float PI = 3.14159265359;

//set lights functions
void set_lights(){
  light_positions[0] = vec3(10,2,3);
  light_colors[0] = vec3(1,800,300);
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
 
void main() {
  //set lights
  set_lights();

  //set material info
  base_color = texture(base_color_texture, v_texcoords);
  normal = v_normal + texture(normal_texture, v_texcoords).xyz;
  metallic = texture(metallic_roughness_texture, v_texcoords).b;
  roughness = texture(metallic_roughness_texture, v_texcoords).g;
  occlusion = texture(occlusion_texture, v_texcoords).r;
  emissive = texture(emissive_texture, v_texcoords).rgb;

  //set geometry info
  vec3 n = normalize(normal);
  vec3 v = normalize(-v_position);

  //calculate surface reflectivity for fresnel schlick
  vec3 f0 = vec3(0.04);
  f0 = mix(f0, base_color.rgb, metallic);

  //init radiance
  vec3 Lo = vec3(0);
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
    vec3 F    = fresnelSchlick(max(dot(h, v), 0.0), f0);       
    
    //calulate diffuse
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;	  
    
    //calculate specular component
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(n, v), 0.0) * max(dot(n, l), 0.0);
    vec3 specular     = numerator / max(denominator, 0.001);  
        
    // integrate to outgoing radiance Lo
    float NdotL = max(dot(n, l), 0.0);                
    Lo += (kD * base_color.rgb / PI + specular) * radiance * NdotL;
  }

  vec3 ambient = base_color.rgb * occlusion;
  vec3 c = ambient + Lo;
  c = c / (c + vec3(1.0));
  c = pow(c, vec3(1.0/2.2));
  c+= emissive;

  //set color
  color = vec4(c, 1.0);

}