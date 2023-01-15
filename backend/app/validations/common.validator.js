const Joi = require('joi');
const { isObjectId } = require('./validator');

const paginationObj = {
  page: Joi.number().min(1).optional().default(1),
  limit: Joi.number().min(1).max(50).optional().default(10),
  search: Joi.string().optional().allow(null, ''),
  sortWith: Joi.string().optional().default('createdAt'),
  sortBy: Joi.string().valid('asc', 'desc').optional().default('desc'),
};

const pagination = Joi.object(paginationObj);

const businessUnitArray = Joi.object({
  parentBussinessUnitId: Joi.array()
    .items(Joi.string().pattern(isObjectId).required())
    .min(1)
    .required(),
});

const isParamObjectId = (key) =>
  Joi.object({
    [key]: Joi.string().pattern(isObjectId).required(),
  });

const isParamValue = (key) =>
  Joi.object({
    [key]: Joi.string().required(),
  });

module.exports = {
  pagination,
  paginationObj,
  businessUnitArray,
  isParamObjectId,
  isParamValue,
};
