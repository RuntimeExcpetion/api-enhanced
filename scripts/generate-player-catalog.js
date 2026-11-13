const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const root = path.resolve(__dirname, '..')
const ignored = new Set([
  'cookie',
  'proxy',
  'ua',
  'realIP',
  'randomCNIP',
  'crypto',
  'e_r',
  'domain',
  'headers',
  'timeout',
  'checkToken',
  'noCookie',
])
function category(route) {
  if (
    /^\/(login|logout|captcha|register|cellphone|rebind|activate|nickname|countries|user\/(account|detail|level|binding|update|subcount)|avatar)/.test(
      route,
    )
  )
    return '账号与资料'
  if (
    /^\/(search|cloudsearch|personalized|recommend|top|banner|homepage|related|calendar)/.test(
      route,
    )
  )
    return '发现与推荐'
  if (/^\/(playlist|user\/playlist|song\/order|song\/url\/match)/.test(route))
    return '歌单与收藏'
  if (
    /^\/(song|lyric|check\/music|audio|listen|scrobble|personal_fm|fm_trash|player\/download|likelist|like)/.test(
      route,
    )
  )
    return '歌曲与下载'
  if (/^\/(album|artist|artists|musician)/.test(route)) return '歌手与专辑'
  if (
    /^\/(comment|event|share|topic|user\/(follow|fans|event)|follow|hot\/topic)/.test(
      route,
    )
  )
    return '评论与社交'
  if (/^\/(mv|video|mlog)/.test(route)) return '视频与 MV'
  if (/^\/(dj|program|voicelist|voice|broadcast)/.test(route))
    return '电台与播客'
  if (/^\/(cloud|user\/cloud|playlist\/cover|avatar\/upload)/.test(route))
    return '云盘与上传'
  if (/^\/(msg|send|message|user\/comment)/.test(route)) return '消息与通知'
  return '其他功能'
}
function clean(text) {
  return text
    .replace(/\*\*|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}
function buildCatalog(base = root) {
  const document = fs.readFileSync(
    path.join(base, 'public/docs/home.md'),
    'utf8',
  )
  const special = {
    'daily_signin.js': '/daily_signin',
    'fm_trash.js': '/fm_trash',
    'personal_fm.js': '/personal_fm',
  }
  const modules = new Map(
    fs
      .readdirSync(path.join(base, 'module'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => [
        special[name] || '/' + name.slice(0, -3).replace(/_/g, '/'),
        name,
      ]),
  )
  const entries = new Map()
  let title = '',
    lines = []
  function flush() {
    const text = lines.join('\n')
    const addressLines = lines.filter((line) => /接口地址|接口路径/.test(line))
    const routes = [
      ...new Set(
        addressLines.flatMap((line) =>
          [...line.matchAll(/`(\/[\w/.-]+)(?:\?[^`]*)?`/g)].map(
            (match) => match[1],
          ),
        ),
      ),
    ]
    const params = new Map()
    let required = false
    for (const line of lines) {
      if (/必选参数|必需参数/.test(line)) required = true
      if (/可选参数/.test(line)) required = false
      if (/接口地址|调用例子/.test(line)) continue
      for (const match of line.matchAll(
        /`([A-Za-z][\w]{0,39})`\s*[:：]\s*([^`\n]*)/g,
      )) {
        const name = match[1]
        if (!ignored.has(name))
          params.set(name, {
            name,
            required,
            description: clean(match[2]).slice(0, 260),
          })
      }
    }
    for (const route of routes)
      if (!entries.has(route))
        entries.set(route, {
          route,
          title: clean(title) || route,
          category: category(route),
          documented: true,
          description: clean(
            (text.match(
              /说明\s*[:：]\s*([\s\S]*?)(?=\n\*\*|\n必选|\n可选|$)/,
            ) || [])[1] || '',
          ).slice(0, 900),
          documentation: text.trim(),
          params: [...params.values()],
        })
  }
  for (const line of document.split('\n')) {
    const heading = line.match(/^#{3,6}\s+(.+)$/)
    if (heading) {
      flush()
      title = heading[1]
      lines = []
    } else lines.push(line)
  }
  flush()
  for (const [route, name] of modules) {
    const source = fs.readFileSync(path.join(base, 'module', name), 'utf8')
    const entry = entries.get(route) || {
      route,
      title: clean((source.match(/^\/\/\s*(.+)/m) || [])[1] || route),
      category: category(route),
      documented: false,
      description:
        '当前项目模块提供的接口。参数可参考模块说明，并通过额外参数补充。',
      documentation: '',
      params: [],
    }
    entry.supported = true
    entry.module = name
    const known = new Set(entry.params.map((param) => param.name))
    const fields = new Set(
      [...source.matchAll(/query\.([A-Za-z][\w]*)/g)].map((match) => match[1]),
    )
    if (source.includes("plugins/upload'")) fields.add('imgFile')
    for (const field of fields)
      if (!known.has(field) && !ignored.has(field))
        entry.params.push({
          name: field,
          required: false,
          description: '模块支持的参数；具体取值参照接口说明。',
        })
    for (const param of entry.params) {
      param.file = /File$/.test(param.name)
      param.sensitive = /password|captcha|token|secret|phone|email/i.test(
        param.name,
      )
    }
    entry.mutating =
      /(?:^|\/)(?:login|logout|captcha|register|rebind|activate|create|delete|del|update|add|remove|like|follow|subscribe|sub|send|publish|upload|order|scrobble|signin|daily_signin|batch|api)(?:\/|$)/i.test(
        route,
      ) ||
      /^\/(?:playlist\/tracks|cloud|playlist\/subscribe|comment)$/.test(route)
    if (
      [
        '/login/status',
        '/login/qr/key',
        '/login/qr/create',
        '/login/qr/check',
      ].includes(route)
    )
      entry.mutating = false
    entry.upload = entry.params.some((param) => param.file)
    entries.set(route, entry)
  }
  for (const entry of entries.values())
    if (!entry.supported) {
      entry.supported = false
      entry.mutating = false
      entry.upload = false
    }
  const aliases = {
    '/album_songsaleboard': '/album/songsaleboard',
    '/vip/task/v1': '/vip/tasks/v1',
    '/yunbei/tasks/expense': '/yunbei/expense',
    '/yunbei/tasks/receipt': '/yunbei/receipt',
  }
  for (const [legacy, current] of Object.entries(aliases)) {
    const old = entries.get(legacy),
      target = entries.get(current)
    if (old && target)
      entries.set(legacy, {
        ...target,
        ...old,
        supported: true,
        requestRoute: current,
        params: target.params,
        mutating: target.mutating,
        upload: target.upload,
        module: target.module,
      })
  }
  const endpoints = [...entries.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, 'zh-CN') ||
      a.route.localeCompare(b.route),
  )
  return {
    source: '/docs/home.md',
    sourceHash: crypto.createHash('sha256').update(document).digest('hex'),
    moduleCount: modules.size,
    documentedCount: endpoints.filter((entry) => entry.documented).length,
    supportedCount: endpoints.filter((entry) => entry.supported).length,
    endpoints,
  }
}
if (require.main === module) {
  const catalog = buildCatalog()
  fs.writeFileSync(
    path.join(root, 'public/player/catalog.json'),
    JSON.stringify(catalog, null, 2) + '\n',
  )
  console.log(
    `Player catalog: ${catalog.endpoints.length} entries, ${catalog.supportedCount} callable entries, ${catalog.documentedCount} documented routes.`,
  )
}
module.exports = { buildCatalog, category }
