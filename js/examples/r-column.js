AFRAME.registerComponent("r-column", {
    schema: {
        radius: {default: 1},
    },
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                return length(p.xz) - float(${this.data.radius});
            `,
        });
    },
});
