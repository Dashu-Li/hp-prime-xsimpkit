# XSIMPKIT 1.7

Exact complex-radical matrix functions and a fix for the native complex-radical denominator simplification stall.

Import `XSIMPKIT.hpprgm` through the HP Connectivity Kit into the calculator Programs area. Use CAS Simplify=None, Exact ON, Complex ON, and Radians; `XSCHECK(0)` should return `XSIMP 1.7 CHECK OK`.

For the matrix A=[[1,-2*i],[1+2*i,1]], use `XEXP(i*[[1,-2*i],[1+2*i,1]])`, `XEXPT([[1,-2*i],[1+2*i,1]],i)`, or `XSIMP("exp(i*[[1,-2*i],[1+2*i,1]])")`. Unprotected native evaluation may lose exactness before `XSIMP` receives its argument.

The official HP Prime Linux Virtual Calculator 2.1.14290 completed the quoted example in a median 0.069 s, direct XEXPT in 0.0127 s and direct XEXP in 0.0120 s over three samples. These are simulator timings, not physical G2 timings. Existing hyperbolic, rotation and Pauli examples passed.

The full archive contains source, regression records and native evidence. See README and docs/TESTING.md for supported paths and limits.
