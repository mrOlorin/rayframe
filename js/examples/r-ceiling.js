AFRAME.registerComponent("r-ceiling", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                float t = time * .0001;
                float random = Cellular2D(vec2(p.x, p.z)*.2 + t);
                return (11. - p.y + random)*.5;
            `,
            material: `
                float f = .5 + .5 * sin(p.y);
                Material m;
                m.color = vec3(.5, .5, 1. - f * .4);
                m.diffuse = .2;
                m.specular = .1;
                m.ambient = f;
                m.shininess = .9;
                m.reflection = 0.;
                return m;
            `
        });
    },
});
