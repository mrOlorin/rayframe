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
        const geometry = this.initGeometry();
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.onBeforeRender = this.onBeforeRender.bind(this);
        this.el.setObject3D("mesh", this.mesh);
        window.addEventListener("resize", () => {
            this.mesh.material.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        });
    },
    initGeometry: function() {
        const geometry = new THREE.BoxBufferGeometry(this.data.size.x, this.data.size.y, this.data.size.z);
        this.things = new Float32Array(1e6);
        geometry.addAttribute('things', new THREE.BufferAttribute(this.things, 3));
        return geometry;
    },
    initMaterial: function() {
        return new THREE.ShaderMaterial({
            vertexShader: `
				precision highp float;
				uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;
                varying mat3 cam;
                void main() {
                    vec3 forward = normalize(rayDirection);
                    vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                    vec3 up = normalize(cross(forward, right));
                    cam = mat3(right, up, forward);
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
                float ${prefix}distance(vec3 p) {
                    ${obj.data.modifiers}
                    ${obj.data.distance}
                }
                Material ${prefix}material(vec3 p) {
                    ${obj.data.modifiers}
                    ${obj.data.material}
                }
                float ${prefix}blend(float d1, float d2) {
                    ${obj.data.distanceBlend}
                }
                Material ${prefix}blend(float d1, float d2, Material m1, Material m2) {
                    ${obj.data.materialBlend}
                }
            `);

            distanceCalls.push(`d = ${prefix}blend(d, ${prefix}distance(p));`);

            materialCalls.push(`float ${prefix}d = ${prefix}distance(p);`);
            materialCalls.push(`m = ${prefix}blend(d, ${prefix}d, m, ${prefix}material(p));`);
            materialCalls.push(`d = ${prefix}blend(d, ${prefix}d);`);
        }

        return `
            // http://iquilezles.org/www/articles/distfunctions/distfunctions.htm
            #define MAX_STEPS ${this.data.maxSteps}
            #define MAX_DIST float(${this.data.maxDist})
            #define PLANK_LENGTH ${this.data.plankLength}
            #define FOG float(${this.data.fog})

            precision highp float;

            uniform float time;
            uniform vec2 resolution;
            uniform vec3 rayOrigin;
            uniform vec3 rayDirection;

            varying mat3 cam;

            const vec3 gammaCorrection = vec3(1.0 / 2.2);

            struct Material {
                vec3 color;
                float diffuse;
                float specular;
                float ambient;
                float shininess;
                float reflection;
            };

            struct HitObject {
                float distance;
                Material material;
            };

            ${declarations.join(`
            `)}

            float getDistance(vec3 p) {
                float d = MAX_DIST;
                ${distanceCalls.join(`
                `)}
                return d;
            }

            Material getMaterial(vec3 p) {
                float d = MAX_DIST;
                Material m;
                ${materialCalls.join(`
                `)}
                return m;
            }

            HitObject rayMarch(vec3 rayOrigin, vec3 rayDirection) {
                HitObject obj;
                HitObject hitObject;
                float d;
                vec3 p;
                for (int i = 0; i < MAX_STEPS; i++) {
                    p = rayOrigin + rayDirection * hitObject.distance;
                    d = getDistance(p);
                    hitObject.distance += d;;
                    if (hitObject.distance > MAX_DIST) {
                        break;
                    }
                    if(d < PLANK_LENGTH) {
                        break;
                    }
                }

                hitObject.material = getMaterial(rayOrigin + rayDirection * hitObject.distance);
                return hitObject;
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

            float specularLight(vec3 normal, vec3 lightDir) {
                vec3 h = normalize(normal + lightDir);
                return pow(max(dot(h, normal), 0.0), 8.0);
            }

            // https://www.youtube.com/watch?v=TnhM0xc_zFc
            vec3 blend(vec3 color, vec3 blendColor, float blendAmount) {
                return color * (1. - blendAmount) + blendColor * blendAmount;
            }
            vec3 reflectRay(vec3 direction, vec3 normal) {
                return 2. * dot(-direction, normal) * normal + direction;
            }
            float softShadow(vec3 point, vec3 lightDir) {
                point += lightDir * .1;
                float totalDist = .1;
                float result = 1.;
                float d;
                for ( int i = 0; i < 64; i ++ ) {
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
                vec3 normal = getNormal(point);
                float t = time * .0001;
                vec3 lightPos = vec3(sin(t), 3.+sin(t*.5), cos(t*1.5));
                vec3 lightDir = normalize(lightPos - point);
                float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                vec3 reflectedRay = reflectRay(ray, normal);
                float specular = max(0., mat.specular * dot(lightDir, reflectedRay));
                specular = pow(specular, mat.shininess);
                float shadow = softShadow(point, lightDir);
                float ao = calcAO(point, normal);
                shadow *= ao;
                return (mat.ambient + diffuse * shadow) * pow(mat.color, gammaCorrection) + specular * shadow * vec3(1.);
            }

            vec3 reflections(vec3 color, vec3 point, Material mat, vec3 ray) {
                float reflectionAmount = mat.reflection;
                vec3 normal;
                HitObject obj;
                vec3 reflectionColor;
                for ( int i = 0; i < 5; i ++ ) {
                    if (reflectionAmount <= 0.01) return color;
                    normal = getNormal(point);
                    ray = reflectRay(ray, normal);
                    point += .1 * ray;
                    obj = rayMarch(point, ray);
                    if (obj.distance > MAX_DIST) return blend(color, vec3(0.), reflectionAmount);
                    point = point + ray * obj.distance;
                    reflectionColor = phongLighting(point, obj.material, ray);
                    color = blend(color, reflectionColor, reflectionAmount);
                    reflectionAmount *= obj.material.reflection;
                }
                return color;
            }

            vec3 getColor(vec3 ray) {
                HitObject hitObject = rayMarch(rayOrigin, ray);
                vec3 fogColor = vec3(1.);
                if (hitObject.distance >= MAX_DIST || hitObject.distance >= FOG) {
                    return fogColor;
                }

                vec3 point = rayOrigin + ray * hitObject.distance;

                vec3 color = phongLighting(point, hitObject.material, ray);
                color = reflections(color, point, hitObject.material, ray);

                // Fog
                color = blend(color, fogColor, hitObject.distance / FOG);

                return color;
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - .5 * resolution.xy) / resolution.y;
                vec3 screenPosition = vec3(uv, float(${this.data.screenDistance}));
                vec3 ray = cam * normalize(screenPosition);
                gl_FragColor = vec4(getColor(ray), 1.);
            }
        `;
    },
});
AFRAME.registerComponent("r-thing", {
    // https://www.youtube.com/watch?v=s8nFqwOho-s
    schema: {
        modifiers: {},
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
        preDistance: {
            default: ``,
        },
        postDistance: {
            default: ``,
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
