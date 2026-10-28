# 安装 XSIMPKIT 1.8.7

下载 [XSIMPKIT187.hpprgm](../dist/v1.8.7-installer/XSIMPKIT187.hpprgm)。单个完整安装器包含虚数常量处理、带系数指数配对、主值根保护与局部因式分解，不需要另装补丁程序。

## 安装和升级

1. 用 HP Connectivity Kit 导入 XSIMPKIT187.hpprgm。
2. 保持该程序的 CAS 复选框关闭，在程序目录运行 XSIMPKIT187。
3. 弧度模式下，成功提示为 XSIMP 1.8.7 CHECK OK；也可在 CAS 中执行 XSCHECK(0) 复查。
4. 日常仍使用 XSIMP(...)。例如 XSIMP(exp(a+i*b)-exp(a-i*b)) 可得到 2*i*exp(a)*sin(b)。

安装器只设置 CAS 所需的 1 基索引（of:=1）并注册本包函数；不清空其他变量、函数或假设。角度与精确模式由用户设置。混合三角/双曲恒等式使用弧度制；其他角度模式下自检会提示设置条件。

编辑器中的 Check 只检查普通 PPL 安装器的语法，运行安装器才会注册 CAS 函数。

升级完成后，旧版安装器、XSIMPFIX、XSIMPFIX2 和 XSIMPDG 均不再用于安装或刷新。确认新版自检通过后，如需精简程序目录，可以移除这些旧的程序条目；不要运行全局 purge。以后只用 XSIMPKIT187 刷新。

## 错误提示与刷新

stage:index:set / stage:index:verify 表示索引设置或验证失败；stage:define:函数名 / stage:verify:函数名 表示对应函数注册或复查失败。安装器在该阶段停止，不将后续步骤视为成功。

如果公开入口提示 run XSIMPKIT187 from Program Catalog to refresh CAS functions，请回到程序目录运行 XSIMPKIT187。官方 2019 Linux 模拟器完整退出再打开后可能需要这样刷新；Check 不能代替运行。

## 源码构建

```sh
python3 tools/build_installer.py
python3 tools/build_native.py
```

构建器保留函数的数学 token 与换行。各函数逐个通过 CAS.expr 执行并检查返回状态，全部完成后再复查所有名称，最后运行完整自检。hpprgm 是不含旧编译缓存的原生程序容器。

当前 1.8.7 已通过 365 项 HOST 检查和 12 项安装器单元检查；当前完整安装器在原生模拟器中独立安装及代表性数学验证通过，G2 实机验证未完成。当前执行结果以[验证范围](VALIDATION.md)及包内 `validation/revision187/` 报告为准；旧版报告不作为本版通过的证明。


## 根式结果的使用

分支敏感的表达式建议以字符串输入。官方 2019 Linux CAS 对已保存符号结果的再次求值仍可能改错主值；即使 Simplify 为 None 也会出现。若要数值，直接使用 `evalf(subst(XSIMP("表达式"),a,数值))`，避免先保存符号结果再读取。已知边界见 [验证范围](VALIDATION.md)。
