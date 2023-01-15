const validator = {
  body: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    req.body = value;
    return error ? res.throwError(error) : next();
  },
  params: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.params);
    req.params = value;
    return error ? res.throwError(error) : next();
  },
  query: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    req.query = value;
    return error ? res.throwError(error) : next();
  },
};
const isObjectId = new RegExp('^[0-9a-fA-F]{24}$');

module.exports = {
  validator,
  isObjectId,
};
