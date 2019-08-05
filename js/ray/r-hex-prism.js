AFRAME.registerComponent("r-hex-prism", {
    schema: {
        size: {type: "vec2", default: new THREE.Vector2(.5, .2)},
    },
    update: function() {
        const addot = (str) => {
            if(!("" + str).includes(".")) {
                str += ".";
            }
            return str;
        };
        const size = `vec2(${addot(this.data.size.x)}, ${addot(this.data.size.y)})`;
        this.el.setAttribute("r-thing", {
            distance: `
                vec3 k = vec3(-0.8660254, 0.5, 0.57735);
                vec2 h = ${size};
                p = abs(p);
                p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
                vec2 d = vec2(
                   length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
                   p.z - h.y
                );
                return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
            `,
        });
    },
});
