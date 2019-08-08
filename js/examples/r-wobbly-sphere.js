AFRAME.registerComponent("r-wobbly-sphere", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                float t = time * .002;
                p.y += .5*sin(p.y - t);
                float d = length(p) - .5;
                d *= .5;
                return d;
            `,
        });
    },
});
