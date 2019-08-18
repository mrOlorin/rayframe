AFRAME.registerComponent("r-points-field", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                vec3 period = vec3(.05);
                float t = time * .001;
                vec3 f = period * vec3(
                    0,
                    cos(sin(p.z + t * 3.)) * sin(p.z + t * .2),
                    0
                );
                float boxDist = length(max(abs(p) - vec3(.5, .5, 2.), 0.0));
                return max(boxDist, length(mod(p + f, period) - 0.5 * period) - .001);
            `,
        });
    },
});
