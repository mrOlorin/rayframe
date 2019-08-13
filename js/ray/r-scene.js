AFRAME.registerComponent("r-scene", {
    schema: {
        size: {type: "vec3", default: new THREE.Vector3(1e4, 1e4, 1e4)},
        maxSteps: {default: 256},
        maxDist: {default: 100.},
        fog: {default: 100.},
        plankLength: {default: .0001},
        screenDistance: {default: .6},
    },
    rayOrigin: new THREE.Vector3(0., 0., 0.),
    rayDirection: new THREE.Vector3(0., 0., 0.),
    uglyFix: new THREE.Vector3(-1., 1., 1.),
    init: function() {
        const fail = (![] + [])[+[]] + (![] + [])[+!+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]];
        const material = this.initMaterial();
        const geometry = new THREE.BoxBufferGeometry(this.data.size.x, this.data.size.y, this.data.size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = this.onBeforeRender.bind(this);
        this.el.setObject3D("mesh", this.mesh);
        window.addEventListener("resize", () => {
            this.mesh.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        });
    },
    initMaterial: function() {
        return new THREE.ShaderMaterial({
            vertexShader: `
				precision highp float;
				uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;
                varying mat3 camera;
                void main() {
                    vec3 forward = normalize(rayDirection);
                    vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                    vec3 up = normalize(cross(forward, right));
                    camera = mat3(right, up, forward);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(vec3(position), 1.0);
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
    buildFragmentShader: function() {
        const declarations = [];
        const distanceCalls = [];
        const materialCalls = [];
        let i = 1;

        const things = this.el.querySelectorAll("[r-thing]");
        for (const objEl of things) {
            const obj = objEl.components["r-thing"];
            const prefix = `thing${i++}_`;

            declarations.push(`
                vec3 ${prefix}modify(vec3 p) {
                    ${obj.data.modifiers}
                    return p;
                }
                float ${prefix}distance(vec3 p) {
                    ${obj.data.distance}
                }
                Material ${prefix}material(vec3 p) {
                    ${obj.data.material}
                }
                float ${prefix}blend(float d1, float d2) {
                    ${obj.data.distanceBlend}
                }
                Material ${prefix}blend(float d1, float d2, Material m1, Material m2) {
                    ${obj.data.materialBlend}
                }
            `);

            distanceCalls.push(`d = ${prefix}blend(d, ${prefix}distance(${prefix}modify(p)));`);
            // Буэ
            materialCalls.push(`tmpP = ${prefix}modify(p);`,
                               `tmpD = ${prefix}distance(tmpP);`,
                               `m = ${prefix}blend(d, tmpD, m, ${prefix}material(tmpP));`,
                               `d = ${prefix}blend(d, tmpD);`,
                               `if(d <= PLANK_LENGTH) return m;`);
        }

        return `
            #define MAX_STEPS ${this.data.maxSteps}
            #define MAX_DIST float(${this.data.maxDist})
            #define PLANK_LENGTH float(${this.data.plankLength})
            #define FOG float(${this.data.fog})
            #define SCREEN_DIST float(${this.data.screenDistance})

            precision highp float;

            uniform float time;
            uniform vec2 resolution;
            uniform vec3 rayOrigin;
            uniform vec3 rayDirection;

            varying mat3 camera;

            const vec3 gammaCorrection = vec3(1.0 / 2.2);

            struct Material {
                vec3 color;
                float diffuse;
                float specular;
                float ambient;
                float shininess;
                float reflection;
                float refraction;
            };

            struct HitObject {
                float distance;
                Material material;
            };

            float Cellular2D( vec2 P )
            {
                //  https://github.com/BrianSharpe/Wombat/blob/master/Cellular2D.glsl

                //  establish our grid cell and unit position
                vec2 Pi = floor(P);
                vec2 Pf = P - Pi;

                //  calculate the hash
                vec4 Pt = vec4( Pi.xy, Pi.xy + 1.0 );
                Pt = Pt - floor(Pt * ( 1.0 / 71.0 )) * 71.0;
                Pt += vec2( 26.0, 161.0 ).xyxy;
                Pt *= Pt;
                Pt = Pt.xzxz * Pt.yyww;
                vec4 hash_x = fract( Pt * ( 1.0 / 951.135664 ) );
                vec4 hash_y = fract( Pt * ( 1.0 / 642.949883 ) );

                //  generate the 4 points
                hash_x = hash_x * 2.0 - 1.0;
                hash_y = hash_y * 2.0 - 1.0;
                const float JITTER_WINDOW = 0.25;   // 0.25 will guarentee no artifacts
                hash_x = ( ( hash_x * hash_x * hash_x ) - sign( hash_x ) ) * JITTER_WINDOW + vec4( 0.0, 1.0, 0.0, 1.0 );
                hash_y = ( ( hash_y * hash_y * hash_y ) - sign( hash_y ) ) * JITTER_WINDOW + vec4( 0.0, 0.0, 1.0, 1.0 );

                //  return the closest squared distance
                vec4 dx = Pf.xxxx - hash_x;
                vec4 dy = Pf.yyyy - hash_y;
                vec4 d = dx * dx + dy * dy;
                d.xy = min(d.xy, d.zw);
                return min(d.x, d.y) * ( 1.0 / 1.125 ); // return a value scaled to 0.0->1.0
            }

            // Declarations
            ${declarations.join(`
            `)}

            // http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
            float getDistance(vec3 p) {
                float d = MAX_DIST;
                // DistanceCalls
                ${distanceCalls.join(`
                `)}
                return d;
            }

            Material getMaterial(vec3 p) {
                float d = MAX_DIST;
                vec3 tmpP;
                float tmpD;
                Material m;
                // MaterialCalls
                ${materialCalls.join(`
                `)}
                return m;
            }

            HitObject rayMarch(vec3 rayOrigin, vec3 rayDirection) {
                HitObject result;
                result.distance = PLANK_LENGTH;
                float d;
                for (int i = 0; i < MAX_STEPS; i++) {
                    d = getDistance(rayOrigin + rayDirection * result.distance);
                    result.distance += d;;
                    if (result.distance > MAX_DIST || d < PLANK_LENGTH) {
                        break;
                    }
                }
                result.material = getMaterial(rayOrigin + rayDirection * result.distance);
                return result;
            }

            vec3 getNormal(vec3 point) {
                float distance = getDistance(point);
                vec2 offset = vec2(.1, 0);
                vec3 normal = distance - vec3(
                    getDistance(point - offset.xyy),
                    getDistance(point - offset.yxy),
                    getDistance(point - offset.yyx)
                );
                return normalize(normal);
            }

            // https://www.youtube.com/watch?v=TnhM0xc_zFc
            vec3 blend(vec3 color, vec3 blendColor, float blendAmount) {
                return color * (1. - blendAmount) + blendColor * blendAmount;
            }
            float softShadow(vec3 point, vec3 lightDir) {
                point += lightDir * .1;
                float totalDist = .1;
                float result = 1.;
                float d;
                for ( int i = 0; i < 32; i ++ ) {
                    d = getDistance(point);
                    if (d <= PLANK_LENGTH) return 0.;
                    result = min(result, d / (totalDist * .001));
                    totalDist += d;
                    if (totalDist > 10.) return result;
                    point += lightDir * d;
                }
                return result;
            }

            // https://www.shadertoy.com/view/wd2SWD
            float calcAO(vec3 p, vec3 n) {
                float k = 1.;
                float occ = 0.;
                float len;
                int j = 0;
                for ( int i = 0; i < 5; i ++ ) {
                    len = .15 * (float(j++) + 1.);
                    occ += (len - getDistance(n * len + p)) * k;
                    k *= .5;
                }
                return clamp(1. - occ, 0., 1.);
            }

            vec3 phongLighting(vec3 point, Material mat, vec3 ray) {
                float t = time * .0001;
                vec3 lightPos = vec3(sin(t), 2. + sin(t * .5), cos(t * 1.5));

                vec3 normal = getNormal(point);
                vec3 lightDir = normalize(lightPos - point);
                float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                vec3 reflectedRay = reflect(ray, normal);
                float specular = max(0., mat.specular * dot(lightDir, reflectedRay));
                specular = pow(specular, mat.shininess);
                float shadow = softShadow(point, lightDir);
                float ao = calcAO(point, normal);
                shadow *= ao;
                return (mat.ambient + diffuse * shadow) * pow(mat.color, gammaCorrection) + specular * shadow * vec3(1.);
            }

            vec3 reflections(vec3 point, vec3 ray, vec3 color, float reflectionAmount) {
                HitObject obj;
                for ( int i = 0; i < 5; i ++ ) {
                    if (reflectionAmount <= 0.01) return color;
                    ray = reflect(ray, getNormal(point));
                    point += .1 * ray;
                    obj = rayMarch(point, ray);
                    if (obj.distance > MAX_DIST) return blend(color, vec3(0), reflectionAmount);
                    point = point + ray * obj.distance;
                    color = blend(color, phongLighting(point, obj.material, ray), reflectionAmount);
                    reflectionAmount *= obj.material.reflection;
                }
                return color;
            }

            vec3 refractions(vec3 point, vec3 ray, Material material) {
                ray = refract(ray, getNormal(point), material.refraction);
                float d = .01;
                float totalD;
                for ( int i = 0; i < 32; i ++ ) {
                    point += ray * d;
                    d = abs(getDistance(point));
                    if (d <= PLANK_LENGTH) {
                        break;
                    }
                    totalD += d;
                }
                point += ray * .01;
                ray =  -1. * refract(ray, getNormal(point), material.refraction);
                HitObject obj = rayMarch(point, ray);
                if (obj.distance < 0.) {
                    return vec3(0);
                }
                return blend(phongLighting(point + ray * obj.distance, obj.material, ray), material.color, totalD * .1);
            }

            vec3 getColor(vec3 ray) {
                HitObject hitObject = rayMarch(rayOrigin, ray);
                vec3 airColor = vec3(.0,.0,.03);
                if (hitObject.distance >= MAX_DIST || hitObject.distance >= FOG) {
                    return airColor;
                }
                vec3 point = rayOrigin + ray * hitObject.distance;
                vec3 color;
                color = phongLighting(point, hitObject.material, ray);
                color = reflections(point, ray, color, hitObject.material.reflection);
                if (hitObject.material.refraction > 0.) {
                    color = blend(color, refractions(point, ray, hitObject.material), .8);
                }
                color = blend(color, airColor, hitObject.distance / FOG);
                return color;
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - .5 * resolution.xy) / resolution.y;
                vec3 screenPosition = vec3(uv, SCREEN_DIST);
                vec3 ray = camera * normalize(screenPosition);
                gl_FragColor = vec4(getColor(ray), 1.);
            }
        `;
    },
});
AFRAME.registerComponent("r-thing", {
    schema: {
        modifiers: {},
        modifier: {},
        distance: {},
        material: {
            default: `
                Material m;
                m.color = vec3(1,1,1);
                m.diffuse = .2;
                m.specular = .01;
                m.ambient = .5;
                m.shininess = 1.;
                m.reflection = 0.;
                return m;
            `,
        },
        distanceBlend: {
            default: `
                return min(d1, d2);
            `,
        },
        materialBlend: {
            default: `
                if (d1 <= d2) {
                    return m1;
                } else {
                    return m2;
                }
            `,
        },
    },
    addModifier: function(modifier) {
        this.el.setAttribute("r-thing", {
            modifiers: `
                ${this.data.modifiers}
                {
                    ${modifier}
                }
            `,
        });
    },
    init: function() {
        const pos = this.el.getAttribute("position");
        if(pos.length() > 0) {
            this.addModifier(`p -= vec3(${pos.x}, ${pos.y}, ${pos.z});`);
        }
    }
});
