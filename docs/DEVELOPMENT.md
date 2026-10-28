# XSIMPKIT 1.8.7 开发与复现

## 构建安装器

从仓库根目录运行，使用 Python 3 标准库：

```sh
python3 tools/build_installer.py
python3 tools/build_native.py
python3 -m unittest discover -s tests -p test_installer.py -v
```

输出为 `dist/v1.8.7-installer/XSIMPKIT187.ppl`、`XSIMPKIT187.hpprgm`、命令列表及摘要。构建器不执行 CAS，也不会更新验证报告。原生模板的来源与 MIT 许可见 [tools/templates](../tools/templates/README.md)。

数学实现只使用 `src/` 中的 `scalar.cas`、`matrix.cas`、`presentation.cas`、`posthoc.cas`、`unified.cas` 五个模块。

## HOST 运行时

仓库和发布包不附带 Giac JavaScript 运行时，也不自动下载或安装它。需要运行 HOST 检查时，调用方应从可信来源取得兼容的上游运行时，核实其来源与许可，并放到 `test_runtime/giac.js`。Node.js 脚本使用该模块导出的 `cwrap('caseval', 'string', ['string'])` 接口。外部运行时所在目录已被 Git 忽略。

这些测试运行上游 Giac 的 HP 模式，不等同于 HP 固件、原生模拟器或物理 G2。源码直接加载与按安装命令逐项加载也属于不同路径。`tests/runtime_loader.cjs` 支持通过 `XS_LOADER_COMMANDS` 选择当前 `installer_commands.json`；只有调用该加载器的脚本受此设置影响，其余脚本直接加载五个模块。保存的报告逐项注明实际路径，不应把直接加载结果写成完整 PPL 安装验证。

HOST 脚本各自输出独立报告。部分混合字符串与未知调用、复杂矩阵用例在外部运行时中存在已记录异常；详见 [VALIDATION.md](VALIDATION.md)。准备好运行时并不代表整个宽泛测试集合一定通过。

## 显式选择性能基线

`candidates/perf181-baseline/` 和 `candidates/imag182-baseline/` 是冻结参考源码，不是当前安装源。基准工具的历史默认路径 `baseline/v1.7/src` 不包含在此精简仓库中，必须显式选择存在的基线与候选路径，例如：

```sh
node tools/benchmark.cjs --runtime test_runtime/giac.js --baseline candidates/perf181-baseline --candidate src --case trig_identity --samples 5 --warmups 1 --timeout 30000 --output evidence/local-benchmark.json
```

此命令仅测指定用例，执行前需要已准备好运行时。工具先验证结果，再记录符合输出与精确性要求的样本。HOST 时间不代表 G2 时间；不同输出、近似状态或验证失败的样本不能用于宣称提速。默认超时限制桌面子进程，不会为计算器中的 CAS 调用增加硬超时。

## 打包

选择一个尚不存在相同版本输出的目录，显式选择当前验证证据：

```sh
python3 tools/package_candidate.py --output-parent /absolute/path/to/new-output --evidence-dir validation/revision187=validation/revision187
```

包内摘要描述该次选中的文件。发布版本的验证报告是冻结证据；数学源码或安装器修改后须重新验证，不能沿用旧报告作为新版本通过的证明。


## 1.8.7 当前检查

```sh
python3 -m unittest discover -s tests -p test_installer.py -v
node tests/new_identities_runtime.cjs
node tests/partial_factor_runtime.cjs
python3 tools/run_regression187.py
```

最后一个脚本只排除已记录上游阻断项 `unknown_and_string_data`，不把该项计为通过。最终源码的统计与原生限制见 docs/VALIDATION.md。生成后的验证报告必须与模块摘要对应；更改数学源码后不能沿用历史报告。

## 局部因式分解实现

`posthoc.cas` 中的有界多项式候选先尝试整体因式分解，再改进乘积中的加法因子，并按少量变量分组、分解系数。候选只接收精确、未绑定的多项式；受保护重建后以整式差的 `ratnormal` 验证恒等，只采用实际显示更短的形式。

最终遍历按调用缓存最多 24 个多项式块，避免重复判别式重复分析。单块 512 字符、5 个变量、分组时该变量的次数不超过 4、递归深度 2；缓存不跨调用，不建立用户可见的持久变量。根号、非整数幂和父表达式保持受保护结构，并继续检查分母限制。这些预算约束搜索范围，不为 `factor` 等原生调用设置硬超时；HOST 耗时不能换算为 G2 耗时。

本版通过 88 项局部因式分解检查、277 项保留 HOST 回归及 12 项安装器检查。新增测试包括判别式、重命名变量、部分加数分组、三种公开输入、四种复数配置、负实/复参数、零判别式、分母与外部状态。当前完整安装器已在官方 Linux 2019 Virtual Calculator 2.1.14290 中独立通过 Check、Run 和代表性数学验证；详见 [VALIDATION.md](VALIDATION.md)。
