# Test Checklist: Multi-Store Release Targets

- [ ] A valid `vMAJOR.MINOR.PATCH` release identity produces Edge, Chrome, and Firefox target packages with the same version.
- [ ] Invalid release identities and manifest versions fail with target-neutral wording, including non-numeric segments, prerelease labels, wrong tag shape, and segments above 65535.
- [ ] Edge package manifest omits `browser_specific_settings.gecko`.
- [ ] Chrome package manifest omits `browser_specific_settings.gecko`.
- [ ] Firefox package manifest keeps `browser_specific_settings.gecko.id`.
- [ ] Runtime payload contents match across Edge, Chrome, and Firefox aside from approved manifest transforms.
- [ ] Local package scripts exist and work for `package:edge`, `package:chrome`, and `package:firefox`.
- [ ] Release workflow derives one version, installs dependencies once, runs tests once, normalizes package version once, and packages all three targets.
- [ ] Release asset publication is gated on all target package outputs existing.
- [ ] Existing-release retry behavior and partial-upload cleanup risk are documented.
- [ ] Version writeback remains one target-agnostic release follow-up.
- [ ] Store upload remains manual; no store API secrets, environments, or automated upload steps are introduced.
- [ ] Documentation covers local packaging, manual upload destinations, strict version policy, Firefox 109+ MV3 floor, AMO zip handling, and Safari deferral.
- [ ] No Safari artifact is produced and no working Safari target is advertised.
