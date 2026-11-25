# AI 教育研究与开源项目阅读清单

覆盖 2026 年 8 月 25 日至 11 月 25 日，共 23 项，包括 14 篇高校论文、1 份高校证据综述和 8 个开源项目。论文按作者署名筛选，兼顾综合性研究强校和教育学、计算机、物理等相关学科强校。日期标明预印本提交、期刊或会议发表、报告发布、软件版本更新中的具体一种。同一项工作的论文与代码合计一项。项目的许可证指代码仓库，权重和数据如有单独条款应看对应说明。

**如果只读五项，建议按 1 → 2 → 3 → 11 → 16 的顺序。** 前两项分别观察无 AI 考试和课程总成绩，研究对象、干预和测量方式都不同，适合一起读。第 3 项把问题缩小到学生答错后的下一轮互动。第 11 和 16 项分别给出虚拟实验的验收方法和整堂课的实现，可直接对照 SystemEdu 的课程设计。

## 学生实际学到了什么

1. **教师自己设计 AI 教学活动，会改变考试成绩吗？** 密歇根大学、康奈尔大学、宾夕法尼亚大学等，11 月 14 日，预印本。*Instructor-designed AI improves learning in a randomized trial across 19 universities*。预注册研究覆盖 19 所高校、55 个课程与教师组合、约 7,200 名学生，按课程随机安排实施先后。学生层面分析估计，无 AI 辅助考试成绩提高 0.32 个标准差。值得看教师实际设计的活动，以及作者如何让不同课程的历年成绩可比。[论文与研究设计](https://arxiv.org/html/2611.19099v1)

2. **把一个 AI 导师接进课程后，学生把时间花在哪里？** 马里兰大学，10 月，工作论文。*The Effects of Course-Integrated AI Tutoring on Student Performance and Engagement*。随机试验覆盖 2,379 名本科生、30 位教师。在同一门课的不同教学班之间比较，获得导师使用权的一组，课程总成绩低 0.37 个标准差，学习平台参与度低 0.90 个标准差。重点看可能被替代的学习活动，并留意总评包含哪些分数。[论文与下载](https://doi.org/10.26300/y3f8-vh05)

3. **学生答错后，让他自己改一次有什么价值？** 卡内基梅隆大学，11 月 15 日，预印本。*Turning Errors into Successes*。400 名成人练习列约束方程。接受逐步提问的参与者在对话中纠正了 64% 的错误，在与练习对齐的后测上比两种讲解组高 0.24 个标准差，但练习时间接近翻倍。读实验的四种反馈条件，尤其是“个性化讲解”和“引导再次作答”之间的差别。[论文](https://arxiv.org/abs/2611.20061) · [实验材料与分析代码](https://github.com/the-oak-lab/scaffolded-error-correction)

4. **自适应选题能给普通数学练习增加多少价值？** 斯坦福大学、北京大学、加州大学洛杉矶分校等，10 月 17 日，*Economics of Education Review* 期刊版，工作稿更早。*Putting AI to the Test*。四川农村 105 所小学、315 个班、8,647 名学生参与试验。AI 个性化练习相对普通机练及常规活动均未显著提高数学成绩。最值得读的是普通机练这个对照组，它使“有电脑可练”和“按个人水平选题”可以分开检验。[期刊论文](https://doi.org/10.1016/j.econedurev.2026.102850) · [斯坦福研究页](https://fsi.stanford.edu/publication/putting-ai-test-evidence-large-scale-rct-rural-china)

5. **面对难题，真人、AI 和搜索分别改变什么？** 剑桥大学，11 月 13 日，*British Journal of Educational Technology* 在线发表。*Human tutoring, generative AI tutoring and independent internet search*。160 名 16–18 岁学生随机分组。做到第二部分数学题时，AI 导师组比真人辅导组感到更费力、题更难。后续是否主动选难题，组间没有显著差异。适合参考其对尝试次数、努力和挑战意愿的分别测量。[期刊论文](https://doi.org/10.1111/bjet.70100)

6. **用 AI 完成编程作业，两天后还能解释多少？** 新南威尔士大学，9 月 18 日，预印本。*Your Programming Students’ Cognition with ChatGPT*。55 人纳入分析。AI 组与常规搜索组的 C 语言任务得分分别为 89% 和 69%，48 小时后的回忆测验分别为 39% 和 52%。值得参考同一份作业如何配一道独立延迟测验。两组从即时测验到延迟测验的遗忘幅度差异未达显著。[论文](https://arxiv.org/html/2609.21194v1)

7. **AI 给真人辅导员反馈，学生说话会变吗？** 斯坦福大学、康奈尔大学等，11 月 4 日提交 arXiv。*Automated Feedback to Peer Tutors Increases Their Talk Moves and Learner Reasoning but Not the Balance of Talk*。两期 SAT 数学训练营涉及 1,030 名志愿辅导员和 7,443 名学习者。给辅导员反馈后，启发学生、接续学生发言和学生推理等行为增加约 8%–15%，教师发言时长占比没有显著变化。适合设计课堂观察指标。[论文](https://arxiv.org/pdf/2611.07072)

8. **把物理例题改成可对话版本，学生会学得更好吗？** 哥廷根大学，11 月 21 日，预印本。*AI-generated support, worked examples, and script-based learning in undergraduate physics*。86 名大学生所在的 9 个习题班被随机分配，用聊天式例题、对应的静态例题或讲义学习高斯定律。三组概念测验均有进步，组间增幅差异未达显著。重点看作者怎样让静态例题与聊天例题的内容可比。[论文](https://arxiv.org/pdf/2611.28951)

9. **同一名学生用语音和文字学，结果有什么差别？** 波士顿大学，9 月 21 日，预印本。*When AI Tutors Speak*。在线 MBA 课程中有 86 人随机分组，51 人完成前后测。课程专属导师组中，同一学生按周交替使用语音与文字。语音使对话量接近翻倍、成本约为 2.8 倍，两种方式的每周掌握程度相当。适合判断语音功能该用什么指标验收。[论文](https://arxiv.org/html/2609.23958v1)

10. **怎样快速判断一份 AI 教育效果报告是否值得信？** 斯坦福大学 SCALE，11 月，研究综述。*The Evidence Base on AI in K–12: A November 2026 Review*。本轮新增 32 篇满足作者因果证据标准的研究，累计 52 篇。先读附录的纳入标准，再看哪些研究测了学生独立完成任务的能力。报告本身在窗口内发布，其新增证据覆盖 2025 年 10 月至 2026 年 6 月。[综述和方法附录](https://scale.stanford.edu/ai/evidence-base-review/evidence-base-ai-k12-november-review)

## 互动课程与 AI 导师的设计和评测

11. **Lab2Sim**。华南理工大学、香港理工大学，11 月 2 日，预印本。把实验演示视频转成可操作的虚拟实验。作者从 218 段视频整理出 11,881 条评分细则，并用状态机规定每个操作的前置条件。做虚拟实验时，优先读有关仪器还原、错误操作和状态变化的评测，比单看一次成功演示更能发现问题。[论文与示例](https://arxiv.org/html/2611.02928v1)

12. **EduExplain**。印度理工学院德里分校，10 月 31 日，预印本。作者为 321 个学生问题整理了 741 份参考分镜。任务要求先选出能相互补充的文字、图、例子和活动，再安排它们的顺序与时长。适合检查一节自动生成的课为什么用了这张图、为什么在这里插入一个例子。[论文](https://arxiv.org/html/2611.00802v1)

13. **CoLearn**。伦敦国王学院，10 月，EMNLP 系统演示论文。系统根据每次作答更新各主题的掌握程度和反复出现的误解，再据此生成下一题。盲评中，个性化题目获选约 68%–69%。这个指标衡量题目偏好。要验证学习效果，还需要学生后续独立作答的数据。[会议论文](https://aclanthology.org/2026.emnlp-demos.6/)

14. **GuideEval**。北京师范大学，10 月，EMNLP Findings。*Discerning Minds or Generic Tutors?* 从真实教学对话中考察导师判断学生当前理解、调整教学策略和引出学生反思的能力。建议直接读失败案例，尤其是学生已经表示困惑，导师却继续沿用同一提示的时候。[会议论文](https://aclanthology.org/2026.findings-emnlp.1588/)

15. **SafeTutors**。埃因霍温理工大学、印度理工学院克勒格布尔分校、纽约大学等，10 月，EMNLP Findings。把过早透露答案、强化错误概念、撤掉必要提示等问题整理成 11 个维度、48 类细项，覆盖数学、物理和化学。适合用来审查一整段师生对话，观察导师在哪一轮放弃了教学目标。[会议论文](https://aclanthology.org/2026.findings-emnlp.1917/)

## 可以读代码的开源项目

16. **OpenMAIC**。清华大学，MIT，11 月 24 日发布 v1.5.0。最适合研究一堂互动课怎样从对话草稿进入学生课堂。这个版本让工作台和课堂适配手机，并让幻灯片编辑和播放共用画布。对 SystemEdu，建议先看同一份课件如何跨编辑、讲授和手机播放三个场景使用。[代码](https://github.com/THU-MAIC/OpenMAIC) · [版本记录](https://github.com/THU-MAIC/OpenMAIC/releases)

17. **Primer**。宾夕法尼亚大学沃顿商学院，MIT，11 月 12 日公布论文与项目。教师把学习目标写成场景，配置角色、可用工具和场景转换，再让学生在互动中做决定。值得先读一个完整场景的配置，看某个学生选择会如何改变后续练习及复盘。[代码](https://github.com/wharton-generative-ai-labs/primer) · [技术论文](https://arxiv.org/html/2611.16986v1)

18. **PIVOT**。华东师范大学、新加坡国立大学，Apache-2.0，9 月 21 日提交预印本，10 月发表于 EMNLP 主会。把 STEM 视频的分镜、Manim 动画、习题和错误概念补救连起来。可以顺着同一知识点看视频如何出题、答错后又怎样补讲。论文提供 32 名 STEM 教师的评估，结果反映教师对材料的判断。[代码](https://github.com/Chloe-mxxxxc/Pedagogy-Guided-Generative-Video-Tutors-for-STEM-Learning) · [会议论文](https://aclanthology.org/2026.emnlp-main.1096/)

19. **DeepTutor**。香港大学 HKUDS 团队与社区，Apache-2.0。11 月 16 日的 v1.7.3 更新阅读、教材编辑和学习记录，11 月 20 日发布 v1.7.4。适合研究学生上传材料、留下阅读记录、下次回来继续学习的完整过程。阅读入口是版本说明里的阅读与学习记录变更。[代码](https://github.com/HKUDS/DeepTutor) · [版本记录](https://github.com/HKUDS/DeepTutor/releases)

20. **OmniEdu**。北京大学、中国科学院大学等，仓库 Apache-2.0，9 月 19 日论文首版，10 月新增 FP8 权重。团队同时开放教育模型、训练数据和工具，把教学能力拆成学科解题、课程标准与先修知识对齐、错误诊断、教学引导四项。若做知识树，优先读后面三类训练样例。[代码、模型与数据入口](https://github.com/haolpku/Omni-Edu) · [论文](https://arxiv.org/abs/2609.23088)

21. **Sherpa**。斯坦福大学、卡内基梅隆大学、佐治亚理工学院，Apache-2.0，10 月 6 日提交论文。让模拟学生以不同方式回应提示，再训练教师模型调整策略。MathTutorBench 教学评分从 52.5% 提升到 79.2%。读代码时关注模拟学生在什么条件下接受提示。这个分数来自教学基准。[代码](https://github.com/SALT-NLP/Sherpa) · [论文](https://arxiv.org/html/2610.08778v1)

22. **StudentSim**。微软研究院与伊利诺伊大学厄巴纳－香槟分校，MIT，9 月 1 日提交论文。用学生自己的历史记录模拟下一步反应，覆盖国际象棋、二语英语写作和初中数学。与 Sherpa 对读时，可以用某一位真实学习者后续做出的选择，检查模拟器对这个人的预测准不准。[代码](https://github.com/microsoft/StudentSim) · [论文](https://arxiv.org/html/2609.01591v1)

23. **StudentBench**。Handshake AI Research，复现代码 MIT，9 月 23 日提交论文并介绍公开平台。仓库提供 2,383 名真人参与 GRE 实验的去标识数据入口及图表复现脚本，串起前测、辅导对话、练习和后测。适合参考真实用户评测的结构。论文中的等效结果针对这次 GRE 短时学习任务。[复现代码与数据](https://github.com/Handshake-AI-Research/studentbench) · [研究设计](https://arxiv.org/abs/2609.28470)
