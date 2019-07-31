AFRAME.registerComponent("r-ground", {
    sdf: `
        // Ground
        HitObject ground;
        //ground.distance = sdPlane(p, vec3(0., 1., 0.), 1.);
        ground.distance = p.y;
        ground.distance -= -1.-sin(noise);
        ground.distance /= 2.;
        ground.material = vec4(1.-noise, 1.-noise, 1., 1.);

        hitObject = opUnion(hitObject, ground);
    `,
    update: function() {
        this.el.setAttribute("r-object", {sdf: this.sdf});
    },
});
