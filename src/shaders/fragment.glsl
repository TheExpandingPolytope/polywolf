#define NUM_LIGHTS 1
precision mediump float;

in vec3 v_position;
in vec3 v_normal;
in vec2 v_texcoords;

#ifdef EMISSIVETEXTURE
uniform sampler2D emissive_texture;
vec3 emissive;
#endif

#ifdef NORMALTEXTURE
uniform sampler2D normal_texture;
#endif

vec3 normal;

#ifdef OCCLUSIONTEXTURE
uniform sampler2D occlusion_texture;
float occlusion;
#endif

#ifdef BASECOLORTEXTURE
uniform sampler2D base_color_texture;
vec4 base_color;
#endif

#ifdef METALLICROUGHNESSTEXTURE
uniform sampler2D metallic_roughness_texture;
float roughness;
float metallic;
#endif

uniform samplerCube env_map;
uniform samplerCube diffuse_map;
uniform samplerCube prefilter_map;
uniform sampler2D brdflut_map;

//light variables
vec3 light_positions[1];
vec3 light_colors[1];

const float PI = 3.14159265359;

//set lights functions
void set_lights(){
  light_positions[0] = vec3(1,1,1);
  light_colors[0] = vec3(5);
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

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
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

vec3 getNormal(){
  vec3 pos_dx = dFdx(v_position);
  vec3 pos_dy = dFdy(v_position);
  vec3 tex_dx = dFdx(vec3(v_texcoords, 0.0));
  vec3 tex_dy = dFdy(vec3(v_texcoords, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

  vec3 ng = v_normal;

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);


  vec3 n = texture(normal_texture, v_texcoords).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(1, 1, 1.0)));
  return n;
}
 
void main() {
  //set lights
  set_lights();

  //set material info
  #ifdef BASE_COLOR_TEXTURE
  base_color = texture(base_color_texture, v_texcoords);
  #endif

  normal = getNormal();

  #ifdef METALLIC_ROUGHNESS_TEXTURE
  metallic = texture(metallic_roughness_texture, v_texcoords).b;
  roughness = texture(metallic_roughness_texture, v_texcoords).g;
  #endif

  #ifdef OCCLUSION_TEXTURE
  occlusion = texture(occlusion_texture, v_texcoords).r;
  #endif

  #ifdef EMISSIVE_TEXTURE
  emissive = texture(emissive_texture, v_texcoords).rgb;
  #endif

  //set geometry info
  vec3 n = normalize(normal);
  vec3 v = normalize(-v_position);
  vec3 R = -normalize(reflect(v, n));   


  //calculate surface reflectivity for fresnel schlick
  vec3 f0 = vec3(0.04);
  f0 = mix(f0, base_color.rgb, metallic);

  //init radiance
  vec3 Lo = vec3(0.0);
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
    vec3 F    = fresnelSchlickRoughness(max(dot(n, v), 0.0), f0, roughness);;       
    
      
    
    //calculate specular component
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(n, v), 0.0) * max(dot(n, l), 0.0) + 0.001;
    vec3 specular     = numerator / denominator;  
    
    //calulate diffuse
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;	

    // integrate to outgoing radiance Lo
    float NdotL = max(dot(n, l), 0.0);                
    Lo += (kD * base_color.rgb / PI + specular) * radiance * NdotL;
  }

  vec3 F = fresnelSchlickRoughness(max(dot(n, v), 0.0), f0, roughness);

  //diffuse ibl
  vec3 kS = F;
  vec3 kD = vec3(1.0) - kS;
  kD *= 1.0 - metallic;	  
  vec3 irradiance = texture(diffuse_map, n).rgb;
  vec3 diffuse    = irradiance * base_color.rgb;

  //calculate speculare ibl
  const float MAX_REFLECTION_LOD = 20.0;
  vec3 prefilteredColor = texture(prefilter_map, R,  roughness).rgb;   
  vec2 envBRDF  = texture(brdflut_map, vec2(max(dot(n, v), 0.0), roughness)).rg;
  vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);
  vec3 ambient    = (kD * diffuse + (specular)) ; 
  
  vec3 c = ambient + Lo;

  #ifdef OCCLUSION_TEXTURE
  c *= occlusion;
  #endif

  #ifdef EMISSIVE_TEXTURE
  c+=emissive;
  #endif

  /*c = c / (c + vec3(1.0));
  c = pow(c, vec3(1.2));*/

  //set color
  color = vec4(1.0, 0.0, 0.0, 1.0);

}