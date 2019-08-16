AFRAME.registerComponent("r-box", {
    schema: {
        size: {type: "vec3", default: new THREE.Vector3(1, 1, 1)},
        roundness: {default: 0},
    },
    update: function() {
        const addot = (num) => {
            num = "" + num;
            if (!num.includes(".")) {
                num += ".";
            }
            return num;
        };
        const xyz = [this.data.size.x, this.data.size.y, this.data.size.z];
        const boxSize = `vec3(${xyz.map(addot).join(",")})`;
        const r = addot(this.data.roundness);
        this.el.setAttribute("r-thing", {
            distance: `
                vec3 d = abs(p) - ${boxSize};
                return length(max(d,0.0)) - ${r}
                     + min(max(d.x,max(d.y,d.z)), 0.0); // remove this line for an only partially signed sdf 
            `,
        });
    },
});
