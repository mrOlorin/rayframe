AFRAME.registerComponent("r-sphere", {
    sdf: `
        HitObject sphere;
        vec3 spherePos = p-vec3(-16. + 2. * sin(t), 2. * cos(t*.5), -9. + 2. * cos(t));
        sphere.distance = sdSphere(spherePos, 1.5);
        sphere.material = vec4(0., 1., 0., 1.);

        hitObject = opSmoothUnion(hitObject, sphere, 2.6);
    `,
    update: function() {
        this.el.setAttribute("r-object", {sdf: this.sdf});
    },
});
