# XSIMPKIT 1.7 验证记录

## 修复范围

1.7 处理精确复数根式在矩阵函数及后续化简中被原生 CAS 提前转成小数的问题。对实部、虚部都是有理数的精确复数，先用实根式构造主平方根；标量、矩阵清理与显示阶段检查候选结果，拒绝把精确输入变成浮点数的变换。已经含浮点数的输入仍按近似语义处理，不猜测原来的精确式。

例如截图所用矩阵 A=[[1,-2*i],[1+2*i,1]] 满足 (A-I)^2=(4-2*i)I。令

```text
s = sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2)
```

则 s^2=4-2*i，可用 exp(i)*(cos(s)*I+i*sin(s)*(A-I)/s) 构造精确矩阵指数。本版不要求返回式与这个参考式逐字相同；符号表示、数值一致性及原生执行分别验证。

最终 XSIMPKIT.txt SHA-256：3d07486133bb9fb22cbe829db7ccc64abd2baf6a7eb91a07ad10c0e4c6214930。

## 原生编译、目标执行与计时

最终源码在 PPL 编辑器检查为 No errors in the program，XSCHECK(0) 返回 XSIMP 1.7 CHECK OK。用户目标的字符串输入、直接 XEXPT(A,i) 和 XEXP(i*A) 三条路径都正常完成并返回根式与三角函数；对完整返回对象的 xsisapprox 检查得到 [0,0,0]，没有浮点叶。这里 A=[[1,-2*i],[1+2*i,1]]。

另核对 ln(2)、ln(a) 的矩阵指数有无引号两条路径，均保留紧凑双曲式；旋转矩阵保留 cos(t)/sin(t)，虚 Pauli 指数保留 cos(1)/i*sin(1)。最终运行没有 CAS 警告弹窗或强制中断。编译标准输出仍有 1.6 已观察到的 Python-like multiline-string 提示，但 GUI 明确报告无程序错误，实际调用均通过。

最终记录见 evidence/v17_release_native.json。编译、实际运行、类型检查与上游数学测试分开记录；没有将编译通过当作运行通过。

开发阶段的初候选 5b13c5f4… 虽然编译成功，目标非对角项的 xsclean 调用却出现停滞；该失败独立保留在 evidence/v17_candidate_5b13_failure.json，不算作最终发布验证。定位记录区分了快速的精确根式构造、快速的对角项与缓慢的非对角项清理，且同一非对角式使用 ratnormal 能快速保持精确。针对该窄路径修正后的最终原生结论只认本节所列最终 SHA 与对应记录。

原生验证环境为 HP 官方 Linux Virtual Calculator 2.1.14290（2019-10-23），通过 PPL 编辑器安装整个含 #cas 的 XSIMPKIT.txt。CAS 设置 None、Exact ON、Complex ON、Radians；程序不改变用户 CAS 设置。它不是用户当前固件或 G2 实机。

新复杂目标的完整调用计时如下，三次均正常完成：

| 路径 | 1.7 三次秒数 | 中位数 |
|---|---|---|
| XSIMP("exp(i*([[1,0],[1,1]]+2*[[0,-i],[i,0]]))") | 0.070 / 0.069 / 0.057 | 0.069 |
| XEXPT([[1,-2*i],[1+2*i,1]],i) | 0.0141 / 0.0121 / 0.0127 | 0.0127 |
| XEXP(i*[[1,-2*i],[1+2*i,1]]) | 0.0118 / 0.0122 / 0.0120 | 0.0120 |

下面保留 1.6 最终发布版在同一主机、模拟器与设置下的历史基线，并列出 1.7 对照：

| 完整调用，A=[[1,1],[2,3]] | 1.6 三次秒数 | 1.7 三次秒数 | 中位数比较 |
|---|---|---|---|
| 无引号 XSIMP(exp(A*ln(2))) | 0.0316 / 0.0330 / 0.0326 | 0.0298 / 0.0288 / 0.0286 | 0.0326 → 0.0288 |
| 无引号 XSIMP(exp(A*ln(a))) | 0.0374 / 0.0452 / 0.0448 | 0.0364 / 0.0350 / 0.0350 | 0.0448 → 0.0350 |
| 有引号 XSIMP("exp(A*ln(a))")，实际输入展开 A | 0.0360 / 0.0254 / 0.0268 | 0.0254 / 0.0236 / 0.0242 | 0.0268 → 0.0242 |

