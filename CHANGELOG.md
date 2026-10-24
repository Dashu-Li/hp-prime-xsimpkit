# Changelog

## 1.7

- Construct exact principal square roots for Gaussian rational constants in supported matrix-function paths.
- Reject simplification and presentation candidates that introduce floating-point leaves into exact expressions.
- Use bounded rewriting and rational normalization for closed exact complex-radical expressions, avoiding the observed native `sin(s)/s` simplification stall.
- Preserve the bounded same-argument `sin(u)^2+cos(u)^2` identity on that path.
- Retain symbolic-base hyperbolic recovery and earlier matrix/scalar behavior, subject to the documented input-evaluation boundary.
- Verify the frozen installer in the official 2019 Linux Virtual Calculator and record upstream regressions separately.
