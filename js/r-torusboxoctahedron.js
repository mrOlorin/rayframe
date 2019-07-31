AFRAME.registerComponent("r-torusboxoctahedron", {
    sdf: `
        HitObject torus;
        float torusRa = 3.;
        float torusThi = .2;
        vec3 torusPos = p-vec3(0., 2, -13);
        torusPos.yz *= rotationMatrix(time * .0002);
        torusPos.xy *= rotationMatrix(time * .00017);
        torus.distance = sdTorus(torusPos, vec2(torusRa, torusThi));
        torus.material = vec4(1., 0., 0., 1.);

        HitObject box;
        vec3 boxPos = p-vec3(0., 2, -13);
        float boxRa = 1.5;
        box.distance = sdBox(boxPos, vec3(boxRa));
        box.material = vec4(0., 1., 0., 1.);

        HitObject octahedron;
        vec3 octahedronPos = p-vec3(0., 2., -13);
        //octahedronPos.xz *= rotationMatrix(time * .001);
        octahedron.distance = sdOctahedron(octahedronPos, 2.);
        //octahedron.distance *= 3.;
        octahedron.material = vec4(0., 0., 1., 1.);

        HitObject octahedronBox = opSmoothSubtraction(octahedron, box, 1.4);
        HitObject torusBoxOctahedron = opSmoothUnion(torus, octahedronBox, .5);

        hitObject = opSmoothUnion(hitObject, torusBoxOctahedron, .5);
    `,
    update: function() {
        this.el.setAttribute("r-object", {sdf: this.sdf});
    },
});
