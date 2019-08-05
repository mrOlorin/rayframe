AFRAME.registerComponent("r-op-union", {
    init: function() {
        this.el.setAttribute("r-thing", {
            distanceBlend: `
                return min(d1, d2);
            `,
            materialBlend: `
                if (d1 <= d2) {
                    return m1;
                } else {
                    return m2;
                }
            `,
        });
    },
});
