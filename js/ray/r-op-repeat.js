AFRAME.registerComponent("r-op-repeat", {
    schema: {
        period: {type: "vec3", default: new THREE.Vector3(1, 1, 1)},
    },
    init: function() {
        const addot = (str) => {
            !("" + str).includes(".") && (str += ".");
            return str;
        };
        let swizzling = "";
        let values = [];
        if(this.data.period.x !== 0) {
            swizzling += "x";
            values.push(addot(this.data.period.x));
        }
        if(this.data.period.y !== 0) {
            swizzling += "y";
            values.push(addot(this.data.period.y));
        }
        if(this.data.period.z !== 0) {
            swizzling += "z";
            values.push(addot(this.data.period.z));
        }
        let period;
        if (swizzling.length === 1) {
            period  = `${values}`;
        } else if (swizzling.length === 2) {
            period  = `vec2(${values})`;
        } else if (swizzling.length === 3) {
            period  = `vec3(${values})`;
        }

        this.el.components["r-thing"].addModifier(`
            p.${swizzling} = mod(p.${swizzling}, ${period}) - 0.5 * ${period};
        `);
    },
});
