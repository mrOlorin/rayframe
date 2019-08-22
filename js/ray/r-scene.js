AFRAME.registerComponent("r-scene", {
    schema: {
        size: {type: "vec3", default: new THREE.Vector3(1e4, 1e4, 1e4)},
        maxSteps: {default: 256},
        fogDistance: {default: 100.},
        fogColor: {type: "vec3", default: new THREE.Vector3(.2, .2, .2)},
        plankLength: {default: .0001},
        screenDistance: {default: .6},
    },
    rayOrigin: new THREE.Vector3(0., 0., 0.),
    rayDirection: new THREE.Vector3(0., 0., 0.),
    uglyFix: new THREE.Vector3(-1., 1., 1.),
    init: function() {
        this.initControls();
        this.fail = (![] + [])[+[]] + (![] + [])[+!+[]] + ([![]] + [][[]])[+!+[] + [+[]]] + (![] + [])[!+[] + !+[]];
        const material = this.initMaterial();
        const geometry = new THREE.BoxBufferGeometry(this.data.size.x, this.data.size.y, this.data.size.z);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = this.onBeforeRender.bind(this);
        this.el.setObject3D("mesh", this.mesh);
        window.addEventListener("resize", () => {
            this.mesh.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        });
    },
    initControls: function() {
        const player = document.querySelector("#player");
        if (!player) {
            return;
        }
        player.setAttribute("q-controls", {});
        player.components["q-controls"].getDistance = this.getDistance.bind(this);
    },
    initMaterial: function() {
        this.build();
        return new THREE.ShaderMaterial({
            vertexShader: `
				precision highp float;
				uniform float time;
                uniform vec3 rayDirection;
                varying mat3 camera;
                varying vec3 lightPos;

                void main() {
                    vec3 forward = normalize(rayDirection);
                    vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                    vec3 up = normalize(cross(forward, right));
                    camera = mat3(right, up, forward);
                    float t = time * .0001;
                    lightPos = vec3(sin(t), 2. + sin(t * .5), cos(t * 1.5));
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(vec3(position), 1.0);
                }
            `,
            fragmentShader: this.fragmentShader,
            uniforms: {
                time: {type: "f", value: 0.},
                rayOrigin: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                rayDirection: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                resolution: {type: "v2", value: new THREE.Vector2(window.innerWidth, window.innerHeight)},
                positions: {type: "v3v", value: this.positions},
            },
            side: THREE.DoubleSide,
        });
    },
    getDistance: function(p) {
        let distance = this.data.fogDistance;
        for (const getDistance of this.distances) {
            distance = Math.min(distance, getDistance(p.clone()));
        }
        return distance;
    },
    onBeforeRender: function(renderer, scene, camera) {
        camera.getWorldPosition(this.rayOrigin);
        camera.getWorldDirection(this.rayDirection);
        this.mesh.material.uniforms.rayOrigin.value.copy(this.rayOrigin.multiply(this.uglyFix));
        this.mesh.material.uniforms.rayDirection.value.copy(this.rayDirection.multiply(this.uglyFix));
        this.mesh.material.uniforms.time.value = performance.now();
    },
    build: function() {
        const declarations = [];
        const distanceCalls = [];
        const materialCalls = [];
        let i = 0;

        const things = this.el.querySelectorAll("[r-thing]");
        this.positions = [];
        this.distances = [];
        for (const objEl of things) {
            const obj = objEl.components["r-thing"];
            if (objEl.getDistance) {
                this.distances.push(objEl.getDistance);
            }
            const prefix = `thing${i}_`;
            this.positions.push(objEl.getAttribute("position"));
            declarations.push(`
                vec3 ${prefix}modify(in vec3 p, in vec3 position) {
                    p -= position;
                    ${obj.data.modifiers}
                    return p;
                }
                float ${prefix}distance(in vec3 p) {
                    ${obj.data.distance}
                }
                Material ${prefix}material(in vec3 p) {
                    ${obj.data.material}
                }
                float ${prefix}blend(in float d1, in float d2) {
                    ${obj.data.distanceBlend}
                }
                Material ${prefix}blend(in float d1, in float d2, in Material m1, in Material m2) {
                    ${obj.data.materialBlend}
                }
            `);

            distanceCalls.push(`d = ${prefix}blend(d, ${prefix}distance(${prefix}modify(p, positions[${i}])));`);
            // Буэ
            materialCalls.push(
                `tmpP = ${prefix}modify(p, positions[${i}]);`,
                `tmpD = ${prefix}distance(tmpP);`,
                `m = ${prefix}blend(d, tmpD, m, ${prefix}material(tmpP));`,
                `d = ${prefix}blend(d, tmpD);`,
                `if(d <= PLANK_LENGTH) return m;`,
            );
            i++;
        }
        this.fragmentShader = `
            #define MAX_STEPS ${this.data.maxSteps}
            #define PLANK_LENGTH float(${this.data.plankLength})
            #define FOG_DIST float(${this.data.fogDistance})
            #define MAX_DIST FOG_DIST
            #define FOG_COLOR vec3(${this.data.fogColor.x}, ${this.data.fogColor.y}, ${this.data.fogColor.z})
            #define SCREEN_DIST float(${this.data.screenDistance})

            precision highp float;

            uniform float time;
            uniform vec2 resolution;
            uniform vec3 rayOrigin;
            uniform vec3 rayDirection;
            uniform vec3 positions[${this.positions.length}];

            varying mat3 camera;
            varying vec3 lightPos;

            const vec3 gammaCorrection = vec3(1.0 / 2.2);

            struct Material {
                vec3 color;
                float diffuse;
                float specular;
                float ambient;
                float shininess;
                float reflection;
                float transparency;
                float ior;
            };

            struct HitObject {
                vec3 point;
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
            float getDistance(in vec3 p) {
                float d = FOG_DIST;
                // DistanceCalls
                ${distanceCalls.join(`
                `)}
                return d;
            }

            Material getMaterial(in vec3 p) {
                float d = FOG_DIST;
                vec3 tmpP;
                float tmpD;
                Material m;
                // MaterialCalls
                ${materialCalls.join(`
                `)}
                return m;
            }

            void rayMarch(inout HitObject obj, in vec3 rayOrigin, in vec3 rayDirection, float plankLength) {
                float stepDistance;
                obj.distance = plankLength;
                for (int i = 0; i < MAX_STEPS; i++) {
                    stepDistance = abs(getDistance(rayOrigin + rayDirection * obj.distance));
                    obj.distance += stepDistance;
                    if (stepDistance < plankLength) {
                        break;
                    }
                    if (obj.distance >= FOG_DIST) {
                        break;
                    }
                }
                obj.point = rayOrigin + rayDirection * obj.distance;
            }

            vec3 getNormal(in vec3 point) {
                vec2 offset = vec2(.01, 0);
                return normalize(getDistance(point) - vec3(
                    getDistance(point - offset.xyy),
                    getDistance(point - offset.yxy),
                    getDistance(point - offset.yyx)
                ));
            }

            // https://www.youtube.com/watch?v=TnhM0xc_zFc
            vec3 blend(in vec3 color, in vec3 blendColor, in float blendAmount) {
                return color * (1. - blendAmount) + blendColor * blendAmount;
            }
            float softShadow(in vec3 point, in vec3 lightDir) {
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
            float calcAO(in vec3 p, in vec3 n) {
                float k = 1.;
                float occ = 0.;
                float len;
                for ( float i = 1.; i < 6.; i += 1. ) {
                    len = .15 * i;
                    occ += (len - getDistance(n * len + p)) * k;
                    k *= .5;
                }
                return clamp(1. - occ, 0., 1.);
            }

            vec3 phongLighting(in vec3 point, in Material mat, in vec3 ray) {
                vec3 normal = getNormal(point);
                vec3 lightDir = normalize(lightPos - point);
                float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                float specular = pow(max(0., mat.specular * dot(lightDir, reflect(ray, normal))), mat.shininess);
                float shadow = softShadow(point, lightDir) * calcAO(point, normal);
                return (mat.ambient + diffuse * shadow) * pow(mat.color, gammaCorrection) + specular * shadow * vec3(1.);
            }

            vec3 reflections(in vec3 point, in vec3 ray, in vec3 color, in float reflectionAmount) {
                HitObject obj;
                for ( int i = 0; i < 5; i ++ ) {
                    if (reflectionAmount <= 0.01) return color;
                    ray = reflect(ray, getNormal(point));
                    point += .1 * ray;
                    rayMarch(obj, point, ray, PLANK_LENGTH);
                    obj.material = getMaterial(obj.point);
                    if (obj.distance > FOG_DIST) return blend(color, vec3(0), reflectionAmount);
                    point += ray * obj.distance;
                    color = blend(color, phongLighting(point, obj.material, ray), reflectionAmount);
                    reflectionAmount *= obj.material.reflection;
                }
                return color;
            }

            vec3 refractions(in vec3 point, in vec3 ray, in Material material) {
                HitObject surface;
                vec3 normal = getNormal(point);
                ray = refract(ray, normal, 1. / material.ior);
                rayMarch(surface, point - normal * .01, ray, .001);

                normal = -getNormal(surface.point);
                ray = refract(ray, normal, 1. / material.ior);
                rayMarch(surface, surface.point - normal * .01, ray, .001);
                if (surface.distance >= FOG_DIST) {
                    return FOG_COLOR;
                }
                surface.material = getMaterial(surface.point);
                return blend(phongLighting(surface.point, surface.material, ray), FOG_COLOR, surface.distance / FOG_DIST);
            }

            vec3 getColor(in vec3 origin, in vec3 direction) {
                HitObject hitObject;
                rayMarch(hitObject, origin, direction, PLANK_LENGTH);
                if (hitObject.distance >= FOG_DIST) {
                    return FOG_COLOR;
                }
                hitObject.material = getMaterial(hitObject.point);
                vec3 color = phongLighting(hitObject.point, hitObject.material, direction);
                if (hitObject.material.transparency > 0.) {
                    color = blend(color, refractions(hitObject.point, direction, hitObject.material), hitObject.material.transparency);
                }
                if(hitObject.material.reflection > 0.) {
                    color = reflections(hitObject.point, direction, color, hitObject.material.reflection);
                }
                return blend(color, FOG_COLOR, hitObject.distance / FOG_DIST);
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - .5 * resolution.xy) / resolution.y;
                gl_FragColor = vec4(getColor(rayOrigin, normalize(camera * vec3(uv, SCREEN_DIST))), 1.);
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
});
