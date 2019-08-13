AFRAME.registerComponent("r-material-grid", {
    init: function() {
        this.el.setAttribute("r-material", {
            custom: `
                float gridSize = 1.;
                float xmod = floor(mod(p.x / gridSize, 2.));
                float zmod = floor(mod(p.z / gridSize, 2.));
                Material m;
                if (mod(xmod + zmod, 2.) < 1.) {
                    m.color = vec3(.282, .318, .353);
                    m.diffuse = .2;
                    m.specular = .2;
                    m.ambient = .3;
                    m.shininess = 1.;
                    m.reflection = 0.;
                } else {
                    m.color = vec3(.322, .341, .365);
                    m.diffuse = .2;
                    m.specular = .2;
                    m.ambient = .6;
                    m.shininess = 1.;
                    m.reflection = 0.;
                }
                return m;
            `,
        });
    },
});
