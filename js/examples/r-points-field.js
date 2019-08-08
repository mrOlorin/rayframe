AFRAME.registerComponent("r-points-field", {
    update: function() {
        this.el.setAttribute("r-thing", {
            distance: `
                vec3 camera = rayOrigin - p;
                float cameraDistanceSq = p.x * p.x + p.y * p.y + p.z * p.z;
                float pointSize = .01 / (1. + cameraDistanceSq);
                if(pointSize <= .001) {
                    return MAX_DIST;
                }
                vec3 pointsPeriod = vec3(.1);
                vec3 pos = vec3(ceil(p.x / pointsPeriod.x), ceil(p.y / pointsPeriod.y), ceil(p.z / pointsPeriod.z));
                float t = time * .001;

                pos *= .3;
                vec3 f = vec3(
                    (sin(pos.x + t) + cos(pos.z + t)),
                    sin(pos.x + pos.z + t),
                    0
                );
                f *= .03;

                vec3 pointsRepeat = mod(p + f, pointsPeriod) - 0.5 * pointsPeriod;
                return length(pointsRepeat) - pointSize;
            `,
        });
    },
});