基线来自 evidence/v16_release_timings.json，绑定 1.6 源码 SHA-256 6cf5ffa7e101e39813d0304b1181506c058f090987cc0f292718b80d0c83e541。计时使用 CAS 小写 time(command)，单位秒；确认上游回归进程退出后测量，不含人工输入与截图等待。三次样本与跨会话主机负载差异不足以支持精确提速倍数，这不是 G2 实机耗时。新复杂目标、旋转、Pauli 和有引号 ln(2) 没有 1.6 原生计时基线。单次内置 CAS 调用仍无硬超时。

宽矩阵超出模拟器屏幕时，截图中不可见的元素没有算作逐元素原生数学检查；xsisapprox 类型检查遍历了完整返回对象。最终原生套件没有重测“原生先将复矩阵指数算成小数，再传给 XSIMP”的无保护路径，其边界由上游记录单独说明。evidence/ 保存最终原生记录所列的截图、命令与计时，以及 1.6 基线。

## 上游回归

| 记录 | 结果与含义 |
|---|---|
| validation.json | 29/29 数学回归 |
| representation_results.json | 9/9 表示检查 |
| coefficient_results.json | 7/7 系数等价，另检查乘法收尾 |
| fraction_results.json | 12/12 等价，另检查格式与因子顺序 |
| posthoc_checks.json | 17/17 指数恢复与边界 |
| posthoc_extended_checks.json | 16/16 符号、复参数、对数与分母保护 |
| imag_leaf_results.json | 9/9 等价，另检查有无引号一致性及实双曲式保留 |
| native_text_results.json | 10/10 虚数字形与转义字符串兼容；这里的 native_text 是上游 HP 模式测试名称，并非原生模拟器验证 |
| symbolic_power_text_results.json | 8/8 符号底数显示与分支保留 |
| symbolic_base_results.json | 6 项精确证明、2 项数值一致性，合计 8 项 |
| complex_root_results.json | 15/15 主平方根、各象限、纯虚数、负实轴、零、浮点与未支持精确输入边界 |
| complex_matrix_results.json | 8/8 精确类型保留与独立 Cayley–Hamilton 参考的数值比较；另证明无迹部分的平方及根式平方 |
| complex_exactness_results.json | 15/15：13 项精确表示与独立数值校验，2 项近似输入语义 |
| scalar_exact_results.json | 48/48 浮点叶类型检测、精确候选保护、闭合复数根式分母的窄路径及标量回归 |
| exact_presentation_guard_results.json | 11/11 显示阶段精确保留、双曲转三角、奇偶消去、指数转幂及近似输入 |

旧十套测试共 125 条主记录；新增五套共 97 条。计数中包含边界行为和数值一致性检查，不把它们统一称为精确等价证明。

运行时为作者发布的 Giac JavaScript，不等同于计算器固件。validate.cjs 使用仅机械调整一基索引为零基的桌面副本；其余使用 calc_mode(-38) 与原始一基源码。精确等价验证必要时使用共同指数表示，仅作用于测试，返回结果不做该展开。

complex_exactness_tests.cjs 使用独立 JavaScript 复数运算及二阶矩阵 Cayley–Hamilton 公式，误差阈值为 1e-10。它先检查存储结果没有浮点叶，再做独立数值比较；这证明测试点上的数值一致性，不是返回式的完整符号恒等证明。complex_matrix_results.json 中的两条结构恒等式则另有精确证明。

caseval 在 HP 模式下可能将精确存储结果显示成“精确式=小数预览”。等号后的预览不说明存储值已变成浮点数。测试同时检查存储值类型与 string(value)，不能仅凭屏幕或 caseval 输出是否出现小数下结论。

## 有引号、无引号与输入边界

