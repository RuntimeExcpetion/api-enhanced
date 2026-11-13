// 编辑歌单

const createOption = require('../util/option.js')
module.exports = (query, request) => {
  query.desc = query.desc || ''
  query.tags = query.tags || ''
  const data = {
    '/api/playlist/desc/update': JSON.stringify({
      id: query.id,
      desc: query.desc,
    }),
    '/api/playlist/tags/update': JSON.stringify({
      id: query.id,
      tags: query.tags,
    }),
    '/api/playlist/update/name': JSON.stringify({
      id: query.id,
      name: query.name,
    }),
  }
  return request(`/api/batch`, data, createOption(query))
}
