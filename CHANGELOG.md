# 1.8.7 — 2026-10-27

- 新增有界局部多项式因式分解：整体分解后整理加法因子，并按变量分组、分解系数；只采用通过精确恒等验证且实际显示更短的候选。
- 保持完整主值根与受保护父表达式，不拆分根式；保留现有精确性、分母和外部状态检查。
- 调用内缓存最多 24 个多项式块；单块最多 512 字符、5 个变量，分组时该变量的次数不超过 4，递归深度 2。
- 截图通解 HOST 显示由 134 缩至 118 字符，保留两个积分常量；不承诺 G2 提速。
- 当前安装命令通过 88 项新增与 277 项保留 HOST 检查，安装器单元检查 12/12；原生模拟器独立安装与代表性数学验证通过，G2 未测试；GitHub v1.8.7 发布日期为 2026-10-28。

# 1.8.6 — 2026-10-27

- 恢复并核验完整 1.8.5 原文件，继续其数学实现。
- 合并自然指数整数幂；保留非整数指数的独立主值。
- 保护含三角函数的符号主值根，受限地整理根内多项式与纯数字系数。
- 限制高谐波角度的展开，避免短文本触发大规模三角展开。
- 纯标量原式参与最终长度比较，同时保留矩阵函数计算与闭复根精确构造。
- 记录原生 CAS 再次读取保存结果时的主值错误及直接代值用法。

# Changelog

## 1.8.5

- Extend unified `XSIMP` with weighted exponential-pair candidates and supported principal-root normalization under one whole-expression quote guard.
- Preserve arbitrary constants and symbolic coefficients while comparing centered factored exponentials, weighted hyperbolic forms and the original full display.
- Keep final exactness and denominator checks and preserve the existing imaginary-constant and matrix-function paths.
- Retain the prior exponential boundary fixture as a compatibility check; the additional expression structures do not establish a regression in 1.8.4.
- Record current validation under `validation/ode185/`. The earlier user-confirmed imaginary fix covers a retained subset; full 1.8.5 mathematical behavior and installation remain unverified on physical G2 hardware.

## 1.8.4

- Integrate the confirmed imaginary-constant fix into one complete 94-function PPL installer; supplementary patch programs are no longer required.
- Preserve typed exact imaginary constants during protected expression reconstruction and retain the final denominator check for new presentation rewrites.
- Keep `XSIMP` as the daily simplification entry, with conditional exponential/hyperbolic presentation and exact matrix-function paths.
- Verify the complete installer independently in fresh HOST and official Linux 2019 Virtual Calculator sessions. Physical G2 installation of the complete 1.8.4 installer remains pending.
- Include feature-first installation, development and validation documentation, plus the Expression Trees assessment.

Historical results below apply only to their original versions. Current 1.8.7 execution evidence is recorded separately under `validation/revision187/`.

## 1.7


- Construct exact principal square roots for Gaussian rational constants in supported matrix-function paths.
- Reject simplification and presentation candidates that introduce floating-point leaves into exact expressions.
- Use bounded rewriting and rational normalization for closed exact complex-radical expressions, avoiding the observed native `sin(s)/s` simplification stall.
- Preserve the bounded same-argument `sin(u)^2+cos(u)^2` identity on that path.
- Retain symbolic-base hyperbolic recovery and the matrix/scalar behavior of 1.6, subject to the documented input-evaluation boundary.
- Verify the frozen installer in the official 2019 Linux Virtual Calculator and record upstream regressions separately.
