AFRAME.registerComponent("r-firmament", {
    schema: {
        size: {default: 15},
    },
    init: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                return float(${this.data.size}) - length(p);
            `,
        });
    },
});
