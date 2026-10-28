# XSIMPKIT 1.8.7 测试

当前执行证据位于 `validation/revision187/`；边界与排除项见 [VALIDATION.md](VALIDATION.md)。本版通过 365 项 HOST 检查及 12 项安装器单元检查，原生模拟器独立安装与代表性数学验证通过，G2 未测试。

安装器检查无需外部 CAS：

```sh
python3 -m unittest discover -s tests -p test_installer.py -v
```

HOST 数学检查需要调用方提供兼容、可信的 `test_runtime/giac.js`，该运行时不随发布包分发。准备方式见 [DEVELOPMENT.md](DEVELOPMENT.md)。

```sh
node tests/new_identities_runtime.cjs
node tests/partial_factor_runtime.cjs
python3 tools/run_regression187.py
```

`new_identities_runtime.cjs` 覆盖 76 项整数指数、三角根式及主值反例。`partial_factor_runtime.cjs` 在四种复数配置中覆盖 88 项局部因式分解、完整主值根、三种公开输入、矩阵/列表、分母、外部状态及负实/复参数检查。`run_regression187.py` 重跑另 201 项保留回归；只排除已记录上游阻断项 `unknown_and_string_data`，该项不计通过。三者合计 365 项。

报告逐项记录当前安装命令加载路径与源码摘要。HOST 上游 Giac 的 HP 模式不代表 PPL/CAS 桥接或物理 G2；安装器单元检查验证编码与组装，也不证明数学运行。当前完整安装器已在官方 Linux 2019 Virtual Calculator 2.1.14290 中独立通过 Check、Run 和代表性数学验证；原生复数设置覆盖范围见验证记录。修改源码或安装器后须重新生成相应证据，历史 1.8.6 通过项不能替代本版执行。
