# XSIMPKIT for HP Prime

Bounded symbolic simplification and matrix functions for the HP Prime CAS.

Version **1.7** preserves exact complex radicals in supported matrix-function paths and avoids a native-CAS stall when simplifying expressions such as `sin(s)/s` with a constant complex radical `s`.

[中文说明](docs/README.zh-CN.md) · [Function reference](docs/API.md) · [Validation](docs/TESTING.md)

## Installation

1. Download **XSIMPKIT.hpprgm** from the v1.7.0 Release assets.
2. Open the HP Connectivity Kit and drag the file into your connected calculator's **Programs** area.
3. In CAS settings, select **Simplify: None**, **Exact: ON**, **Complex: ON**, and **Radians**.
4. Run `XSCHECK(0)`. The expected reply is `XSIMP 1.7 CHECK OK`.

The native program is also stored at [native/XSIMPKIT.hpprgm](native/XSIMPKIT.hpprgm). The `.ppl` and `.cas` files in `src/` are development sources.

Use the CAS functions below for calculations. `XSIMPKIT()` itself is only the installation container.

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

## Input evaluation matters

Unquoted arguments are evaluated by the native CAS before a custom function receives them. If `exp(i*A)` has already become a floating-point matrix, `XSIMP(exp(i*A))` cannot recover the exact original expression. Use `XEXP(i*A)`, `XEXPT(A,i)`, or quoted input to preserve the required information.

Native `2^A` can mean elementwise powers. `XPOW(2,A)` computes the matrix function `exp(ln(2)*A)` explicitly. The program does not reinterpret a matrix of already-computed elementwise powers.

## Functions

See the [complete function reference](docs/API.md) for all 12 public CAS functions. The main entries are `XSIMP`, `XEXP`, `XEXPT`, `XPOW`, `XSIN`, and `XCOS`.

`XFAST` and `XDEEP` are compatibility names for the same scalar strategy in 1.7. `XDEEP` does not perform a deeper search.

## Validation and limits

The frozen 1.7 source was installed and checked in the official HP Prime Linux Virtual Calculator **2.1.14290 (2019)**. The quoted complex example, direct `XEXP`, and direct `XEXPT` all completed with no floating-point leaves. Earlier hyperbolic, rotation, and Pauli examples passed as well.

Upstream Giac regression records contain 125 existing primary cases, 97 additional primary cases, and 33 quoted/unquoted pairs. Representation checks, numerical agreement, symbolic equality, and native execution are recorded separately; they are not interchangeable proofs. See [TESTING.md](docs/TESTING.md).

These results do not certify every current G2 firmware version. Report the hardware, firmware, CAS settings, exact input, and actual result when filing an issue.

The input limit is 1600 characters, and traversal depth is bounded at 24. Individual native CAS operations have no hard timeout. This is not a global shortest-expression search. Unknown logarithm branches and denominators are handled conservatively. Constant complex-radical expressions use structural rewriting and rational normalization to avoid the observed slow native simplification path.

The frozen installer SHA-256 is:

```text
3d07486133bb9fb22cbe829db7ccc64abd2baf6a7eb91a07ad10c0e4c6214930
```

## Development

The five modules and test scripts are in `src/`. Build the combined PPL source with:

```sh
python3 src/build_and_test.py
```

For upstream tests, place the author's Giac JavaScript runtime at `test_runtime/giac.js` in this repository, then run the scripts listed in [TESTING.md](docs/TESTING.md), using `node src/<script>.cjs`. The external runtime is not distributed here. Existing test records accompany the source; rebuilding after edits does not automatically revalidate them.

The full ZIP attached to the GitHub Release contains the previously validated full distribution, including native evidence. Its bundled manifest applies to that original distribution. The new top-level documentation does not modify the frozen calculator code.
