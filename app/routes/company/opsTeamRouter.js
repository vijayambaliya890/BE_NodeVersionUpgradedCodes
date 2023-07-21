let express = require('express'),
    opsTeamRouter = express.Router(),
    opsTeamController = require('./../../controllers/company/opsTeamController')


opsTeamRouter.post('/create', (req, res) => {
    opsTeamController.create(req, res)
})

opsTeamRouter.post('/read', (req, res) => {
    opsTeamController.read(req, res)
})

opsTeamRouter.post('/update', (req, res) => {
    opsTeamController.update(req, res)
})

opsTeamRouter.post('/delete', (req, res) => {
    opsTeamController.delete(req, res)
})

module.exports = opsTeamRouter