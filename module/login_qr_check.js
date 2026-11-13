const createOption = require('../util/option.js')
module.exports = async (query, request) => {
  const data = {
    key: query.key,
    type: 3,
  }
  const result = await request(
    `/api/login/qrcode/client/login`,
    data,
    createOption(query),
  )
  return {
    status: 200,
    body: {
      ...result.body,
      cookie: (result.cookie || []).join(';'),
    },
    cookie: result.cookie,
  }
}
