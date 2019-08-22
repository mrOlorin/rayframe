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
        this.el.getDistance = function(p) {
            p.add(this.el.getAttribute("position"));
            return Math.sqrt(p.x * p.x + p.z * p.z) - this.data.radius;
        }.bind(this);
    },
});
