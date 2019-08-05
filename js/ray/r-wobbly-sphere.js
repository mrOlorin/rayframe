AFRAME.registerComponent("r-wobbly-sphere", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                float t = time * .001;
                p.x += sin(p.x + t);
                float d = length(p) - 1.;
                d *= .5;
                return d;
            `,
        });
    },
});
