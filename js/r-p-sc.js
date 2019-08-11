AFRAME.registerComponent("r-p-sc", {
    init: function() {
        this.PARTICLE_SIZE = 1;
        const vertices = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4).vertices;
        const positions = new Float32Array(vertices.length * 3);
        const colors = new Float32Array(vertices.length * 3);
        const sizes = new Float32Array(vertices.length);
        const color = new THREE.Color();
        for (let i = 0, length = vertices.length, vertex; i < length; i++) {
            vertex = vertices[i];
            vertex.toArray(positions, i * 3);
            //color.setHSL(0.01 + 0.1 * (i / length), 1.0, 0.5);
            color.toArray(colors, i * 3);
            sizes[i] = this.PARTICLE_SIZE;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: {value: new THREE.Color(0xffffff)},
                rayOrigin: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                rayDirection: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                time: {type: "f", value: 0.},
            },
            vertexShader: `
                attribute float size;
                attribute vec3 customColor;
                varying vec3 vColor;
                uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;
                varying mat3 cam;
                void main() {
                    vColor = customColor;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;

                    vec3 rayDirection = vec3(0, 0, -1);
                    vec3 forward = normalize(rayDirection);
                    vec3 right = normalize(cross(vec3(0., -1., 0.), forward));
                    vec3 up = normalize(cross(forward, right));
                    cam = mat3(right, up, forward);
                }
            `,
            fragmentShader: `
                #define MAX_STEPS 256
                #define MAX_DIST 100.
                #define PLANK_LENGTH .0001
                #define FOG 100.

                uniform vec3 color;
                uniform float time;
                uniform vec3 rayOrigin;
                uniform vec3 rayDirection;
                varying mat3 cam;
                varying vec3 vColor;

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

                HitObject sdf(vec3 p) {
                    HitObject hitObject;

                    if(gl_PointCoord.x < .5) {
                        hitObject.distance = MAX_DIST;
                    } else {
                        vec3 k = vec3(-0.8660254, 0.5, 0.57735);
                        vec2 h = vec2(.1);
                        p = abs(p-vec3(0, 0, -.5));
                        p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
                        vec2 d = vec2(
                           length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
                           p.z - h.y
                        );
                        hitObject.distance = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
                    }
                    //hitObject.distance = length(p-vec3(0, 0, -3)) - 1.;
                    hitObject.mat = Material(vec3(1.), 1., 1., 1., 1., 0.);

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
                vec3 blend(vec3 color, vec3 blendColor, float blendAmount) {
                    return color * (1. - blendAmount) + blendColor * blendAmount;
                }
                vec3 reflectRay(vec3 direction, vec3 normal) {
                    return 2. * dot(-direction, normal) * normal + direction;
                }
                const vec3 gammaCorrection = vec3(1.0 / 2.2);
                vec3 phongLighting(vec3 point, Material mat, vec3 ray) {

                    vec3 normal = getNormal(point);
        
                    vec3 lightPos = vec3(0, 3, 0);
                    vec3 lightDir = normalize(lightPos - point);
                    float diffuse = max(0., mat.diffuse * dot(normal, lightDir));
                    return vec3(diffuse);//vec3(0,0,.4);
                    vec3 reflectedRay = reflectRay(ray, normal);
                    float specular = max(0., mat.specular * dot(lightDir, reflectedRay));
                    specular = pow(specular, mat.shininess);
                    return (mat.ambient + diffuse) * pow(mat.color, gammaCorrection) + specular * vec3(1.);
                }
        
                vec3 getColor(vec3 rayOrigin, vec3 ray) {
                    HitObject hitObject = rayMarch(rayOrigin, ray);
                    //vec3 fogColor = vec3(1.);
        
                    if (hitObject.distance >= MAX_DIST || hitObject.distance >= FOG) {
                        discard;//return fogColor;
                    }
        
                    vec3 point = rayOrigin + ray * hitObject.distance;
        
                    vec3 color = phongLighting(point, hitObject.mat, ray);
        
                    // Fog
                    //color = blend(color, fogColor, hitObject.distance / FOG);
                    return color;
                }

                void main() {
                    vec3 screenPosition = vec3(gl_PointCoord - .7, .6);
                    vec3 ray = cam * normalize(screenPosition);

                    gl_FragColor = vec4(getColor(rayOrigin, ray), 1.);
                    // if (gl_FragColor.a < ALPHATEST) discard;
                }
            `,
            alphaTest: 0.9
        });

        this.mesh = new THREE.Points(geometry, material);
        this.mesh.onBeforeRender = this.onBeforeRender.bind(this);

        this.el.setObject3D("mesh", this.mesh);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        document.addEventListener("mousemove", this.onMouseMove.bind(this), false);
        this.INTERSECTED = null;
    },
    rayOrigin: new THREE.Vector3(0., 0., 0.),
    rayDirection: new THREE.Vector3(0., 0., 0.),
    uglyFix: new THREE.Vector3(-1., 1., 1.),
    onBeforeRender: function(renderer, scene, camera) {
        this.mesh.material.uniforms.time.value = performance.now();
        this.mesh.material.uniforms.rayOrigin.value.copy(this.rayOrigin.multiply(this.uglyFix));
        this.mesh.material.uniforms.rayDirection.value.copy(this.rayDirection.multiply(this.uglyFix));

        this.raycaster.setFromCamera(this.mouse, camera);
        const intersects = this.raycaster.intersectObject(this.mesh);
        const attributes = this.mesh.geometry.attributes;

        if ( intersects.length > 0 ) {
            if ( this.INTERSECTED != intersects[ 0 ].index ) {
                attributes.size.array[ this.INTERSECTED ] = this.PARTICLE_SIZE;
                this.INTERSECTED = intersects[ 0 ].index;
                attributes.size.array[ this.INTERSECTED ] = this.PARTICLE_SIZE * 1.25;
                attributes.size.needsUpdate = true;
            }
        } else if ( this.INTERSECTED !== null ) {
            attributes.size.array[ this.INTERSECTED ] = this.PARTICLE_SIZE;
            attributes.size.needsUpdate = true;
            this.INTERSECTED = null;
        }
    },
    onMouseMove: function(event) {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },
    tick: function() {
        //this.mesh.rotation.x += 0.0005;
        //this.mesh.rotation.y += 0.001;
    },
});