33 组配对仍为 27 组逐字一致、30 组精确等价、3 组原生运算含义不同、0 超时。与 1.6 最终版比较，32 组无引号输出、30 组有引号输出逐字相同。唯一新增的有无引号共同变化是 exp(i*pi/3) 从 1/2+i*sqrt(3)/2 合并为 (i*sqrt(3)+1)/2，属于等价分母合并；另外两组有引号结果仅乘积因子顺序改变、长度不变。配对证明结论不变。baseline_v16_parity.json 保存基线，parity_comparison.json 记录比较结果。

三条语义差异是标量底数的矩阵幂：原生 2^A 可能已成为逐元素幂，而矩阵函数解释要求 exp(ln(2)*A)。程序不把已有的逐元素结果重新解释为矩阵幂。

无引号参数会先由原生 CAS 求值。若 XSIMP(exp(i*A)) 在进入函数前已经成为浮点矩阵，1.7 不能恢复丢失的信息，该项只作近似语义和数值一致性检查。字符串输入 XSIMP("exp(i*A)") 应展开或按相应变量约定提供 A；直接调用 XEXPT(A,i)、XEXP(i*A) 可以让程序先处理仍精确的矩阵输入。这些直接 API 不等同于“原生先算完的无引号 XSIMP”路径。

1.6 的符号底数修复仍保留：沿用原式已有 ln(a) 的分支，不拆分乘积对数，也不假定 a 为正实数。上游 complex_variables(1) 模式曾观察到原生 exp(A*ln(a)) 在进入 XSIMP 前异常；该路径没有计入通过。−2 和 1+i 底数的原生矩阵指数已提前成为浮点数，symbolic_base_results.json 对它们只标记数值一致性。不能据此断定用户当前固件存在同样异常。

## 复现与发布记录

将作者运行时 https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac.js 放在本目录同级 test_runtime/giac.js，然后在包目录运行：

```text
python3 build_and_test.py
node validate.cjs
node representation_tests.cjs
node coefficient_tests.cjs
node fraction_tests.cjs
node posthoc_validate.cjs
node posthoc_extended_validate.cjs
node imag_leaf_tests.cjs
node native_text_tests.cjs
node symbolic_power_text_tests.cjs
node symbolic_base_tests.cjs
node complex_root_tests.cjs
node complex_matrix_tests.cjs
node complex_exactness_tests.cjs
node scalar_exact_tests.cjs
node exact_presentation_guard_tests.cjs
node parity_audit.cjs
node parity_proofs.cjs
```

测试进程的独立限时不等于计算器函数中的硬超时。运行时未随包分发。上游执行日志中的 Python-like syntax 或 approximate 警告需要结合具体结果判断；没有把警告自动当成失败，也没有把停滞忽略为成功。

发布脚本读取冻结源码 SHA、最终原生 JSON 与测试记录，拒绝残留占位、未通过检查、已知源码哈希不匹配和损坏的 ZIP。manifest.json 列出实际打包文件的 SHA-256；文件清单能核对分发内容，不能单独证明某个旧测试记录是重新运行的。已经带源码哈希的专项记录另与最终源码逐项核验。

## 查阅资料

- 作者的 HP Prime CAS 手册：https://www-fourier.univ-grenoble-alpes.fr/~parisse/hp-prime_cas.pdf
- 作者的 Giac 文档：https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/doc/xcasen.html
- 作者对用户函数参数求值的说明：https://www.hpmuseum.org/forum/archive/index.php?thread-7051.html=
- 作者的指数转双曲函数例子：https://www.hpmuseum.org/forum/archive/index.php?thread-13942.html=
- 官方旧模拟器下载页：https://www.hpcalc.org/details/8917

## 原生文件补充验证

当前安装文件为官方模拟器保存的 XSIMPKIT.hpprgm；未修改二进制。已在独立工作目录重新载入，通过版本、标量化简及复数矩阵指数类型检查。嵌入源码与原始发布源码逐字节一致，仅将开发用合并源码文件改名为 XSIMPKIT.ppl。详见 NATIVE_FORMAT.json。此补充验证不等同于 G2 实机 Connectivity Kit 传输测试。
