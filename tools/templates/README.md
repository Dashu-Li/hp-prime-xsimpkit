# Native container template

`code.hpprgm` is a source-only template from [Jordi Rigau's hp-prime-kit](https://github.com/JordiRigau/hp-prime-kit). It is input data for the local packager; its original example source is replaced in the output.

- Git blob: `b73bf5ca9a084c8043d62ad5eb79f3de6ced80a6`
- SHA-256: `3c8386b6d315b7d1155c68100b3346abd5946392ab64c97f0fa9bbf09cf87a7c`
- Size: 1818 bytes
- License: MIT, copyright 2026 Jordi Rigau; see [LICENSE](LICENSE).
- [Source blob](https://api.github.com/repos/JordiRigau/hp-prime-kit/git/blobs/b73bf5ca9a084c8043d62ad5eb79f3de6ced80a6)

The [template author's format measurements](https://github.com/JordiRigau/hp-prime-kit/blob/main/docs/topics/formats.md) describe UTF-16LE source inside nested little-endian length records. This is a community format description, not an HP specification.

The template stores source at byte 152, with enclosing lengths at bytes 48, 56 and 144. The packager adjusts those lengths, retains the trailer and verifies the complete embedded source. It introduces no compiled cache. The internal source-record name `Main` belongs to the template structure; the generated program entry is `EXPORT XSIMPKIT185()`.

For inspection only, the packager also recognizes the SHA-pinned historical 1.7 container, whose source starts at byte 248 after a 96-byte compiled/cache structure. It rejects source changes to that compiled container. Current builds use the source-only template.

From the repository root, run:

```sh
python3 tools/build_installer.py
python3 tools/build_native.py
python3 -m unittest discover -s tests -p test_installer.py -v
```

The generated PPL source, native program, command list and manifests are written to `dist/v1.8.5-installer/`. `native/`, `baseline/` and `tools/templates/` are protected output locations. Development sources use `.ppl` and `.cas`; there is no TXT installer.

Readback and the 12 passing installer unit tests verify container and installer assembly. The current complete 1.8.5 installer was checked and run in the official Linux 2019 Virtual Calculator: Check reported no errors, Run returned `XSIMP 1.8.5 CHECK OK`, and the external state-preservation check passed. Separate native mathematics checks covered the weighted final-expression structure, the prior boundary expression, an exact matrix exponential and a negative-parameter principal-root example. Current execution evidence is recorded under `validation/ode185/`; see [validation scope](../../docs/VALIDATION.md). Historical 1.8.4 native checks do not validate a changed installer or mathematical implementation. The builder-generated `.format.json` records packaging activity only. Full 1.8.5 mathematical behavior and installer execution on physical G2 hardware remain unverified.
