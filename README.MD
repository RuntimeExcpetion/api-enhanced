<p align="center">
  <img src="./public/static/neteaselogo.png" alt="网易云音乐 API Enhanced Logo" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@neteasecloudmusicapienhanced/api">
    <img src="https://img.shields.io/npm/v/@neteasecloudmusicapienhanced/api?style=flat-square" alt="NPM Version" />
  </a>
  <a href="https://www.npmjs.com/package/@neteasecloudmusicapienhanced/api">
    <img src="https://img.shields.io/npm/dm/@neteasecloudmusicapienhanced/api?style=flat-square" alt="NPM Downloads" />
  </a>
  <a href="https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced">
    <img src="https://img.shields.io/github/license/NeteaseCloudMusicApiEnhanced/api-enhanced?style=flat-square" alt="License" />
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/node/v/@neteasecloudmusicapienhanced/api?style=flat-square" alt="Node Version" />
  </a>
  <a href="https://hub.docker.com/r/moefurina/ncm-api">
    <img src="https://img.shields.io/docker/v/moefurina/ncm-api?style=flat-square" alt="Docker Version" />
  </a>
  <a href="https://hub.docker.com/r/moefurina/ncm-api">
    <img src="https://img.shields.io/docker/pulls/moefurina/ncm-api?style=flat-square" alt="Docker Pulls" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  </a>
</p>



## 项目简介

网易云音乐第三方 Node.js API, 支持丰富的音乐相关接口，适合自建服务、二次开发和多平台部署

