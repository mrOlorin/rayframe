AFRAME.registerComponent("r-moving-torus", {
    schema: {
        r: {default: 1},
        d: {default: .1},
    },
    update: function() {
        const addot = (num) => {
            num = "" + num;
            if (!num.includes(".")) {
                num += ".";
            }
            return num;
        };
        const r = addot(this.data.r);
        const d = addot(this.data.d);
        this.el.setAttribute("r-thing", {
            distance: `
                return length(vec2(length(p.xz) - ${r}, p.y)) - ${d};
            `,
        });
    },
});
