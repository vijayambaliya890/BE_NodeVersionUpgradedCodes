let express = require('express'),
    csvDownloadRouter = express.Router();
    csvDownloadControllers = require('../../controllers/common/csv-download-controller');
   // console.log('csvDownloadControllers',csvDownloadControllers.downloadCsvControllerNew)
csvDownloadRouter.get('', (req, res) => {
    csvDownloadControllers.downloadCsvControllerNew(req, res);
});

module.exports = csvDownloadRouter;