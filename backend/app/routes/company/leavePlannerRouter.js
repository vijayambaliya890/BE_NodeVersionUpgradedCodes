let express = require('express'),
        leavePlannerRouter = express.Router(),
        leavePlannerController = require('../../controllers/company/leavePlannerController')

leavePlannerRouter.post('/create', (req, res) => {
        leavePlannerController.create(req, res)
})

leavePlannerRouter.post('/read', (req, res) => {
        leavePlannerController.read(req, res)
})

leavePlannerRouter.post('/update:id', (req, res) => {
        leavePlannerController.update(req, res)
})

leavePlannerRouter.post('/remove:id', (req, res) => {
        leavePlannerController.delete(req, res)
})

module.exports = leavePlannerRouter