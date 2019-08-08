AFRAME.registerComponent("r-ground", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                return p.y;
            `,
        });
    },
});
