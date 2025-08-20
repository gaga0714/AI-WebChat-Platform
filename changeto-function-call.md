## 调用openhands来实现智能体平台
链接：https://github.com/All-Hands-AI/OpenHands?tab=readme-ov-file

### 什么是`function call`:

**函数定义（Schema）**:

平台要事先告诉模型：有哪些函数、函数名字、参数结构。这样模型才知道什么时候应该调用哪个函数。

**调用过程**:

- 模型识别出用户的问题需要用函数解决。

- 按照定义好的格式返回 `{"name": "...", "arguments": {...}}`。

- 平台执行对应的函数。

**返回结果**:

- 函数执行后，把结果返回给模型。

- 模型再把结果组织成自然语言回答。

## 安装docker