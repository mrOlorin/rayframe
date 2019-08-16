AFRAME.registerComponent("r-material", {
    schema: {
        color: {type: "vec3", default: new THREE.Vector3()},
        diffuse: {default: .5},
        specular: {default: .02},
        ambient: {default: .2},
        shininess: {default: 0.},
        reflection: {default: 0.},
        transparency: {default: 0.},
        ior: {default: 1.4},
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
            const transparency = dot(this.data.transparency);
            const ior = dot(this.data.ior);
            material = `
                Material m;
                m.color = ${color};
                m.diffuse = ${diffuse};
                m.specular = ${specular};
                m.ambient = ${ambient};
                m.shininess = ${shininess};
                m.reflection = ${reflection};
                m.transparency = ${transparency};
                m.ior = ${ior};
                return m;
            `;
        }
        this.el.setAttribute("r-thing", {material});
    },
});
