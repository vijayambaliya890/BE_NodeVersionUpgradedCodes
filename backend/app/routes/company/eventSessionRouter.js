let express = require('express'),
   eventSessionRouter = express.Router(),
   eventSessionController = require('../../controllers/company/eventSessionController'),
   passport = require('passport'),
   jwt = require('jsonwebtoken'),
   multer = require('multer')
path = require('path')

var storage = multer.diskStorage({
   destination: function (req, file, cb) {
      cb(null, 'public/uploads/event/')
   },
   filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
   }
})

var upload = multer({ storage: storage });
//RENDER

// eventSessionRouter.use(passport.authenticate('jwt', {
//     session: false
// }), /*Allow only admin*/
//     function (req, res, next) {
//         if (req.user.isFlexiStaff !== 1)
//             next();
//         else
//             return res.status(402).send('This account is not permitted to access');
//     });


eventSessionRouter.post('/create', upload.any(), (req, res) => {
   eventSessionController.createEvent(req, res)
});

eventSessionRouter.post('/list', upload.any(), (req, res) => {
   eventSessionController.fetchEvents(req, res)
});

eventSessionRouter.post('/get', upload.any(), (req, res) => {
   eventSessionController.getEventDetails(req, res)
});

eventSessionRouter.post('/update', upload.any(), (req, res) => {
   eventSessionController.editEvent(req, res)
});

eventSessionRouter.post('/delete', upload.any(), (req, res) => {
   eventSessionController.deleteEvent(req, res)
});

eventSessionRouter.post('/session/create', upload.any(), (req, res) => {
   eventSessionController.createSession(req, res)
});

eventSessionRouter.post('/session/update', upload.any(), (req, res) => {
   eventSessionController.editEventSession(req, res)
});

eventSessionRouter.post('/session/editMultipleSessions', upload.any(), (req, res) => {
   eventSessionController.editMultipleSessions(req, res)
});

eventSessionRouter.post('/session/get', upload.any(), (req, res) => {
   eventSessionController.getEventSessionDetails(req, res)
});

eventSessionRouter.post('/session/getSessionsByPost', upload.any(), (req, res) => {
   eventSessionController.getSessionsByPost(req, res)
});
eventSessionRouter.post('/session/getSessionsByPostByUser', upload.any(), (req, res) => {
   eventSessionController.getSessionsByPostByUser(req, res)
});
eventSessionRouter.get('/session/getSessionsForUser', upload.any(), (req, res) => {
   eventSessionController.getSessionsForUser(req, res)
});
eventSessionRouter.get('/session/getAllSessionsForUser', upload.any(), (req, res) => {
   eventSessionController.getAllSessionsForUser(req, res)
});
eventSessionRouter.post('/get-admin-sessions', upload.any(), (req, res) => {
   eventSessionController.getAdminSessions(req, res)
});

eventSessionRouter.post('/attendance', upload.any(), (req, res) => {
   eventSessionController.createStaffAttendance(req, res)
});

eventSessionRouter.post('/attendance/mark-absent', upload.any(), (req, res) => {
   eventSessionController.markStaffAbsent(req, res)
});

eventSessionRouter.post('/attendance/manual', upload.any(), (req, res) => {
   eventSessionController.createManualStaffAttendance(req, res)
});

eventSessionRouter.post('/attendance/list-attendees', upload.any(), (req, res) => {
   eventSessionController.getAttendeesListingPerSlot(req, res)
});

eventSessionRouter.post('/attendance/export-attendees', upload.any(), (req, res) => {
   eventSessionController.exportAttendeesNew(req, res)
});

eventSessionRouter.post('/rsvp/create', upload.any(), (req, res) => {
   eventSessionController.createRSVPRequest(req, res)
});
eventSessionRouter.post('/rsvp/multiple/create', upload.any(), (req, res) => {
   eventSessionController.createRSVPRequestMultiple(req, res)
});
eventSessionRouter.post('/rsvp/cancel', upload.any(), (req, res) => {
   eventSessionController.cancelRSVPRequest(req, res)
});
eventSessionRouter.post('/rsvp/multiple/cancel', upload.any(), (req, res) => {
   eventSessionController.cancelRSVPRequestMultiple(req, res)
});

eventSessionRouter.post('/rsvp/list', upload.any(), (req, res) => {
   eventSessionController.getRSVPEventsForUser(req, res)
});

eventSessionRouter.post('/rsvp/list-attendees', upload.any(), (req, res) => {
   eventSessionController.getRSVPAttendanceStatus(req, res)
});

eventSessionRouter.post('/session/rsvp/list', upload.any(), (req, res) => {
   eventSessionController.getRSVPRequests(req, res)
});

eventSessionRouter.post('/rsvp/approve', upload.any(), (req, res) => {
   eventSessionController.approveRSVPRequest(req, res)
});

eventSessionRouter.post('/rsvp/reject', upload.any(), (req, res) => {
   eventSessionController.rejectRSVPRequest(req, res)
});


eventSessionRouter.post('/session/cancelSession', (req, res) => {
   eventSessionController.cancelSession(req, res)
});
module.exports = eventSessionRouter;
