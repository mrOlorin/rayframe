AFRAME.registerComponent("r-op-intersection", {
    init: function() {
        this.el.setAttribute("r-thing", {
            distanceBlend: `
                return max(d1, d2);
            `,
            materialBlend: `
                if (d1 >= d2) {
                    return m1;
                } else {
                    return m2;
                }
            `,
        });
    },
});
