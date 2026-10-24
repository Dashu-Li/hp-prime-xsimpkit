# Public CAS functions — 1.7

Matrix-function inputs must be square matrices. `t` denotes a scalar, `e` an expression, and `A` a matrix.

| Function | Meaning |
|---|---|
| `XSIMP(e)` | Unified simplification, quoted-input parsing, matrix-function dispatch and final presentation. Accepts evaluated expressions, `quote(...)`, or strings. |
| `XEXP(A)` | Matrix exponential `exp(A)`. |
| `XEXPT(A,t)` | Matrix exponential `exp(t*A)`. |
| `XPOW(b,A)` | Matrix function `exp(ln(b)*A)`. `b` must be a provably positive real constant with no free variables. |
| `XSIN(A)` | Matrix sine, not elementwise sine. |
| `XCOS(A)` | Matrix cosine, not elementwise cosine. |
| `XRECT(e)` | Attempts real-part plus `i` times imaginary-part form; traverses lists and matrices elementwise. Variable assumptions affect the result. |
| `XREWRITE(e)` | Bounded, directed structural rewrites without the full simplification strategy. |
| `XFAST(e)` | Scalar simplification; traverses lists and existing matrices elementwise. |
| `XDEEP(e)` | Compatibility alias for the same scalar strategy as `XFAST`; no additional deep search. |
| `XSCHECK(0)` | Checks version and basic expression-tree compatibility. Expected: `XSIMP 1.7 CHECK OK`. |
| `XSDIAG(0)` | Version, compatibility and fixed-example output diagnostics. |

`XFAST`, `XDEEP`, and `XREWRITE` do not provide `XSIMP`'s string parsing, matrix-function dispatch or final presentation. For example, `XFAST("exp(A)")` is not a substitute for `XSIMP("exp(A)")`.

There are no separate `XSINH`/`XCOSH` entries. Use `XSIMP("sinh(A)")` or `XSIMP("cosh(A)")` after assigning a square matrix to `A`, or put the matrix literal inside the string.

`XPOW(2,A)` computes `2^A`; ordinary integer matrix powers such as `A^2` should use the native operator. Small-letter `xs...` names are internal helpers. `XSIMPKIT()` is the PPL installation container, not a calculation entry point.

Special structures have dedicated formulas; general higher-order matrix functions may fall back to native matrix exponentials. Exact information lost during native evaluation cannot be reconstructed by these functions.