> [!IMPORTANT]
>
> ## 注意
>
> - 本项目是自由项目, 不带任何担保, 在基于`MIT License`的许可下, 任何人都可以自由使用、修改和分发本项目的代码, 包括用于商业目的. 
> - 该项目是个合作计划, 有很多人参与了此次贡献, 前往 [Contributors](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/graphs/contributors) 页面查看所有贡献者
> - 原作者项目 [Binaryify/NeteaseCloudMusicApi](https://github.com/binaryify/NeteaseCloudMusicApi) 并非完全停止维护, 你可以在 [NeteaseCloudMusicApi 的 NPMJS 页面](https://www.npmjs.com/package/NeteaseCloudMusicApi) 查看最新版本信息。   
> - 感谢尊重和理解!

## 快速开始

### 环境要求

- Node.js 22 及以上
- 推荐使用 pnpm 进行依赖管理

### 安装

```bash
git clone https://github.com/neteasecloudmusicapienhanced/api-enhanced.git
cd api-enhanced
pnpm i
```

### 启动服务

```bash
# 默认端口 3000
node app.js

# 指定端口（如 4000）
PORT=4000 node app.js  # Mac/Linux
set PORT=4000 && node app.js  # Windows
```

### 重要提示

- 调用前请务必阅读文档的 [调用前须知](https://neteasecloudmusicapienhanced.js.org/#/?id=%e8%b0%83%e7%94%a8%e5%89%8d%e9%a1%bb%e7%9f%a5) 部分。
- 推荐将敏感信息（如 cookie）通过部署平台的环境变量进行配置。

## 可视化音乐播放器

在部署平台设置环境变量 `API_TOKEN`（自行生成的随机访问令牌），重启服务后访问 `/auth`，验证通过即进入 `/` 的「拾音 SONORA」播放器。未登录访问首页会跳转验证页，播放器静态资源同样受保护。未配置 `API_TOKEN` 时播放器返回 503，不对外开放；API-only 部署仍保留原先未配置令牌时的 API 行为。原 API 工具首页保留在 `/api-console.html`，登录后可以访问。

- 支持歌曲搜索、新歌推荐、播放队列、本地收藏、同步歌词、进度和音量控制。
- 每首歌曲旁与当前歌曲详情中提供下载入口，支持音质选择、取消下载和本地/原创试听音频保存。在线下载使用 `/song/download/url/v1` 获取当前账号授权的完整音源，再经受保护的 `/player/download` 分段传输。只接受网易云音乐 CDN 音频，不将试听片段当作完整歌曲下载。
- 默认以歌曲列表为中心：左侧为可展开的图标导航，封面/歌词详情与介绍卡片按需展开。顶部“专注模式”一键收起两侧内容；点击底部当前歌曲也可展开详情。布局选择保存在当前浏览器。手机使用抽屉展示导航和详情，可点击遮罩或按 Esc 收起；底部播放控制保持可用，面板变化不影响播放。
- 点击右上角账号按钮，默认使用网易云音乐 App 扫码登录，也可切换到手机号短信验证码登录。二维码支持等待扫码、待确认、成功和过期提示，可手动刷新；关闭窗口、切换登录方式或页面转入后台时停止轮询，扫码成功后自动读取歌单。支持国家区号、验证码重发倒计时、账号状态恢复及退出网易云账号；验证码和手机号通过 POST 提交，不写入 URL。
- 登录网易云后可查看创建与收藏的歌单、喜欢的音乐歌单以及每日推荐。歌单列表与歌曲均支持“加载更多”（每次 100 条）。点击歌单曲目播放，或播放当前已加载的全部曲目。
- 项目访问验证与网易云账号登录互相独立；网易云登录仅支持同站 API，以便浏览器保存服务端 Cookie。手机号和扫码登录返回的 Cookie 设置 HttpOnly，不在浏览器存储中持久化验证码、手机号或网易云 Cookie 字符串。相关账号接口禁用服务端缓存。
- Web Audio 实时频谱 / 波形；支持本地音频导入及内置原创合成试听（无需联网）。
- 播放器固定使用同站 API，自动携带外层入口验证后设置的 HttpOnly Cookie。页面内不再提供 API 地址或访问令牌设置，也不从浏览器存储读取令牌。
- 登录表单使用 POST 提交，令牌不写入登录 URL；服务器通过时序安全比较验证，并设置 HttpOnly、SameSite=Strict 会话 Cookie（HTTPS 下带 Secure）。侧栏可以退出登录，清除 Cookie；登录失效后同站 API 的 401 会让播放器返回验证页。
- 在线歌曲是否可播取决于服务端账号及版权权限；试听片段会显示提示，不绕过权限。音频源需支持 CORS 才能使用实时频谱。
- 本地文件只在当前页面会话内有效，不上传至服务端；收藏保存在当前浏览器。

### 可视化音乐空间与中央舞台

点击“音乐空间”即可浏览排行榜、歌单、歌手、专辑、MV、播客、评论、消息和账号资料。界面用封面卡片、歌曲列表、资源选择器与操作弹窗完成工作，不展示接口路径、原始编号输入或 JSON 编辑器。其他业务服务按内容分类，使用中文控件选择内容，结果以卡片或信息面板呈现；登录握手、加密和心跳等底层流程不作为用户填写的独立接口。

- **蓝发女仆宠物外观**：音符采用参考图风格的透明背景 Q 版角色，包含站立、眨眼、左右张望、伸懒腰、打盹、挥手和左右舞蹈共九个姿势；随音乐切换舞姿，摸头时显示开心表情，并保留拖动、位置记忆、归位与音级跳跃。角色图集随项目提供，无需外部图片服务。
- **沉浸舞台与音乐宠物**：正在播放页采用深色舞台、封面氛围背景、霓虹频谱、歌词焦点和悬浮控制栏。音符根据实际音频 45–180 Hz 低频能量跳跃、摇头和摆臂，暂停后休息；支持隐藏并记住偏好，手机上停靠封面区域，尊重系统减少动态效果设置。 支持鼠标/触屏拖动和位置记忆，点击摸头、方向键移动、Home 或归位按钮复位。十二音级模式下可开启“跟随音级”，音符会跳向持续稳定的主要音级（如 C → E），手动拖走切换自由活动。此功能展示音级能量，不是对复杂歌曲进行准确旋律识谱。
- 侧栏“最近播放”读取网易云账号的 `/record/recent/song`，展示最近 100 首歌曲及网易云提供的播放时间，支持播放全部、再次播放、下载、歌曲菜单和刷新。未登录时进入网易云登录，成功后回到最近播放；账号变化后不保留上一账号的记录。此列表只读取网易云返回的数据，不生成本机播放历史或自动上报听歌记录。
- 歌单支持新建、编辑名称/介绍/标签、收藏、删除、更换封面、添加歌曲、移除歌曲，以及用上下按钮调整歌单/歌曲顺序。
- 歌曲支持播放、下载、喜欢/取消喜欢、加入歌单、查看和发布/回复/点赞/删除自己的评论、查看歌手与专辑。
- 云盘提供文件选择与上传、播放和删除；歌手/专辑/电台提供浏览与收藏，MV/视频使用原生视频播放器。
- 私信以会话列表和消息气泡展示，可选择用户后发送消息；个人资料使用昵称、签名、生日和性别控件编辑。
- 播放时 PC 主区域会自动切到中央播放舞台，封面、歌词、控制和可视化集中展示。底部歌曲信息与顶部“正在播放”按钮可返回舞台，“返回歌曲列表”不会中断播放。
- 可视化提供星环、频谱、波形和十二音级。音级按真实 FFT 频率映射计算能量；不宣称复音音乐的整体调性识别。低动态效果偏好会降低动画更新。

### 大文件下载

下载先获取受保护的音源信息与账号绑定下载票据，再用不超过 1 MiB 的请求并行拉取音频分段，合并后交给浏览器保存。中断只重试失败分段，显示实际字节进度；票据过期会重新获取音源，并核对文件大小与摘要，防止拼接不同文件。票据使用 API_TOKEN 派生的密钥加密，可跨服务实例验证，账号变化后失效。

单次整文件中转在音源中断、超时或部署平台限制时，可能出现已发送 200 但连接关闭。新界面使用有界分段；不支持 Range 的音源显示直连入口。旧客户端在 Vercel 上会转到音源，不再强制整个母带文件通过一次函数响应。真实上游和部署平台仍需账号联调确认。

更新模块或文档后运行 `pnpm player:catalog` 重新生成业务服务目录。项目保留 `/api.html` 与 `/docs/` 供维护使用，不放入播放器的日常操作流程。

播放器及账号逻辑测试：`node --test scripts/player.test.js scripts/player.account.test.js scripts/player.features.test.js scripts/player.visual.test.js`。可用空格键播放 / 暂停。

## 在线体验与文档

- [在线文档](https://neteasecloudmusicapienhanced.js.org/)
- [NPM 包地址](https://www.npmjs.com/package/@neteasecloudmusicapienhanced/api)
- [Dockerhub 主页](https://hub.docker.com/r/moefurina/ncm-api)

## 常见部署方式

- 推荐参考[在线文档](https://neteasecloudmusicapienhanced.js.org/)

## Docker 部署说明

本项目支持通过 Docker 一键部署，无需手动安装 Node.js 或依赖。

> 注意: 在 docker 中运行的时候, 由于使用了 request 来发请求, 所以会检查几个 proxy 相关的环境变量(如下所列), 这些环境变量 会影响到 request 的代理, 详情请参考[request 的文档](https://github.com/request/request#proxies), 如果这些环境变量 指向的代理不可用, 那么就会造成错误, 所以在使用 docker 的时候一定要注意这些环境变量. 不过, 要是你在 query 中加上了 proxy 参数, 那么环境变量会被覆盖, 就会用你通过 proxy 参数提供的代理了.

request 相关的环境变量

1. http_proxy
2. https_proxy
3. HTTP_PROXY
4. HTTPS_PROXY
5. no_proxy
6. NO_PROXY

```shell
docker pull moefurina/ncm-api:latest

docker run -d -p 3000:3000 --name ncm-api moefurina/ncm-api:latest


// 或者
docker run -d -p 3000:3000 moefurina/ncm-api:latest

// 去掉或者设置相关的环境变量

docker run -d -p 3000:3000 --name ncm-api -e http_proxy= -e https_proxy= -e no_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= moefurina/ncm-api:latest

// 或者
docker run -d -p 3000:3000 -e http_proxy= -e https_proxy= -e no_proxy= -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= moefurina/ncm-api:latest
```

> 以下是自行 build docker 镜像方式

```shell
$ git clone https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced && cd api-enhanced

$ sudo docker build . -t ncm-api

$ sudo docker run -d -p 3000:3000 ncm-api
```

## 3. 环境变量

| 变量名                        | 默认值                                  | 说明                                                 |
|----------------------------|--------------------------------------|----------------------------------------------------|
| **CORS_ALLOW_ORIGIN**      | `*`                                  | 允许跨域请求的域名。可填写单个源，或使用逗号分隔多个源（例如 `https://a.com,https://b.com`）。 |
| **API_TOKEN**              | 留空（不启用认证）                         | 访问网页和 API 所需的令牌。设置后，所有请求（CORS 预检除外）都必须通过认证。       |
| **ENABLE_PROXY**           | `false`                              | 是否启用反向代理功能。                                        |
| **PROXY_URL**              | `https://your-proxy-url.com/?proxy=` | 代理服务地址。仅当 `ENABLE_PROXY=true` 时生效。                 |
| **ENABLE_RANDOM_CN_IP**    | `false`                              | 是否默认启用随机中国IP。启用后，所有请求默认使用随机中国IP，除非请求参数 `randomCNIP` 显式关闭。 |
| **ENABLE_GENERAL_UNBLOCK** | `true`                               | 是否启用全局解灰（推荐开启）。开启后所有歌曲都尝试自动解锁。                     |
| **ENABLE_FLAC**            | `true`                               | 是否启用无损音质（FLAC）。                                    |
| **SELECT_MAX_BR**          | `false`                              | 启用无损音质时，是否选择最高码率音质。                                |
| **FOLLOW_SOURCE_ORDER**    | `true`                               | 是否严格按照音源列表顺序进行匹配。                                  |

设置 `API_TOKEN` 后，API 客户端应通过 `Authorization: Bearer <令牌>` 或
`X-API-Token: <令牌>` 请求头发送令牌。例如：

```bash
API_TOKEN=your-secret-token pnpm start
curl -H 'Authorization: Bearer your-secret-token' http://localhost:3000/search?keywords=test
```

浏览器访问服务时会自动跳转至令牌认证页面；输入正确令牌后，服务器会写入仅限 HTTP 访问的
`api_token` Cookie 并进入首页，之后加载页面资源时无需再次认证。也可直接使用
`?token=<令牌>` 完成认证。请使用足够长且随机的令牌，
并避免在共享设备或会记录 URL 的场景中使用查询参数。

---

### 4. 更新镜像

更新到最新版本：

```bash
docker pull moefurina/ncm-api:latest
docker stop ncm-api && docker rm ncm-api
docker run -d -p 3000:3000 moefurina/ncm-api:latest
```

## Vercel 一键部署

1. fork 本项目
2. 在 Vercel 官网新建项目，导入 fork 的仓库
3. 直接 Deploy

## 腾讯云 Serverless 部署

1. fork 本项目
2. 在腾讯云 serverless 控制台新建 Web 应用，选择 Express 框架
3. 代码仓库选择 fork 的项目，启动文件填写：
   ```bash
   #!/bin/bash
   export PORT=9000
   /var/lang/node16/bin/node app.js
   ```
4. 完成部署后，访问 API 网关的 URL 即可

## Node.js 方式调用

支持直接在 Node.js 项目中引入和调用，返回 Promise：

```js
const {
  login_cellphone,
  user_cloud,
} = require('@neteasecloudmusicapienhanced/api')
async function main() {
  const result = await login_cellphone({ phone: '手机号', password: '密码' })
  console.log(result)
  const result2 = await user_cloud({ cookie: result.body.cookie })
  console.log(result2.body)
}
main()
```

## TypeScript 支持

```ts
import { banner } from '@neteasecloudmusicapienhanced/api'
banner({ type: 0 }).then((res) => console.log(res))
```

## 单元测试

```bash
pnpm test
```

## 主要功能特性

- 登录/注册/验证码
- 用户信息、歌单、动态、播放记录
- 歌曲、专辑、歌手、MV、歌词、评论、排行榜
- 搜索、推荐、私人 FM、签到、云盘
- 歌曲解锁（解灰）

## 贡献与社区

- 欢迎提交 PR、Issue 参与维护
- 要贡献新接口, 请参考[这篇文章](https://www.focalors.ltd/post/how-to-contribute-ncm-api)

### 致谢

原作者 [Binaryify/NeteaseCloudMusicApi](https://github.com/binaryify/NeteaseCloudMusicApi) 项目为本项目基础 (该项目在`npmjs`网站上仍持续维护, 但 github 仓库已不再更新)

感谢大佬们为逆向eapi, weapi, xeapi等加密算法所做的贡献

项目参考:

[trazyn/ieaseMusic](https://github.com/trazyn/ieaseMusic)

[listen1/listen1_chrome_extension](https://github.com/listen1/listen1_chrome_extension)

[chaunsin/netease-cloud-music](https://github.com/chaunsin/netease-cloud-music)

[folltoshe/netease-report-listen-song](https://github.com/folltoshe/netease-report-listen-song)

### SDK 生态

| 语言     | 作者                                          | 地址                                                                                       | 类型  |
|--------|---------------------------------------------|------------------------------------------------------------------------------------------|-----|
| Java   | [JackuXL](https://github.com/JackuXL)       | [NeteaseCloudMusicApi-SDK](https://github.com/JackuXL/NeteaseCloudMusicApi-SDK)          | 第三方 |
| Java   | [1015770492](https://github.com/1015770492) | [yumbo-music-utils](https://github.com/1015770492/yumbo-music-utils)      | 第三方 |
| Python | [盧瞳](https://github.com/2061360308)         | [NeteaseCloudMusic_PythonSDK](https://github.com/2061360308/NeteaseCloudMusic_PythonSDK) | 第三方 |
| Swift  | [Lincb522](https://github.com/Lincb522)  | [NeteaseCloudMusicApi-Swift](https://github.com/Lincb522/NeteaseCloudMusicAPI-Swift)     | 第三方 |
| Rust   | [SPlayer-Dev](https://github.com/splayer-dev)  | [ncm-api-rs](https://github.com/SPlayer-Dev/ncm-api-rs)     | 第三方 |


### 依赖此项目的优秀开源项目

- [qier2222/YesPlayMusic](https://github.com/qier222/YesPlayMusic)

- [MaigoLabs/amaoke.app](https://github.com/MaigoLabs/amaoke.app)

- [Yueby/music-together](https://github.com/Yueby/music-together)

- [chthollyphlie/folia-major](https://github.com/chthollyphile/folia-major)

## License

[MIT License](https://github.com/MoeFurina/NeteaseCloudMusicApiEnhanced/blob/main/LICENSE)

### 宠物的日常陪伴

不播放音乐时，音符也会按独立计时器眨眼、张望、伸懒腰、挥手或打盹，并偶尔显示简短文字气泡。点击宠物旁的“⋯”可选择“陪我聊聊”“表演一下”，或开启会记住偏好的安静模式，暂停自动待机动作和碎碎念。文字气泡不会播放语音；隐藏宠物、离开页面或将标签页切到后台后会暂停自动互动，回来后重新等待，不补发堆积的消息。系统减少动态效果设置下停止自动动作和呼吸动画。

最近播放页面显示网易云本次返回条数、可显示条数、不同歌曲数和接口提供的云端总数；不再按歌曲 ID 合并重复播放。同一次请求的上限为 100 条，实际数据量由网易云返回结果决定。
