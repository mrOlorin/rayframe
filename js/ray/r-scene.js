AFRAME.registerComponent("r-scene", {
    schema: {
        maxSteps: {default: 128},
        maxDist: {default: 1000.},
        fog: {default: 100.},
        plankLength: {default: .0001},
        screenDistance: {default: .6}
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
        window.addEventListener("resize", () => {
            this.mesh.material.uniforms.resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
        });
    },
    initMaterial: function() {
        return new THREE.ShaderMaterial({
            vertexShader: `
				precision highp float;
				uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;
                void main() {
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
        let declarations = "";
        let positions = "";
        let calls = "";
        let i = 1;
        for(const objEl of this.el.querySelectorAll("[r-thing]")) {
            const name = "thing" + i++;
            const obj = objEl.components["r-thing"];
            declarations += `
                float sdf_${name}(vec3 p) {
                    ${obj.data.distance}
                }
                Material mat_${name}(vec3 p) {
                    ${obj.data.material}
                }
                float blend_${name}(float d1, float d2) {
                    ${obj.data.distanceBlend}
                }
                Material blend_${name}(float d1, float d2, Material m1, Material m2) {
                    ${obj.data.materialBlend}
                }
            `;
            const pos = objEl.getAttribute("position");
            positions += `
                vec3 pos_${name} = vec3(${pos.x}, ${pos.y}, ${pos.z});
            `;
            calls += `
                float d_${name} = sdf_${name}(p - pos_${name});

                Material m_${name} = mat_${name}(p);
                hitObject.mat = blend_${name}(hitObject.distance, d_${name}, hitObject.mat, m_${name});

                hitObject.distance = blend_${name}(hitObject.distance, d_${name});
            `;
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
                Material mat;
            };

            mat2 rotationMatrix(float a) {
                float s = sin(a);
                float c = cos(a);
                return mat2(c, -s, s, c);
            }

            float opSmoothUnion(float d1, float d2, float k) {
                float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) - k * h * (1.0 - h);
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
            float opSmoothSubtraction(float d1, float d2, float k) {
                float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
                return mix(d2, -d1, h) + k * h * (1.0 - h);
            }

            float opIntersection(float d1, float d2) {
                return max(d1, d2);
            }
            HitObject opIntersection(HitObject o1, HitObject o2) {
                if (o1.distance >= o2.distance) {
                    return o1;
                } else {
                    return o2;
                }
            }
            float opSmoothIntersection(float d1, float d2, float k) {
                float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) + k * h * (1.0 - h);
            }

            float sdHexPrism(vec3 p, vec2 h) {
                const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
                p = abs(p);
                p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
                vec2 d = vec2(
                   length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y-h.x),
                   p.z-h.y );
                return min(max(d.x,d.y),0.0) + length(max(d,0.0));
            }

            ${declarations}

            HitObject sdf(vec3 p) {
                HitObject hitObject;
                hitObject.distance = MAX_DIST;
                hitObject.mat = Material(vec3(1.), 1., 1., 1., 0., 0.);
                ${positions}
                ${calls}
                return hitObject;
            }

            HitObject rayMarch(vec3 rayOrigin, vec3 rayDirection) {
                HitObject hitObject;
                hitObject.distance = 0.;
                HitObject obj;
                for (int i = 0; i < MAX_STEPS; i++) {
                    obj = sdf(rayOrigin + rayDirection * hitObject.distance);
                    hitObject.distance += obj.distance;
                    if (hitObject.distance > MAX_DIST) {
                        break;
                    }
                    if(obj.distance < PLANK_LENGTH) {
                        break;
                    }
                }
                hitObject.mat = obj.mat;
                return hitObject;
            }

            vec3 getNormal(vec3 point) {
                float distance = sdf(point).distance;
                vec2 offset = vec2(.1, 0);
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

            vec3 blend(vec3 color, vec3 blendColor, float blendAmount) {
                return color * (1. - blendAmount) + blendColor * blendAmount;
            }
            vec3 reflectRay(vec3 direction, vec3 normal) {
                return 2. * dot(-direction, normal) * normal + direction;
            }

            float softShadow(vec3 point, vec3 lightDir, float lightDist) {
                point += lightDir * .1;
                float totalDist = .1;
                float res = 1.;
                for (int i = 0; i < 64; i++) {
                    HitObject obj = sdf(point);
                    if (obj.distance < PLANK_LENGTH) {
                        return 0.;
                    }
                    res = min(res, obj.distance / (totalDist * .001));
                    totalDist += obj.distance;
                    if (totalDist > 12.) {
                        break;
                    }
                    point += lightDir * obj.distance;
                }
                return res;
            }

            // https://www.shadertoy.com/view/wd2SWD
            float calcAO(vec3 p, vec3 n) {
              float k = 1.;
              float occ = 0.;
              for(int i = 0; i < 5; i++) {
                float len = .15 * (float(i) + 1.);
                HitObject obj = sdf(n * len + p);
                float distance = obj.distance;
                occ += (len - distance) * k;
                k *= .5;
              }
              return clamp(1. - occ, 0., 1.);
            }

            // https://www.youtube.com/watch?v=TnhM0xc_zFc
            vec3 phongLighting(vec3 point, Material mat, vec3 direction) {
                vec3 normal = getNormal(point);
                vec3 lightPos = vec3(2. * sin(time * .0001), 3, 2. * cos(time * .0001));
                vec3 lightDir = lightPos - point;
                float lightDist = length(lightDir);
                lightDir = normalize(lightDir);
                float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                vec3 reflectedRay = reflectRay(direction, normal);
                float specular = max(0., mat.specular * dot(lightDir, reflectedRay));
                specular = pow(specular, mat.shininess);
                float shadow = softShadow(point, lightDir, lightDist);
                float ao = calcAO(point, normal);
                shadow *= ao;
                return (mat.ambient + diffuse * shadow) * pow(mat.color, gammaCorrection) + specular * shadow * vec3(1.);
            }

            vec3 reflections(vec3 color, vec3 point, Material mat, vec3 direction) {
                float reflectionAmount = mat.reflection;
                for (int i = 0; i < 5; i++) {
                    if (reflectionAmount <= 0.01) {
                        return color;
                    }
                    vec3 normal = getNormal(point);
                    direction = reflectRay(direction, normal);
                    point += .1 * direction;
                    HitObject obj = rayMarch(point, direction);
                    if (obj.distance <= MAX_DIST) {
                        point = point + direction * obj.distance;
                        vec3 reflectionColor = phongLighting(point, obj.mat, direction);
                        color = blend(color, reflectionColor, reflectionAmount);
                        reflectionAmount *= obj.mat.reflection;
                    } else {
                        return blend(color, vec3(0.), reflectionAmount);
                    }
                }
                return color;
            }

            vec3 getColor(vec3 ray) {
                HitObject hitObject = rayMarch(rayOrigin, ray);
                vec3 backgroundColor = 1. - normalize(ray);
                if (hitObject.distance >= MAX_DIST) {
                    // Background
                    return backgroundColor;
                }

                vec3 point = rayOrigin + ray * hitObject.distance;

                vec3 color = phongLighting(point, hitObject.mat, ray);
                color = reflections(color, point, hitObject.mat, ray);

                // Fog
                color = blend(color, vec3(1.), hitObject.distance / FOG);
                //color = pow(color, gammaCorrection);

                return color;
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy - .5 * resolution.xy) / resolution.y;

                vec3 forward = normalize(rayDirection);
                vec3 right = normalize(cross(vec3(0., 1., 0.), forward));
                vec3 up = normalize(cross(forward, right));
                mat3 cam = mat3(right, up, forward);

                vec3 screenPosition = vec3(uv, float(${this.data.screenDistance}));
                vec3 ray = cam * normalize(screenPosition);

                gl_FragColor = vec4(getColor(ray), 1.);
            }
        `;
    },
});
AFRAME.registerComponent("r-thing", {
    schema: {
        distance: {},
        material: {default: `
            Material m;
            m.color = vec3(1,1,1);
            m.diffuse = .2;
            m.specular = .01;
            m.ambient = .5;
            m.shininess = 1.;
            m.reflection = 0.;
            return m;
        `},
        distanceBlend: {default: `
            return min(d1, d2);
        `},
        materialBlend: {default: `
            if (d1 <= d2) {
                return m1;
            } else {
                return m2;
            }
        `},
    },
});
AFRAME.registerComponent("r-material", {
    schema: {
        color: {type: "vec3", default: new THREE.Vector3()},
        diffuse: {default: .5},
        specular: {default: .02},
        ambient: {default: .2},
        shininess: {default: 0.},
        reflection: {default: 0.},
        custom: {type: "string"},
    },
    update: function() {
        let material;
        if(this.data.custom) {
            material = this.data.custom;
        } else {
            const dot = (str) => {
                if (!("" + str).includes(".")) {
                    str += ".";
                }
                return str;
            };
            const color = `vec3(${dot(this.data.color.x)},${dot(this.data.color.y)},${dot(this.data.color.z)})`;
            const diffuse = dot(this.data.diffuse);
            const specular = dot(this.data.specular);
            const ambient = dot(this.data.ambient);
            const shininess = dot(1 - this.data.shininess);
            const reflection = dot(this.data.reflection);
            material = `
                Material m;
                m.color = ${color};
                m.diffuse = ${diffuse};
                m.specular = ${specular};
                m.ambient = ${ambient};
                m.shininess = ${shininess};
                m.reflection = ${reflection};
                return m;
            `;
        }
        this.el.setAttribute("r-thing", {material});
    },
});