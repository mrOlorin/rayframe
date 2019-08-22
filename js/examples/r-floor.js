AFRAME.registerComponent("r-floor", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                return p.y;
            `,
        });
        this.el.getDistance = function(p) {
            return p.y;
        };
    },
});
