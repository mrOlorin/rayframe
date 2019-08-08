AFRAME.registerComponent("r-op-rotation", {
    schema: {
        axis: {default: "xz"},
        speed: {default: .001},
    },
    init: function() {
        const addot = (str) => {
            !("" + str).includes(".") && (str += ".");
            return str;
        };
        let speed = addot(this.data.speed);
        this.el.components["r-thing"].addModifier(`
            float angle = time * ${speed};
            float s = sin(angle);
            float c = cos(angle);
            p.${this.data.axis} *= mat2(c, -s, s, c);
        `);
    },
});
