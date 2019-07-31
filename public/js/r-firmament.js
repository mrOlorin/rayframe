AFRAME.registerComponent("r-firmament", {
    sdf: `
        HitObject firmament;
        vec3 firmamentPos = p;
        vec2 firmamentRepeat = vec2(49., 49.);
        firmamentPos.xz = mod(firmamentPos.xz + firmamentRepeat, firmamentRepeat * 2.)-firmamentRepeat;
        firmament.distance = 50.-length(firmamentPos);
        firmament.material = vec4(1.-normalize(p),1.);
        firmament.material = vec4(1.);

        HitObject tonnel;
        float tonnelRa = 50.;
        float tonnelThi = 15.;
        vec3 tonnelPos = p-vec3(115.4, 1, 0);
        float tonnelDist = sdTorus(tonnelPos, vec2(tonnelRa, tonnelThi));
        firmament.distance = opSmoothSubtraction(tonnelDist, firmament.distance, 1.);

        hitObject = opSmoothUnion(firmament, hitObject, 1.+sin(t));
    `,
    update: function() {
        this.el.setAttribute("r-object", {sdf: this.sdf});
    },
});
