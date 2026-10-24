# XSIMPKIT for HP Prime

XSIMPKIT is a set of CAS functions for the HP Prime. It simplifies scalar expressions and computes matrix exponentials, powers, sine and cosine. Use `XSIMP` for general simplification or call a matrix function directly.

[中文说明](docs/README.zh-CN.md) · [Download](https://github.com/Dashu-Li/hp-prime-xsimpkit/releases/tag/v1.7.0) · [Function reference](docs/API.md)

## Functions

| Function | What it does |
|---|---|
| `XSIMP(e)` | Simplifies fractions, radicals, complex expressions, exponentials and trigonometric expressions; also accepts quoted matrix expressions. |
| `XEXP(A)` | Computes the matrix exponential `exp(A)`. |
| `XEXPT(A,t)` | Computes `exp(t*A)` for a scalar `t`. |
| `XPOW(b,A)` | Computes the matrix function `exp(ln(b)*A)` for a positive real constant `b`. |
| `XSIN(A)`, `XCOS(A)` | Compute matrix sine and cosine. |

Matrix inputs must be square. Results may use trigonometric or hyperbolic functions when these give a more compact form. See the [function reference](docs/API.md) for all 12 public CAS functions.

`XFAST` and `XDEEP` use the same scalar strategy in 1.7; `XDEEP` does not perform a deeper search.

## Examples

```text
XSIMP((x^2-1)/(x-1))
XSIMP(sqrt(8)-2*sqrt(2))
XSIMP("2^[[1,1],[2,3]]")
XPOW(2,[[1,1],[2,3]])
XEXPT([[0,-1],[1,0]],t)
XEXP(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))
XSIMP("exp(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))")
XSIN([[0,-1],[1,0]])
XSIMP("cosh([[0,-1],[1,0]])")
```

The first two examples return `x+1` and `0`. Rational cancellation follows the native CAS convention and does not retain excluded points from the original denominator.

For the complex matrix example, let `A=[[1,-2*i],[1+2*i,1]]` and `s=sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2)`. Since `(A-I)^2=(4-2*i)*I` and `s^2=4-2*i`, the result is equivalent to:

```text
exp(i)*[[cos(s),2*sin(s)/s],[(-2+i)*sin(s)/s,cos(s)]]
```

Actual output may use equivalent coefficients or arguments.

## Installation

1. Download **XSIMPKIT.hpprgm** from the v1.7.0 Release assets.
2. Open the HP Connectivity Kit and drag the file into your connected calculator's **Programs** area.
3. In CAS settings, select **Simplify: None**, **Exact: ON**, **Complex: ON**, and **Radians**.
4. Run `XSCHECK(0)`. The expected reply is `XSIMP 1.7 CHECK OK`.

The native program is also stored at [native/XSIMPKIT.hpprgm](native/XSIMPKIT.hpprgm). The `.ppl` and `.cas` files in `src/` are development sources.

Use the CAS functions below for calculations. `XSIMPKIT()` itself is only the installation container.

## Input evaluation matters

Unquoted arguments are evaluated by the native CAS before a custom function receives them. If `exp(i*A)` has already become a floating-point matrix, `XSIMP(exp(i*A))` cannot recover the exact original expression. Use `XEXP(i*A)`, `XEXPT(A,i)`, or quoted input to preserve the required information.

Native `2^A` can mean elementwise powers. `XPOW(2,A)` computes the matrix function `exp(ln(2)*A)` explicitly. The program does not reinterpret a matrix of already-computed elementwise powers.

## Validation and limits

The frozen 1.7 source was installed and checked in the official HP Prime Linux Virtual Calculator **2.1.14290 (2019)**. The quoted complex example, direct `XEXP`, and direct `XEXPT` all completed with no floating-point leaves. Earlier hyperbolic, rotation, and Pauli examples passed as well.

Upstream Giac regression records contain 125 existing primary cases, 97 additional primary cases, and 33 quoted/unquoted pairs. Representation checks, numerical agreement, symbolic equality, and native execution are recorded separately; they are not interchangeable proofs. See [TESTING.md](docs/TESTING.md).

The native file was also reloaded in a separate simulator work directory; version, scalar simplification and exact complex-matrix checks passed. This was not a physical G2 transfer test. Report the hardware, firmware, CAS settings, exact input, and actual result when filing an issue.

The input limit is 1600 characters, and traversal depth is bounded at 24. Individual native CAS operations have no hard timeout. This is not a global shortest-expression search. Unknown logarithm branches and denominators are handled conservatively. Constant complex-radical expressions use structural rewriting and rational normalization to avoid the observed slow native simplification path.

The combined PPL source SHA-256 is:

```text
3d07486133bb9fb22cbe829db7ccc64abd2baf6a7eb91a07ad10c0e4c6214930
```

## Development

The five modules and test scripts are in `src/`. Build the combined PPL source with:

```sh
python3 src/build_and_test.py
```

For upstream tests, place the author's Giac JavaScript runtime at `test_runtime/giac.js` in this repository, then run the scripts listed in [TESTING.md](docs/TESTING.md), using `node src/<script>.cjs`. The external runtime is not distributed here. Existing test records accompany the source; rebuilding after edits does not automatically revalidate them.

The full ZIP attached to the GitHub Release contains the previously validated full distribution, including native evidence. Its manifest lists the files and checksums in that ZIP. The calculator code is the same as the validated 1.7 source.

## Version history

Current version: 1.7. Changes are listed in [CHANGELOG.md](CHANGELOG.md). Native-file reload checks are recorded in [NATIVE_FORMAT.json](docs/NATIVE_FORMAT.json).
