AFRAME.registerComponent("r-sphere", {
    schema: {
        radius: {default: 1},
    },
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                return length(p) - float(${this.data.radius});
            `,
        });
    },
    tick: function(t, dt) {
        const pos = this.el.getAttribute("position");
        pos.x = Math.sin(t*.001);
    },
});
