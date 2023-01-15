const Joi = require('joi');
const { isObjectId } = require('./validator');
const createNotification = Joi.object({
  notificationType: Joi.number().required(),
  notificationTime: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  activeFrom: Joi.string().required(),
  activeTo: Joi.string().optional(),
  day: Joi.number().optional(),
  timeZone: Joi.string().required(),
  isPublish: Joi.boolean().required(), // false means draft
  businessUnitId: Joi.string().pattern(isObjectId).required(),
  notificationSchedule: Joi.number().required(),
  assignUsers: Joi.array().items(
    Joi.object({
      businessUnits: Joi.array().items(Joi.string().optional().allow(null, '')),
      buFilterType: Joi.number().valid(1, 2, 3).default('').required(),
      appointments: Joi.array()
        .items(Joi.string().pattern(isObjectId).optional())
        .min(0),
      subSkillSets: Joi.string().optional(),
      user: Joi.array()
        .items(Joi.string().pattern(isObjectId).optional())
        .min(0),
      admin: Joi.array()
        .items(Joi.string().pattern(isObjectId).optional())
        .min(0),
      allBuToken: Joi.boolean().default(false).optional(),
      allBuTokenStaffId: Joi.string().optional().allow(''),
      customField: Joi.array().min(0),
    }),
  ),
});
const paginateNotification = Joi.object({
  timeZone: Joi.string().required(),
  draw: Joi.number().optional(),
  length: Joi.number().optional(),
  start: Joi.number().optional(),
  columns: Joi.array().optional(),
  order: Joi.array().optional(),
  search: Joi.object().optional(),
  buId: Joi.string().required(),
});
const cancelledNotification = Joi.object({
  id: Joi.string().pattern(isObjectId).required(),
});
const updateNotification = Joi.object({
  _id: Joi.string().pattern(isObjectId).required(),
  notificationType: Joi.number().required(),
  notificationTime: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  activeFrom: Joi.string().required(),
  activeTo: Joi.string().optional(),
  day: Joi.number().optional(),
  isSend: Joi.boolean().default(false).required(),
  timeZone: Joi.string().required(),
  isPublish: Joi.boolean().required(), // false means draft
  businessUnitId: Joi.string().pattern(isObjectId).required(),
  notificationSchedule: Joi.number().required(),
  assignUsers: Joi.array().items(
    Joi.object({
      businessUnits: Joi.array().items(Joi.string().optional().allow(null, '')),
      buFilterType: Joi.number().valid(1, 2, 3).default('').required(),
      appointments: Joi.array().items(Joi.string().optional().allow(null, '')),
      subSkillSets: Joi.string().optional().allow(null, ''),
      user: Joi.array()
        .items(Joi.string().pattern(isObjectId).optional())
        .min(0),
      admin: Joi.array()
        .items(Joi.string().pattern(isObjectId).optional())
        .min(0),
      allBuToken: Joi.boolean().default(false).optional().allow(null, ''),
      allBuTokenStaffId: Joi.string().optional().allow(null, ''),
      customField: Joi.array().min(0),
    }),
  ),
});

module.exports = {
  createNotification,
  paginateNotification,
  cancelledNotification,
  updateNotification,
};
