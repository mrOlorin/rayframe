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
        this.el.getDistance = function(p) {
            p.sub(this.el.getAttribute("position"));
            return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - this.data.radius;
        }.bind(this);
    },
});
