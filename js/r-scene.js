AFRAME.registerComponent("r-scene", {
    schema: {
        maxSteps: {default: 512},
        maxDist: {default: 1000.},
        fog: {default: 100.},
        surfDist: {default: .01},
    },
    rayOrigin: new THREE.Vector3(0., 0., 0.),
    rayDirection: new THREE.Vector3(0., 0., 0.),
    uglyFix: new THREE.Vector3(-1., 1., 1.),
    init: function() {
        const material = this.initMaterial();
        const geometry = new THREE.BoxGeometry(1e4, 1e4, 1e4);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = this.onBeforeRender.bind(this);
        this.el.setObject3D("mesh", this.mesh);
        this.initOnResize();
    },
    initMaterial: function() {
        return new THREE.ShaderMaterial({
            vertexShader: `
				precision highp float;

				uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;

                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, 1000.*sin(time*.01)+position.y, position.z, 1.0);
                }
            `,
            fragmentShader: this.buildFragmentShader(),
            uniforms: {
                time: {type: "f", value: 0.},
                rayOrigin: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                rayDirection: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                resolution: {type: "v2", value: new THREE.Vector2(window.innerWidth, window.innerHeight)},
            },
            side: THREE.DoubleSide,
        });
    },
    onBeforeRender: function(renderer, scene, camera) {
        camera.getWorldPosition(this.rayOrigin);
        camera.getWorldDirection(this.rayDirection);
        this.mesh.material.uniforms.rayOrigin.value.copy(this.rayOrigin.multiply(this.uglyFix));
        this.mesh.material.uniforms.rayDirection.value.copy(this.rayDirection.multiply(this.uglyFix));
        this.mesh.material.uniforms.time.value = performance.now();
    },
    initOnResize: function() {
        window.addEventListener("resize", () => {
            this.mesh.material.uniforms.resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
        });
    },
    buildFragmentShader: function() {
        let componentsSdf = "";
        for(const objEl of this.el.querySelectorAll("[r-object]")) {
            const obj = objEl.components["r-object"];
            componentsSdf += obj.data.sdf + "\n";
        }
        return `
            // http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
            #define MAX_STEPS ${this.data.maxSteps}
            #define MAX_DIST ${this.data.maxDist}.
            #define FOG ${this.data.fog}.
            #define SURF_DIST ${this.data.surfDist}
            precision highp float;

            uniform float time;
            uniform vec2 resolution;
            uniform vec3 rayOrigin;
            uniform vec3 rayDirection;

            //
            //  Perlin Noise 4D
            //  Return value range of -1.0->1.0
            //
            float Perlin4D( vec4 P )
            {
                //  https://github.com/BrianSharpe/Wombat/blob/master/Perlin4D.glsl

                // establish our grid cell and unit position
                vec4 Pi = floor(P);
                vec4 Pf = P - Pi;
                vec4 Pf_min1 = Pf - 1.0;

                // clamp the domain
                Pi = Pi - floor(Pi * ( 1.0 / 69.0 )) * 69.0;
                vec4 Pi_inc1 = step( Pi, vec4( 69.0 - 1.5 ) ) * ( Pi + 1.0 );

                // calculate the hash.
                const vec4 OFFSET = vec4( 16.841230, 18.774548, 16.873274, 13.664607 );
                const vec4 SCALE = vec4( 0.102007, 0.114473, 0.139651, 0.084550 );
                Pi = ( Pi * SCALE ) + OFFSET;
                Pi_inc1 = ( Pi_inc1 * SCALE ) + OFFSET;
                Pi *= Pi;
                Pi_inc1 *= Pi_inc1;
                vec4 x0y0_x1y0_x0y1_x1y1 = vec4( Pi.x, Pi_inc1.x, Pi.x, Pi_inc1.x ) * vec4( Pi.yy, Pi_inc1.yy );
                vec4 z0w0_z1w0_z0w1_z1w1 = vec4( Pi.z, Pi_inc1.z, Pi.z, Pi_inc1.z ) * vec4( Pi.ww, Pi_inc1.ww );
                const vec4 SOMELARGEFLOATS = vec4( 56974.746094, 47165.636719, 55049.667969, 49901.273438 );
                vec4 hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.xxxx;
                vec4 lowz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
                vec4 lowz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
                vec4 lowz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
                vec4 lowz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
                hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.yyyy;
                vec4 highz_loww_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
                vec4 highz_loww_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
                vec4 highz_loww_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
                vec4 highz_loww_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
                hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.zzzz;
                vec4 lowz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
                vec4 lowz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
                vec4 lowz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
                vec4 lowz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );
                hashval = x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.wwww;
                vec4 highz_highw_hash_0 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.x ) );
                vec4 highz_highw_hash_1 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.y ) );
                vec4 highz_highw_hash_2 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.z ) );
                vec4 highz_highw_hash_3 = fract( hashval * ( 1.0 / SOMELARGEFLOATS.w ) );

                // calculate the gradients
                lowz_loww_hash_0 -= 0.49999;
                lowz_loww_hash_1 -= 0.49999;
                lowz_loww_hash_2 -= 0.49999;
                lowz_loww_hash_3 -= 0.49999;
                highz_loww_hash_0 -= 0.49999;
                highz_loww_hash_1 -= 0.49999;
                highz_loww_hash_2 -= 0.49999;
                highz_loww_hash_3 -= 0.49999;
                lowz_highw_hash_0 -= 0.49999;
                lowz_highw_hash_1 -= 0.49999;
                lowz_highw_hash_2 -= 0.49999;
                lowz_highw_hash_3 -= 0.49999;
                highz_highw_hash_0 -= 0.49999;
                highz_highw_hash_1 -= 0.49999;
                highz_highw_hash_2 -= 0.49999;
                highz_highw_hash_3 -= 0.49999;

                vec4 grad_results_lowz_loww = inversesqrt( lowz_loww_hash_0 * lowz_loww_hash_0 + lowz_loww_hash_1 * lowz_loww_hash_1 + lowz_loww_hash_2 * lowz_loww_hash_2 + lowz_loww_hash_3 * lowz_loww_hash_3 );
                grad_results_lowz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_loww_hash_1 + Pf.zzzz * lowz_loww_hash_2 + Pf.wwww * lowz_loww_hash_3 );

                vec4 grad_results_highz_loww = inversesqrt( highz_loww_hash_0 * highz_loww_hash_0 + highz_loww_hash_1 * highz_loww_hash_1 + highz_loww_hash_2 * highz_loww_hash_2 + highz_loww_hash_3 * highz_loww_hash_3 );
                grad_results_highz_loww *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_loww_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_loww_hash_1 + Pf_min1.zzzz * highz_loww_hash_2 + Pf.wwww * highz_loww_hash_3 );

                vec4 grad_results_lowz_highw = inversesqrt( lowz_highw_hash_0 * lowz_highw_hash_0 + lowz_highw_hash_1 * lowz_highw_hash_1 + lowz_highw_hash_2 * lowz_highw_hash_2 + lowz_highw_hash_3 * lowz_highw_hash_3 );
                grad_results_lowz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * lowz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * lowz_highw_hash_1 + Pf.zzzz * lowz_highw_hash_2 + Pf_min1.wwww * lowz_highw_hash_3 );

                vec4 grad_results_highz_highw = inversesqrt( highz_highw_hash_0 * highz_highw_hash_0 + highz_highw_hash_1 * highz_highw_hash_1 + highz_highw_hash_2 * highz_highw_hash_2 + highz_highw_hash_3 * highz_highw_hash_3 );
                grad_results_highz_highw *= ( vec2( Pf.x, Pf_min1.x ).xyxy * highz_highw_hash_0 + vec2( Pf.y, Pf_min1.y ).xxyy * highz_highw_hash_1 + Pf_min1.zzzz * highz_highw_hash_2 + Pf_min1.wwww * highz_highw_hash_3 );

                // Classic Perlin Interpolation
                vec4 blend = Pf * Pf * Pf * (Pf * (Pf * 6.0 - 15.0) + 10.0);
                vec4 res0 = grad_results_lowz_loww + ( grad_results_lowz_highw - grad_results_lowz_loww ) * blend.wwww;
                vec4 res1 = grad_results_highz_loww + ( grad_results_highz_highw - grad_results_highz_loww ) * blend.wwww;
                res0 = res0 + ( res1 - res0 ) * blend.zzzz;
                blend.zw = vec2( 1.0 ) - blend.xy;
                return dot( res0, blend.zxzx * blend.wwyy );
            }

            float Value4D(vec4 P) {
                //  https://github.com/BrianSharpe/Wombat/blob/master/Value4D.glsl

                // establish our grid cell and unit position
                vec4 Pi = floor(P);
                vec4 Pf = P - Pi;

                // clamp the domain
                Pi = Pi - floor(Pi * ( 1.0 / 69.0 )) * 69.0;
                vec4 Pi_inc1 = step( Pi, vec4( 69.0 - 1.5 ) ) * ( Pi + 1.0 );

                // calculate the hash
                const vec4 OFFSET = vec4( 16.841230, 18.774548, 16.873274, 13.664607 );
                const vec4 SCALE = vec4( 0.102007, 0.114473, 0.139651, 0.084550 );
                Pi = ( Pi * SCALE ) + OFFSET;
                Pi_inc1 = ( Pi_inc1 * SCALE ) + OFFSET;
                Pi *= Pi;
                Pi_inc1 *= Pi_inc1;
                vec4 x0y0_x1y0_x0y1_x1y1 = vec4( Pi.x, Pi_inc1.x, Pi.x, Pi_inc1.x ) * vec4( Pi.yy, Pi_inc1.yy );
                vec4 z0w0_z1w0_z0w1_z1w1 = vec4( Pi.z, Pi_inc1.z, Pi.z, Pi_inc1.z ) * vec4( Pi.ww, Pi_inc1.ww ) * vec4( 1.0 / 56974.746094 );
                vec4 z0w0_hash = fract( x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.xxxx );
                vec4 z1w0_hash = fract( x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.yyyy );
                vec4 z0w1_hash = fract( x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.zzzz );
                vec4 z1w1_hash = fract( x0y0_x1y0_x0y1_x1y1 * z0w0_z1w0_z0w1_z1w1.wwww );

                //blend the results and return
                vec4 blend = Pf * Pf * Pf * (Pf * (Pf * 6.0 - 15.0) + 10.0);
                vec4 res0 = z0w0_hash + ( z0w1_hash - z0w0_hash ) * blend.wwww;
                vec4 res1 = z1w0_hash + ( z1w1_hash - z1w0_hash ) * blend.wwww;
                res0 = res0 + ( res1 - res0 ) * blend.zzzz;
                blend.zw = vec2( 1.0 - blend.xy );
                return dot( res0, blend.zxzx * blend.wwyy );
            }

            struct HitObject {
                float distance;
                vec4 material;
            };

            mat2 rotationMatrix(float a) {
                float s = sin(a);
                float c = cos(a);
                return mat2(c, -s, s, c);
            }
            float opUnion(float d1, float d2) {
                return min(d1, d2);
            }
            HitObject opUnion(HitObject o1, HitObject o2) {
                if (o1.distance <= o2.distance) {
                    return o1;
                } else {
                    return o2;
                }
            }
            float opSubtraction(float d1, float d2) {
                return max(-d1, d2);
            }
            HitObject opSubtraction(HitObject o1, HitObject o2) {
                if (-o1.distance <= o2.distance) {
                    return o1;
                } else {
                    return o2;
                }
            }
            float opIntersection(float d1, float d2) {
                return max(d1, d2);
            }
            float opSmoothUnion(float d1, float d2, float k) {
                float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) - k * h * (1.0 - h);
            }
            HitObject opSmoothUnion(HitObject o1, HitObject o2, float k) {
                float h = clamp(0.5 + 0.5 * (o2.distance - o1.distance) / k, 0.0, 1.0);
                o1.distance = mix(o2.distance, o1.distance, h) - k * h * (1.0 - h);
                o1.material = mix(o2.material, o1.material, h);
                return o1;
            }
            float opSmoothSubtraction(float d1, float d2, float k) {
                float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
                return mix(d2, -d1, h) + k * h * (1.0 - h);
            }
            HitObject opSmoothSubtraction(HitObject o1, HitObject o2, float k) {
                float h = clamp(0.5 - 0.5 * (o2.distance + o1.distance) / k, 0.0, 1.0);
                o1.distance = mix(o2.distance, -o1.distance, h) + k * h * (1.0 - h);
                o1.material = mix(o2.material, -o1.material, h);
                return o1;
            }
            float opSmoothIntersection(float d1, float d2, float k) {
                float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) + k * h * (1.0 - h);
            }

            float opOnion(float d, in float thickness) {
                return abs(d) - thickness;
            }
            vec4 opElongate(vec3 p, vec3 h) {
                vec3 q = abs(p)-h;
                return vec4( max(q,0.0), min(max(q.x,max(q.y,q.z)),0.0) );
            }

            vec2 opRepeat(vec2 pos, vec2 repeat) {
                return mod(pos + repeat, repeat * 2.) - repeat;
            }
            vec3 opRepeat(vec3 pos, vec3 repeat) {
                return mod(pos + repeat, repeat * 2.) - repeat;
            }
            vec4 opElongateFast(vec3 p, vec3 h) {
                return vec4(p-clamp(p,-h,h), 0.0);
            }
            float sdSphere(vec3 p, float size) {
                return length(p) - size;
            }
            float sdGround(vec3 p) {
                return p.y;
            }
            float sdPlane(vec3 p, vec3 n, float w) {
                return dot(p, n) + w;
            }
            float sdBox(vec3 p, vec3 b) {
                vec3 d = abs(p) - b;
                return length(max(d, 0.0))
                + min(max(d.x, max(d.y, d.z)), 0.0);// remove this line for an only partially signed sdf
            }
            float sdBoxPart(vec3 p, vec3 b) {
                vec3 d = abs(p) - b;
                return length(max(d, 0.0));
            }
            float sdRoundBox(vec3 p, vec3 b, float r) {
                vec3 d = abs(p) - b;
                return length(max(d, 0.0)) - r
                + min(max(d.x, max(d.y, d.z)), 0.0);// remove this line for an only partially signed sdf 
            }
            float sdRoundBoxPart(vec3 p, vec3 b, float r) {
                vec3 d = abs(p) - b;
                return length(max(d, 0.0)) - r;
            }
            float sdTorus(vec3 p, vec2 t) {
                vec2 q = vec2(length(p.xz)-t.x, p.y);
                return length(q)-t.y;
            }
            float sdCappedTorus(vec3 p, vec2 sc, float ra, float rb) {
                p.x = abs(p.x);
                float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy, sc) : length(p.xy);
                return sqrt(dot(p, p) + ra*ra - 2.0*ra*k) - rb;
            }
            float sdCone(vec3 p, vec2 c) {
                // c must be normalized
                float q = length(p.xy);
                return dot(c, vec2(q, p.z));
            }

            float sdOctahedron(vec3 p, float s) {
                p = abs(p);
                return (p.x+p.y+p.z-s)*0.57735027;
            }
            float sdHexPrism(vec3 p, vec2 h) {
                const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
                p = abs(p);
                p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
                vec2 d = vec2(
                   length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x), h.x))*sign(p.y-h.x),
                   p.z-h.y );
                return min(max(d.x,d.y),0.0) + length(max(d,0.0));
            }
            float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
                vec3 pa = p - a, ba = b - a;
                float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
                return length(pa - ba*h) - r;
            }
            float sdVerticalCapsule(vec3 p, float h, float r) {
                p.y -= clamp(p.y, 0.0, h);
                return length(p) - r;
            }
            float sdMandelbulb(vec3 pos, float Bailout, float Power) {
                vec3 z = pos;
                float dr = 1.0;
                float r = 0.0;
                for (int i = 0; i < 5 ; i++) {
                    r = length(z);
                    if (r>Bailout) break;
 
                    // convert to polar coordinates
                    float theta = acos(z.z/r);
                    float phi = atan(z.y,z.x);
                    dr =  pow( r, Power-1.0)*Power*dr + 1.0;

                    // scale and rotate the point
                    float zr = pow( r,Power);
                    theta = theta*Power;
                    phi = phi*Power;

                    // convert back to cartesian coordinates
                    z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
                    z+=pos;
                }
                return 0.5*log(r)*r/dr;
            }
            float sdSerpit(vec3 z) {
                vec3 a1 = vec3(1,1,1);
                vec3 a2 = vec3(-1,-1,1);
                vec3 a3 = vec3(1,-1,-1);
                vec3 a4 = vec3(-1,1,-1);
                vec3 c;
                float Scale = 2.;

                float dist, d;
                int i = 0;
                for (int n = 0; n < 8; n++) {
                    c = a1; 
                    dist = length(z-a1);
                    d = length(z-a2); if (d < dist) { c = a2; dist=d; }
                    d = length(z-a3); if (d < dist) { c = a3; dist=d; }
                    d = length(z-a4); if (d < dist) { c = a4; dist=d; }
                    z = Scale*z-c*(Scale-1.0);
                    i = n;
                }
                return length(z) * pow(Scale, float(-i));
            }
            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            HitObject sdf(vec3 p) {
                float t = time * .0001;
                float noise = Value4D(vec4(p, t));

                HitObject hitObject;
                hitObject.distance = MAX_DIST;
                hitObject.material = vec4(1.);

                ${componentsSdf}

                return hitObject;
            }

            HitObject rayMarch(vec3 rayOrigin, vec3 rayDirection) {
                HitObject hitObject;
                hitObject.distance = 0.;
                hitObject.material = vec4(1.);
                HitObject obj;
                for (int i = 0; i < MAX_STEPS; i++) {
                    obj = sdf(rayOrigin + rayDirection * hitObject.distance);
                    hitObject.distance += obj.distance;
                    if (hitObject.distance > MAX_DIST || obj.distance < SURF_DIST) {
                        break;
                    }
                }
                hitObject.material = obj.material;
                return hitObject;
            }

            vec3 getNormal(vec3 point) {
                float distance = sdf(point).distance;
                vec2 offset = vec2(.01, 0);
                vec3 normal = distance - vec3(
                    sdf(point - offset.xyy).distance,
                    sdf(point - offset.yxy).distance,
                    sdf(point - offset.yyx).distance
                );
                return normalize(normal);
            }

            float specularLight(vec3 normal, vec3 lightDir) {
                vec3 h = normalize(normal + lightDir);
                return pow(max(dot(h, normal), 0.0), 8.0);
            }

            // https://www.shadertoy.com/view/lsKcDD
            float softShadow(vec3 ro,  vec3 rd, float tmin, float tmax, float k) {
                float res = 1.0;

                float t = tmin;
                for (int i = 0; i < 32; i++) { 
                    float h = sdf(ro + rd * t).distance;
                    res = min(res, k*h/t);
                    t += h;
                    if (res < 0.01 || t > tmax ) {
                        break;
                    }
                }
                return clamp(res, 0., 1.);
            }

            const float aoIntensity = .02;
            const float aoIterations = 25.;
            const float aoStepSize = .1;
            float ambientOcclusion(vec3 position, vec3 normal) {
                float step = aoStepSize;
                float ao = 0.;
                float dist;
                for(float i = 1.; i < aoIterations; i++) {
                    dist = step * i;
                    ao += max(0., dist - sdf(position + normal * dist).distance / dist);
                }
                return 1. - ao * aoIntensity;
            }

            vec4 getColor(vec3 ray) {
                HitObject hitObject = rayMarch(rayOrigin, ray);
                vec3 rayColor = 1.-normalize(ray);
                if (hitObject.distance >= MAX_DIST) {
                    // Background
                    return vec4( rayColor, 1.);
                }

                vec3 point = rayOrigin + ray * hitObject.distance;
                vec3 normal = getNormal(point);

                vec3 lightPos = vec3(-0, 15, 10.);

                vec3 lightDir = lightPos - point;
                float lightDist = length(lightDir);
                lightDir = normalize(lightDir);

                float diffuse = clamp(dot(normal, lightDir), 0., 1.);
                float specular = specularLight(normal, lightDir);

                float t = sin(time*.005);
                float shadow = softShadow(point, lightDir, .01, 40., 50.);
                float ao = ambientOcclusion(point, normal);

                float d = rayMarch(point + normal*SURF_DIST*2., lightDir).distance;
                if (d < lightDist) {
                    // Hard shadow
                   diffuse = shadow*.1;
                }

                vec3 lightCol = vec3(diffuse*specular*shadow*ao);

                // Gamma correction
                lightCol = pow(lightCol, vec3(1.0 / 2.2));

                vec4 col = hitObject.material*vec4(lightCol, 1.);

                return col;
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - .5 * resolution.xy) / resolution.y;

                vec3 forward = normalize(rayDirection);
                vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                vec3 up = normalize(cross(forward, right));
                mat3 cam = mat3(right, up, forward);

                float screenDistance = .6;
                vec3 screenPosition = vec3(uv, screenDistance);
                vec3 ray = cam * normalize(screenPosition);

                gl_FragColor = getColor(ray);
            }
        `;
    },
});
