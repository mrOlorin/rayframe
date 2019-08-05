AFRAME.registerComponent("r-points", {
    schema: {
        size: {type: "vec3", default: new THREE.Vector3(1, 1, 1)},
        pointSize: {default: .01},
        period: {type: "vec3", default: new THREE.Vector3(.2, .2, .2)},
    },
    update: function() {
        const addot = (str) => {
            if(!("" + str).includes(".")) {
                str += ".";
            }
            return str;
        };
        const pointSize = addot(this.data.pointSize);
        const period = `vec3(${addot(this.data.period.x)}, ${addot(this.data.period.y)}, ${addot(this.data.period.z)})`;
        const boxSize = `vec3(${addot(this.data.size.x)}, ${addot(this.data.size.y)}, ${addot(this.data.size.z)})`;

        this.el.setAttribute("r-thing", {
            distance: `
                float pointSize = ${pointSize};
                vec3 pointsPeriod = ${period};
                vec3 pointsRepeat = mod(p, pointsPeriod) - 0.5 * pointsPeriod;
                float pointsDistance = length(pointsRepeat) - pointSize;

                vec3 boxSize = ${boxSize};
                float boxDistance = length(max(abs(p) - boxSize, 0.));
                return opIntersection(boxDistance, pointsDistance);
            `,
        });
    },
});
