AFRAME.registerComponent("r-op-smooth-union", {
    schema: {
        k: {default: .3},
    },
    init: function() {
        const addot = (str) => {
            !("" + str).includes(".") && (str += ".");
            return str;
        };
        const k = addot(this.data.k);
        this.el.setAttribute("r-thing", {
            distanceBlend: `
                float k = ${k};
                float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) - k * h * (1.0 - h);
            `,
            materialBlend: `
                float k = ${k};
                float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
                Material m;
                m.color = mix(m2.color, m1.color, h);
                m.diffuse = mix(m2.diffuse, m1.diffuse, h);
                m.specular = mix(m2.specular, m1.specular, h);
                m.ambient = mix(m2.ambient, m1.ambient, h);
                m.shininess = mix(m2.shininess, m1.shininess, h);
                m.reflection = mix(m2.reflection, m1.reflection, h);
                return m;
            `,
        });
    },
});
