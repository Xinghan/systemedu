# 从下载材料到运行第一格代码

这份说明对应 `junior-guide.ipynb` 学习版。M01–M05 可以先在 iPad 看图、算小例子、填写课堂笔记；从 M06 起的 Python 实践需要一台电脑。本说明的实际验收环境是 macOS、Python 3.12。iPad 课堂没有 Python 内核，不会因为点开文件或标记读完就执行计算。

## 1. 找到同一个材料文件夹

下载并解压 `lightkurve-practice-kit.zip`。打开里面的 `lightkurve-practice` 文件夹，应看到 `junior-guide.ipynb`、`analyze.py`、`manifest.json`、`requirements-classroom.txt`、`raw` 和 `student-input`。这些文件保持同级，不把 Notebook 单独移走。

`raw` 存原始观测；`student-input` 存自己选择的区间等输入；运行后出现的 `student-runs` 存各次成果。只修改自己的输入和运行副本，原始观测留着以便复查。

电脑还没有 Python 3.12 时，可从 [Python 官方下载页](https://www.python.org/downloads/)选择对应安装包，必要时请教师协助安装。终端输入 `python3.12 --version`，应显示 3.12.x；“找不到命令”时先完成安装，不继续照抄后面的命令。其他 Python 版本不是本次验收环境。

## 2. 在终端准备环境

打开 Mac 的“终端”。输入 `cd` 和一个空格，把刚才的 `lightkurve-practice` 文件夹拖进终端，再按回车。`cd` 是把工作位置切到这个文件夹。输入 `pwd` 可看完整位置，`ls` 可列出其中的文件；应能找到上一节列出的几个名字。

下面是**终端命令**，每次复制一行、按回车、等当前命令结束再执行下一行。不要把这些命令粘进 Python 代码格。

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-classroom.txt
.venv/bin/python -m pip check
.venv/bin/python -m ipykernel install --prefix=.venv --name systemedu-junior --display-name "SystemEdu · Python 3.12"
.venv/bin/python -m jupyterlab
```

第一行建立只供本项目使用的环境；第二行安装课程库和 JupyterLab 图形前端；第三行检查依赖是否冲突；第四行为这个环境登记一个清楚的内核名字；最后一行打开学习界面。首次安装需要网络，读取本包 FITS 与计算可在材料齐备后离线进行。

若安装命令失败，保存错误文字，并核对 Python 版本和网络。不要靠删除报错行、替换观测文件或盲目升级一部分库来“消除”错误。`pip check` 通过只表示依赖关系没有发现冲突，还不等于课程计算完成。

## 3. 打开学习本并运行一格

浏览器会打开 JupyterLab。若没有自动打开，使用终端自己显示的本机地址。左侧文件列表双击 `junior-guide.ipynb`，内核选择 `SystemEdu · Python 3.12`。不选择其他项目的 Python 环境。

正文说明格用于阅读，代码格左侧有方括号。点击代码格，按 Shift+Enter 执行；左侧显示 `[*]` 表示仍在执行，变成数字后再读下方输出。修改代码文字之后，需要重新运行那一格，内核才使用修改后的值。按 Command+S 保存这份 Notebook。

M01–M05 是材料与纸笔检查。从 M06 的准备格开始，记下打印的“本次成果目录”。随后按同名课节逐格运行。先运行三条构造记录，预测输出，再打开真实 Q3。第一次不要选择“Run All / 运行全部”。

## 4. 怎样找到成果与回到上次工作

每次运行准备格会创建 `student-runs/日期-编号`，已存在的目录保留。`RUN` 指本次目录；后续保存表、图片和记录都明确给出相对文件名。JupyterLab 左侧打开 `student-runs`，进入打印出的目录，便能找到输出。

关闭内核后，变量不会靠重新打开 Notebook 自动恢复。要继续算，按已学顺序重新运行到当前节，并记下新的成果目录；旧目录用于比对，不能假装这次仍是第一次运行。M28 会教你从已保存的方法文件在新进程中复现；它不依赖旧内核的隐藏变量。

如果某格显示“待填写/没有学生区间/尚未开启 Q4”，先按提示补自己的记录。这不是让你复制教师答案。文件生成和自查通过只完成部分任务，解释、判断及同伴核验仍由人完成。

## 5. Q4 何时打开

M23 保存自己实际使用的方法；M24 在尚未读取 Q4 亮度时生成并核对预测。到 M25 才把 `Q4_REVEAL = False` 改成 `True` 并运行。未开启时后续检验输出保持待完成。已经在其他地方看过 Q4 的人如实记录，开关不能证明你从未看过公开资料。

`kepler10-reproduction.ipynb` 和 `analyze.py --stage develop` 保留作**汇总复现参考**。它们会合并执行多个课节，不能替代逐节学习本。旧 README 末尾的教师 QA 脚本说明用于验收，不是学生打开学习本的必要步骤。

## 核对依据

Jupyter 的安装与启动方式参照 [Project Jupyter 安装说明](https://jupyter.org/install)及 [JupyterLab 启动说明](https://jupyterlab.readthedocs.io/en/stable/getting_started/starting.html)。课程环境保留原有计算库版本，另列图形前端依赖。
