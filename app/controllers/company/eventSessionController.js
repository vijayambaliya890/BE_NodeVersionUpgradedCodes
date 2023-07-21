// Controller Code Starts here
const mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  Post = require('../../models/post'),
  User = require('../../models/user'),
  Event = require('../../models/Event'),
  EventSession = require('../../models/EventSession'),
  EventSessionLog = require('../../models/eventSessionLogs'),
  StaffAttendance = require('../../models/StaffAttendance'),
  RSVPRequest = require('../../models/RSVPRequest'),
  moment = require('moment'),
  _ = require('lodash'),
  __ = require('../../../helpers/globalFunctions'),
  fs = require('fs'),
  { parse } = require('json2csv');
let striptags = require('striptags');
const async = require('async');
const FCM = require('../../../helpers/fcm');
let ChallengeModule = require('../common/challengeController');

function saveeventSessionLog(session, eventId) {
  return new Promise((resolve, reject) => {
    let object = {
      eventId: eventId,
      session: session,
      description: 'Session Cancelled.',
    };
    new EventSessionLog(object)
      .save()
      .then((savedlog) => {
        resolve(savedlog);
      })
      .catch((err) => {
        reject('err');
      });
  });
}

class EventSessionController {
  async createEvent(req, res) {
    console.log('hereee');
    console.log(req.files);
    let teaserImage = '';
    let contentImage = '';
    if (
      typeof req.files[0] !== 'undefined' &&
      typeof req.files[0] !== undefined
    ) {
      teaserImage = req.files[0].filename;
    }
    if (
      typeof req.files[1] !== 'undefined' &&
      typeof req.files[1] !== undefined
    ) {
      contentImage = req.files[1].filename;
    }
    req.body['teaserImage'] = teaserImage;
    req.body['contentImage'] = contentImage;
    let sessionsArray = [];
    let requiredResult = await __.checkRequiredFields(req, ['teaserTitle']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let data = req.body;
        const event = await new Event(data).save();
        return __.out(res, 201, event);
      }
      let sessions = req.body['sessions'];
      //  console.log("event id object =====>>>>"+event_id);
      //   console.log("session object =====>>>>"+sessions);
      // let post_create = await new Post();
      // await post_create.save();
      //eventId = post_create._id;
      const post = await Post.findById(event_id).populate('wallId');
      //   console.log("post object =====>>>>"+post);
      if (!post) return __.out(res, 500);
      //console.log("post object =====>>>>"+post);
      let publishingStartDate = post.publishing
        ? post.publishing.startDate
        : false;
      let publishingEndDate = post.publishing.endDate
        ? post.publishing.endDate
        : false;
      let eventWallStartDate = post.wallId
        ? post.wallId.eventWallStartDate
        : false;
      let eventWallEndDate = post.wallId ? post.wallId.eventWallEndDate : false;
      console.log({
        publishingStartDate,
        publishingEndDate,
        eventWallEndDate,
        eventWallStartDate,
      });
      let insertSessions = [];
      for (let elem of req.body['sessions']) {
        console.log({ elem });
        let start = moment(elem.startDate).utc().format();
        let end = moment(elem.endDate).utc().format();
        console.log('start', start);
        console.log('end', end);
        console.log('publishingStartDate', publishingStartDate);
        console.log('publishingEndDate', publishingEndDate);
        console.log('start', new Date(start));
        console.log('end', new Date(end));
        console.log('publishingStartDate', new Date(publishingStartDate));
        console.log('publishingEndDate', new Date(publishingEndDate));
        // if (start && end
        //     && (new Date(start) < new Date(end))
        //     && (!publishingStartDate || (new Date(publishingStartDate) <= new Date(start)))
        //     && (!publishingEndDate || (new Date(publishingEndDate) >= new Date(end)))
        // )
        // {
        try {
          // elem.startDate = moment(elem.startDate).utc().format();
          // elem.startTime = moment(elem.startTime, "HH:mm").utc().format();
          // elem.endDate = moment(elem.endDate).utc().format();
          // elem.endTime = moment(elem.endTime, "HH:mm").utc().format();
          let insertSession = {
            startDate: start,
            endDate: end,
            startTime: start,
            endTime: end,
            totalParticipantPerSession: elem.totalParticipantPerSession,
            location: elem.location,
            status: elem.status,
            adminIds: elem.adminIds,
            post: post,
          };
          console.log('insertSession::::', insertSession);
          insertSessions.push(insertSession);
        } catch (err) {
          __.log(err);
          return __.out(res, 500);
        }
      }
      let data = await EventSession.insertMany(insertSessions);
      console.log('ibsertMany', data);
      // let prevSessions = post.sessions;
      // console.log("11111",prevSessions);
      var sessionIdArray = [];
      for (var i = 0; i < data.length; i++) {
        sessionIdArray.push(data[i]._id);
      }
      console.log('sessionIdArray', sessionIdArray);
      post.sessions = sessionIdArray;
      console.log('22222', post.sessions);
      // console.log('Updating session list of post', post.sessions);
      await post.save();
      return __.out(res, 201, data);
    } catch (err) {
      console.log('sdhgf,jf');
      __.log(err);
      return __.out(res, 500);
    }
  }

  async editEvent(req, res) {
    const { event_id } = req.body;
    if (req.files) {
      if (req.files[0] != null && (req.files[0].fieldname = 'teaserImage')) {
        req.body['teaserImage'] = req.files[0].filename;
      }
      if (req.files[1] != null && (req.files[1].fieldname = 'contentImage')) {
        req.body['contentImage'] = req.files[1].filename;
      }
    }
    let requiredResult = await __.checkRequiredFields(req, ['event_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let event = await Post.findByIdAndUpdate(
          event_id,
          req.body,
          (err, data) => {
            if (err) {
              return __.out(res, 500);
            }
          },
        );
        event = await Post.findById(event_id);
        return __.out(res, 201, event);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async deleteEvent(req, res) {
    const { event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['event_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let event = await Post.findByIdAndUpdate(
          event_id,
          { isDeleted: true },
          (err, data) => {
            if (err) {
              return __.out(res, 500);
            }
          },
        );
        event = await Post.findById(event_id);
        return __.out(res, 201, event);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async fetchEvents(req, res) {
    try {
      let pageNo = req.body.pageNo ? req.body.pageNo : 0;
      let option = {
        limit: 10,
        skip: pageNo * 10,
      };
      if (pageNo == 'all') option = null;

      let event = await Event.find(null, null, option)
        .populate('sessionsList')
        .exec((err, data) => {
          if (err) {
            return __.out(res, 500);
          }
          return __.out(res, 200, data);
        });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getEventDetails(req, res) {
    const { event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['event_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let post = await Post.findById(event_id)
          .populate('sessions')
          .exec((err, data) => {
            if (err) {
              return __.out(res, 500);
            }
            return __.out(res, 200, data);
          });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createSession(req, res) {
    console.log('11');
    const { event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(
      req,
      ['event_id'],
      ['sessions'],
    );
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let sessions = req.body['sessions'];
        const post = await Post.findById(event_id).populate('wallId');
        if (!post) return __.out(res, 500);

        let publishingStartDate = post.publishing
          ? post.publishing.startDate
          : false;
        let publishingEndDate = post.publishing.endDate
          ? post.publishing.endDate
          : false;
        let eventWallStartDate = post.wallId
          ? post.wallId.eventWallStartDate
          : false;
        let eventWallEndDate = post.wallId
          ? post.wallId.eventWallEndDate
          : false;
        console.log({
          publishingStartDate,
          publishingEndDate,
          eventWallEndDate,
          eventWallStartDate,
        });
        let insertSessions = [];
        for (let elem of req.body['sessions']) {
          try {
            let insertSession = {
              startDate: elem.startDate,
              endDate: elem.endDate,
              startTime: elem.startTime,
              endTime: elem.endTime,
              totalParticipantPerSession: elem.totalParticipantPerSession,
              location: elem.location,
              status: elem.status,
              adminIds: elem.adminIds,
              post: post,
            };
            console.log('insertSession::::', insertSession);
            insertSessions.push(insertSession);
          } catch (err) {
            __.log(err);
            return __.out(res, 500);
          }
        }

        let data = await EventSession.insertMany(insertSessions);
        console.log('ibsertMany', data);
        // let prevSessions = post.sessions;
        // console.log("11111",prevSessions);
        var sessionIdArray = [];
        for (var i = 0; i < data.length; i++) {
          sessionIdArray.push(data[i]._id);
        }
        console.log('sessionIdArray', sessionIdArray);
        post.sessions = sessionIdArray;
        console.log('22222', post.sessions);
        // console.log('Updating session list of post', post.sessions);
        await post.save();
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async editMultipleSessions(req, res) {
    const { event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(
      req,
      ['event_id'],
      ['sessions'],
    );
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let sessions = req.body['sessions'];
        // let post_create = await new Post();
        // await post_create.save();
        //eventId = post_create._id;
        const post = await Post.findById(event_id).populate('wallId');
        if (!post) return __.out(res, 500);
        //console.log("post object =====>>>>"+post);
        let publishingStartDate = post.publishing
          ? post.publishing.startDate
          : false;
        let publishingEndDate = post.publishing.endDate
          ? post.publishing.endDate
          : false;
        let eventWallStartDate = post.wallId
          ? post.wallId.eventWallStartDate
          : false;
        let eventWallEndDate = post.wallId
          ? post.wallId.eventWallEndDate
          : false;
        let insertSessions = [];
        let successArr = [];
        let failedArr = [];
        //let pulled = await Post.update({_id:post._id},{ $set : {'sessions': [] }} , {multi:true})
        for (let elem of req.body['sessions']) {
          try {
            // insertSessions.push(insertSession);
            if (elem._id) {
              let eventSession = await EventSession.findByIdAndUpdate(
                elem._id,
                {
                  $set: {
                    startDate: elem.startDate,
                    endDate: elem.endDate,
                    startTime: elem.startTime,
                    endTime: elem.endTime,
                    totalParticipantPerSession: elem.totalParticipantPerSession,
                    location: elem.location,
                    adminIds: elem.adminIds,
                  },
                });
                if(eventSession){
                successArr.push({ session_id: elem._id });
                }else{
                  failedArr.push({
                    session_id: elem._id,
                    message: 'Session Id not found',
                  });
                }
                  
            } else {
              let insertSession = {
                startDate: elem.startDate,
                endDate: elem.endDate,
                startTime: elem.startTime,
                endTime: elem.endTime,
                totalParticipantPerSession: elem.totalParticipantPerSession,
                location: elem.location,
                status: elem.status,
                adminIds: elem.adminIds,
                post: post,
              };
              console.log('NEW ID');
              let eventsession = new EventSession(insertSession);
              var newSes = await eventsession.save();
              await post.update({ $push: { sessions: newSes._id } });
            }
          } catch (err) {
            console.log('eee', err.stack)
            failedArr.push({
              session_id: elem._id,
              message: JSON.stringify(err),
            });
          }
        }

        if (req.body.deletedSessions.length > 0) {
          for (let elem of req.body['deletedSessions']) {
            if (elem._id) {
              //    await EventSession.update({_id:elem._id},{$set:{isActive:false}});
              var sessionLog = await saveeventSessionLog(elem, post._d);
              console.log(
                'sessionLog: ',
                mongoose.Types.ObjectId(sessionLog._id),
              );
              await post.update({ $push: { eventLog: sessionLog._id } });
              console.log('LOG SAVED', elem._id);
              //   await EventSession.update({_id:elem._id}, {$set: {isCancelled :true}});
              var bookSessionList = await RSVPRequest.find({
                $and: [
                  { session: elem._id },
                  { isRSVPRequestAccepted: { $exists: true } },
                ],
              }).populate({
                path: 'staff',
              });
              if (bookSessionList) {
                var deviceToken = [];
                console.log('found LIST IS : ', bookSessionList.length);
                for (var i = 0; i <= bookSessionList.length - 1; i++) {
                  deviceToken.push(bookSessionList[i].staff.deviceToken);
                }
                console.log('deviceToken: ', deviceToken);
                if (deviceToken && deviceToken.length > 0) {
                  var pushData = {
                      title: 'Session Cancelled!',
                      body: `Booked session is cancelled`,
                      bodyText: `Session You booked has been cancelled!!`,
                      bodyTime: [elem.startDate, elem.endDate],
                      bodyTimeFormat: ['dd MMM, HHmm', 'dd MMM, HHmm'],
                    },
                    collapseKey =
                      post._id; /*unique id for this particular shift */
                  FCM.push(deviceToken, pushData, collapseKey);
                  //deviceToken = [];
                  console.log('NOTIFICATION SENT');
                } else {
                  //nothing to do here
                  console.log('IN ELSE');
                }
              }
            } else {
              console.log('element does not have any id proprty');
            }
          }
        }
        return __.out(res, 201, {
          successArr: successArr,
          failedArr: failedArr,
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async cancelSession(req, res) {
    console.log(req.body);
    try {
      await EventSession.update(
        { _id: req.body._id },
        { $set: { isCancelled: true } },
      );
      return __.out(res, 201);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  create(req, res) {
    return new Promise(async (resolve, reject) => {
      const event = req._id;
      let eventsessions = [];
      console.log({ req });
      try {
        for (let i = 0; i < req.eventSessionArray.length; ++i) {
          //await req.eventSessionArray.forEach(async session => {
          let session = req.eventSessionArray[i];
          let eventsession = await new EventSession(session);
          eventsession.post = event;
          eventSession.attendaceRequiredCount =
            session.totalParticipantPerSession;
          await eventsession.save();
          await eventsessions.push(eventsession.toObject());
        }
        return resolve(eventsessions);
      } catch (err) {
        __.log(err);
        return resolve(eventsessions);
      }
    });
  }

  async editEventSession(req, res) {
    const { session_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['session_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let eventSession = await EventSession.findByIdAndUpdate(
          session_id,
          req.body,
          (err, data) => {
            if (err) {
              return __.out(res, 500);
            }
          },
        );
        eventSession = await EventSession.findById(session_id);
        return __.out(res, 201, eventSession);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getSessionsByPost(req, res) {
    const { event_id } = req.body;
    let allAdmins = [];
    let requiredResult = await __.checkRequiredFields(req, ['event_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let post = await Post.findById(event_id).populate('sessions');
        for (var i = 0; i < post.sessions.length; i++) {
          console.log('ADMIN IN SESSIION IS: ', post.sessions[i].adminIds);
          if (post.sessions[i].adminIds.length > 0) {
            for (var j = 0; j < post.sessions[i].adminIds.length; j++) {
              console.log('J IS: ', j);
              var admin = await User.findById(post.sessions[i].adminIds[j]);
              if (admin) {
                const found = allAdmins.some((el) =>
                  mongoose.Types.ObjectId(el._id).equals(
                    mongoose.Types.ObjectId(admin._id),
                  ),
                );
                if (!found)
                  allAdmins.push({ name: admin.name, _id: admin._id });
              } else {
                console.log('NO similar admin found');
              }
            }
          }
        }
        return __.out(res, 201, { sessions: post.sessions, admins: allAdmins });
        // return __.out(res, 201, post.sessions);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getSessionsByPostByUser(req, res) {
    const { event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['event_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let post = await Post.findById(event_id).populate('sessions');
        post = JSON.stringify(post);
        post = JSON.parse(post);
        var rsvpBooked = 0;
        console.log('req.user._id', req.user._id);
        for (let i = 0; i < post.sessions.length; i++) {
          post.sessions[i].isActive = true;
          post.sessions[i].isExpired = false;
          post.sessions[i].isBoooked = false;
          const session = post.sessions[i];
          let sessionTime = new Date(session.endTime);
          let sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );
          if (new Date() - sessionDate > 0) {
            post.sessions[i].isActive = false;
            post.sessions[i].isExpired = true;
          }
          let rsvpDone = await RSVPRequest.findOne({
            event: event_id,
            staff: req.user._id,
            session: session._id,
          }).sort({ _id: -1 });
          console.log('rsvpDone', rsvpDone);
          if (rsvpDone) {
            post.sessions[i].isActive = false;
            post.sessions[i].isBoooked = true;
            post.sessions[i].rsvpId = rsvpDone._id;
          }
          if (rsvpDone && rsvpDone.isRSVPCancelled) {
            post.sessions[i].isBoooked = false;
            delete post.sessions[i].rsvpId;
          }
          let rsvpcount = await RSVPRequest.find({
            $and: [
              { event: event_id },
              { session: post.sessions[i]._id },
              { isRSVPRequestAccepted: true },
              { isRSVPCancelled: false },
            ],
          }).count();
          console.log(
            'rsvpcount' +
              rsvpcount +
              'totalParticipantPerSession' +
              post.sessions[i].totalParticipantPerSession,
          );
          if (rsvpcount === post.sessions[i].totalParticipantPerSession) {
            post.sessions[i].isSlot = true;
          } else {
            post.sessions[i].isSlot = false;
          }
        }
        for (var j = 0; j <= post.sessions.length - 1; j++) {
          if (post.sessions[j].isBoooked == true) {
            rsvpBooked = rsvpBooked + 1;
          }
        }
        var response = { RSVPBooked: rsvpBooked, sessions: post.sessions };
        console.log('RESPONSE OF SESSIONS: ', response);
        return __.out(res, 201, response);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getSessionsForUser(req, res) {
    try {
      let rsvpDone = await RSVPRequest.find({
        staff: req.user._id,
        isDeleted: false,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
        isRSVPRequested: true,
      }).populate([
        {
          path: 'session',
          match: {
            isCancelled: false,
          },
        },
        {
          path: 'event',
          populate: [
            {
              path: 'wallId',
            },
          ],
        },
      ]);
      //return res.json({ rsvpDone })
      rsvpDone = JSON.parse(JSON.stringify(rsvpDone));
      let finalData = [];
      const currentDate = moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');
      for (let i = 0; i < rsvpDone.length; i++) {
        const session = rsvpDone[i].session;
        if (session) {
          let sessionTime = new Date(session.endTime);
          let sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );
          if (new Date() - sessionDate < 0) {
            if (rsvpDone[i] && rsvpDone[i].event && rsvpDone[i].event.wallId) {
              rsvpDone[i].event.wallId.eventWallStartDate = moment(
                rsvpDone[i].event.wallId.eventWallStartDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              rsvpDone[i].event.wallId.eventWallEndDate = moment(
                rsvpDone[i].event.wallId.eventWallEndDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              if (
                new Date(
                  rsvpDone[i].event.wallId.eventWallStartDate,
                ).getTime() <= new Date(currentDate).getTime() &&
                new Date(currentDate).getTime() <=
                  new Date(rsvpDone[i].event.wallId.eventWallEndDate).getTime()
              ) {
                rsvpDone[i].event.isWall = true;
              } else {
                rsvpDone[i].event.isWall = false;
              }
            } else {
              rsvpDone[i].event.isWall = false;
            }
            finalData.push(rsvpDone[i]);
          }
        }
      }
      finalData = finalData.sort(function (a, b) {
        return a.session.startDate && b.session.startDate
          ? new Date(a.session.startDate).getTime() -
              new Date(b.session.startDate).getTime()
          : null;
      });
      // finalData = finalData.sort(function (a, b) { return new Date(a.session.startDate).getTime() - new Date(b.session.startDate).getTime() });
      return __.out(res, 200, finalData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getAllSessionsForUser(req, res) {
    try {
      let rsvpDone = await RSVPRequest.find({
        staff: req.user._id,
        isDeleted: false,
        isRSVPCancelled: false,
        isRSVPRequestAccepted: true,
        isRSVPRequested: true,
      }).populate([
        {
          path: 'session',
          match: {
            isCancelled: false,
          },
        },
        {
          path: 'event',
          populate: [
            {
              path: 'wallId',
            },
          ],
        },
      ]);
      //return res.json({ rsvpDone })
      rsvpDone = JSON.parse(JSON.stringify(rsvpDone));
      let finalData = [];
      let currentDate = new Date(); //moment(moment().utc()).format('MM-DD-YYYY HH:mm:ss');
      currentDate = new Date(currentDate.setMonth(currentDate.getMonth() - 6));
      currentDate = moment(moment(new Date(currentDate)).utc()).format(
        'MM-DD-YYYY HH:mm:ss',
      );
      console.log('currentDate', currentDate);
      for (let i = 0; i < rsvpDone.length; i++) {
        const session = rsvpDone[i].session;
        if (session) {
          let sessionTime = new Date(session.endTime);
          let sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );
          if (new Date(currentDate) - sessionDate < 0) {
            if (rsvpDone[i] && rsvpDone[i].event && rsvpDone[i].event.wallId) {
              rsvpDone[i].event.wallId.eventWallStartDate = moment(
                rsvpDone[i].event.wallId.eventWallStartDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              rsvpDone[i].event.wallId.eventWallEndDate = moment(
                rsvpDone[i].event.wallId.eventWallEndDate,
              ).format('MM-DD-YYYY HH:mm:ss');
              if (
                new Date(
                  rsvpDone[i].event.wallId.eventWallStartDate,
                ).getTime() <= new Date(currentDate).getTime() &&
                new Date(currentDate).getTime() <=
                  new Date(rsvpDone[i].event.wallId.eventWallEndDate).getTime()
              ) {
                rsvpDone[i].event.isWall = true;
              } else {
                rsvpDone[i].event.isWall = false;
              }
            } else {
              rsvpDone[i].event.isWall = false;
            }
            finalData.push(rsvpDone[i]);
          }
        }
      }
      finalData = finalData.sort(function (a, b) {
        return a.session.startDate && b.session.startDate
          ? new Date(b.session.startDate).getTime() -
              new Date(a.session.startDate).getTime()
          : null;
      });
      return __.out(res, 200, finalData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  // async getSessionsByPost(req,res){
  //     const {event_id} = req.body;
  //     let requiredResult = await __.checkRequiredFields(req, ['event_id']);
  //     try{
  //         if (requiredResult.status === false) {
  //             __.out(res, 400, requiredResult.missingFields);
  //         }else{
  //             let sessions = await Post.findById(event_id).populate('sessions')
  //             return __.out(res, 201, {sessions});
  //         }
  //     } catch (err) {
  //         __.log(err);
  //         return __.out(res, 500);
  //     }
  // }

  async getAdminSessions(req, res) {
    console.log('adminsession');
    const { event_id, admin_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'admin_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let sessions = await EventSession.find({
          adminIds: { $elemMatch: { $eq: admin_id } },
          post: event_id,
        }).lean();
        return __.out(res, 201, sessions);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getEventSessionDetails(req, res) {
    //console.log(" \n \n getEventSessionDetails==> \n \n ");
    const { event_id, session_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'session_id',
      'event_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let eventSession = await EventSession.findById(session_id).lean();
        let postDetails = await Post.findById(event_id).lean();
        console.log(eventSession['attendaceRequiredCount']);
        let attendaceRequiredCount = parseInt(
          eventSession['attendaceRequiredCount'],
        );
        //attendaceRequiredCount =4;
        let staffAttendance = await StaffAttendance.find(
          {
            event: event_id,
            session: session_id,
            isRSVPCancelled: { $ne: true },
          },
          'appointmentSlotNumber staff appointmentType session',
        )
          .sort('appointmentSlotNumber')
          .populate({
            path: 'staff',
            select:
              'email name role otherFields viewBussinessUnitId planBussinessUnitId planBussinessUnitId profilePicture staffId',
          })
          .lean();
        let listOfAttendees = staffAttendance;
        staffAttendance = staffAttendance.map((x) => x.appointmentSlotNumber);
        let attendance = {};
        let j = 0;
        for (j = 0; j < attendaceRequiredCount; j++) {
          attendance[j + 1] = 0;
        }
        staffAttendance.forEach((slot) => {
          attendance[slot] = attendance[slot] ? attendance[slot] + 1 : 1;
        });
        eventSession.attendance = attendance;
        let rsvpRequests = await RSVPRequest.find({
          event: event_id,
          session: session_id,
          isRSVPCancelled: false,
          isRSVPRequestAccepted: true,
        })
          .populate({
            path: 'staff',
            select:
              'email name role otherFields viewBussinessUnitId planBussinessUnitId planBussinessUnitId profilePicture staffId',
          })
          .lean();
        console.log({ rsvpRequests });
        for (let i = 0; i < rsvpRequests.length; ++i) {
          if (rsvpRequests[i].staff && rsvpRequests[i].staff._id) {
            let attendances = await StaffAttendance.find(
              {
                staff: rsvpRequests[i].staff._id,
                event: event_id,
                session: session_id,
                status: { $ne: false },
              },
              'appointmentSlotNumber',
            ).lean();
            console.log('attendances: ');
            console.log(attendances.map((x) => x.appointmentSlotNumber));
            rsvpRequests[i].attenanceInfo = attendances.map(
              (x) => x.appointmentSlotNumber,
            );
          }
        }
        let rsvp = {};
        rsvp.totalRequest = rsvpRequests.length;
        rsvp.rsvpRequesterList = rsvpRequests;
        rsvp.postDetails = postDetails;
        rsvp.attendanceList = listOfAttendees;
        rsvp.acceptedRequest = rsvpRequests.filter(
          (x) => x.isRSVPRequestAccepted && !x.isRSVPCancelled,
        ).length;
        rsvp.rejectedRequest = rsvpRequests.filter(
          (x) => x.isRSVPRequestDeclined && !x.isRSVPCancelled,
        ).length;
        rsvp.canceledRequest = rsvpRequests.filter(
          (x) => x.isRSVPCancelled,
        ).length;
        rsvp.pendigRequst = rsvpRequests.filter(
          (x) =>
            !x.isRSVPRequestDeclined &&
            !x.isRSVPRequestAccepted &&
            !x.isRSVPCancelled,
        ).length;
        eventSession.rsvp = rsvp;
        eventSession.totalAttendanceTaking =
          postDetails.eventDetails.totalAttendanceTaking;
        return __.out(res, 201, { eventSession });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createStaffAttendance(req, res) {
    const { event_id, staff_id, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let data = req.body;
        const isAttendance = await StaffAttendance.findOne({
          session: session_id,
          event: event_id,
          staff: staff_id,
        }); // check same session have attendance of that staff or not
        const staffAttendance = await new StaffAttendance(data);
        const event = await Post.findOne({
          _id: event_id,
          postType: 'event',
        }).lean();
        const session = await EventSession.findById(session_id).lean();
        const staff = await User.findById(staff_id).lean();
        if (!event || !session || !staff)
          return __.out(res, 400, {
            error: 'event_id, session_id or staff_id did not matched',
          });
        staffAttendance.staff = staff_id;
        staffAttendance.event = event;
        staffAttendance.session = session;
        staffAttendance.appointmentType = 'auto';
        let dupplicateCheck = await StaffAttendance.findOne({
          event: event_id,
          staff: staff_id,
          session: session_id,
          appointmentSlotNumber: appointmentSlotNumber,
        });
        if (dupplicateCheck && !dupplicateCheck.status) {
          let data = await dupplicateCheck.update({ status: true });
          return __.out(res, 201, dupplicateCheck);
        } else if (dupplicateCheck) return __.out(res, 300, 'Duplicate');

        const data1 = await staffAttendance.save();
        if (!isAttendance) {
          await ChallengeModule.triggerChallenge(
            res,
            staff_id,
            event_id,
            'channel',
            3,
          );
        }
        return __.out(res, 201, data1);
        /*await staffAttendance.save((err, data) => {
                    if (err) {
                        __.log(err);
                        return __.out(res, 500);
                    }
                    if(!isAttendance){
                        // ChallengeModule.triggerChallenge(
                        //     res
                        //     staff_id,
                        //     event_id,
                        //     "channel",
                        //     3
                        // );
                    }
                    return __.out(res, 201, data);
                });*/
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async markStaffAbsent(req, res) {
    const { event_id, staff_ids, session_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'staff_ids',
      'event_id',
      'session_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const event = await Post.findOne({
          _id: event_id,
          postType: 'event',
        }).lean();
        const session = await EventSession.findById(session_id).lean();
        if (!event || !session)
          return __.out(res, 400, {
            error: 'event_id, session_id or staff_id did not matched',
          });

        let result = {
          n: 0,
          nModified: 0,
          ok: 0,
        };
        for (let i = 0; i < staff_ids.length; ++i) {
          const staff = await User.findById(staff_ids[i]).lean();
          if (!staff) continue;

          let data = await StaffAttendance.updateMany(
            {
              event: event_id,
              staff: staff_ids[i],
              session: session_id,
            },
            {
              event: event_id,
              staff: staff_ids[i],
              session: session_id,
              status: false,
            },
            {
              upsert: true,
            },
          );
          result.n += data.n;
          result.nModified += data.nModified;
          result.ok = data.ok;
        }
        return __.out(res, 201, result);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async createManualStaffAttendance(req, res) {
    const { event_id, staff_ids, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'staff_ids',
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const event = await Post.findOne({
          _id: event_id,
          postType: 'event',
        }).lean();
        const session = await EventSession.findById(session_id).lean();
        if (!event || !session)
          return __.out(res, 400, {
            error: 'event_id, session_id did not matched',
          });

        if (!(typeof staff_ids == 'object') || !(staff_ids instanceof Array))
          __.out(res, 400, 'Invalid staff_ids, must be an array');

        let attendances = [];
        for (let i = 0; i < staff_ids.length; ++i) {
          const staff = await User.findById(staff_ids[i]).lean();
          if (!staff)
            return __.out(res, 300, 'Invalid staff_id ' + staff_ids[i]);

          let attendance = {
            staff: staff_ids[i],
            event: event,
            session: session,
            appointmentType: 'manual',
            appointmentSlotNumber: appointmentSlotNumber,
          };
          let dupplicateCheck = await StaffAttendance.find({
            event: event_id,
            staff: staff_ids[i],
            session: session_id,
            appointmentSlotNumber: appointmentSlotNumber,
          });
          let isAttendance = await StaffAttendance.findOne({
            event: event_id,
            staff: staff_ids[i],
            session: session_id,
          });
          if (!isAttendance) {
            await ChallengeModule.triggerChallenge(
              res,
              staff_ids[i],
              event_id,
              'channel',
              3,
            );
          }

          if (dupplicateCheck.length)
            return __.out(
              res,
              300,
              'Duplicate attendance for staff_id ' + staff_ids[i],
            );

          attendances.push(attendance);
        }
        await StaffAttendance.insertMany(attendances, (err, data) => {
          if (err) {
            __.log(err);
            return __.out(res, 500);
          }
          return __.out(res, 201, data);
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAttendeesListingPerSlot(req, res) {
    const { event_id, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let where = {
          event: event_id,
          session: session_id,
          appointmentSlotNumber: appointmentSlotNumber,
        };
        // Pagination
        let pageNo = req.body.pageNo;
        let option = {
          limit: 10,
          skip: pageNo * 10,
        };
        if (req.body.pageNo != 0 && !req.body.pageNo) option = null;
        await StaffAttendance.find(where, null, option)
          .populate({
            path: 'staff',
            populate: {
              path: 'appointmentId parentBussinessUnitId',
            },
          })
          .lean()
          .exec((err, data) => {
            if (err) {
              __.log(err);
              return __.out(res, 500);
            }
            /*
                        // Respone with limited staff details
                        if (!data.length) return __.out(res, 201, data);
                        data = data.map(x => {
                            if (x.staff) {
                                x.staff = {
                                    _id: x.staff._id,
                                    name: x.staff.name,
                                    email: x.staff.email
                                };
                            }
                            return x;
                        });
                        */
            return __.out(res, 201, data);
          });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getRSVPAttendanceStatus(req, res) {
    const { event_id, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
      'appointmentSlotNumber',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let where = {
          event: event_id,
          session: session_id,
          //    isRSVPRequestAccepted: true,
          isDeleted: { $ne: true },
          isRSVPCancelled: { $ne: true },
        };
        // Pagination
        let pageNo = req.body.pageNo;
        let option = {
          limit: 10,
          skip: pageNo * 10,
        };
        if (req.body.pageNo != 0 && !req.body.pageNo) option = null;

        await RSVPRequest.find(where, null, option)
          .populate({
            path: 'staff',
            //   select: 'name email appointmentId parentBussinessUnitId',
            populate: [
              {
                path: 'parentBussinessUnitId',
                select: 'sectionId name orgName',
                populate: {
                  path: 'sectionId',
                  select: 'departmentId name',
                  populate: {
                    path: 'departmentId',
                    select: 'name status companyId',
                    populate: {
                      path: 'companyId',
                      select: 'name',
                    },
                  },
                },
              },
              {
                path: 'appointmentId',
              },
            ],
          })
          .lean()
          .exec(async (err, rsvps) => {
            if (err) {
              __.log(err);
              return __.out(res, 500);
            }
            let staffs = rsvps
              .map((x) => x.staff)
              .filter((x) => x)
              .map((x) => x._id);
            staffs = staffs.filter((x, i) => {
              return staffs.indexOf(x) === i;
            });
            console.log('staffs: ', staffs);
            let attendances = await StaffAttendance.find({
              staff: { $in: staffs },
              event: event_id,
              session: session_id,
              appointmentSlotNumber: appointmentSlotNumber,
              status: { $ne: false },
            }).lean();
            console.log('attendances:', attendances);
            let attendedStaffs = attendances.map((x) => x.staff);
            console.log('attendedStaffs:', attendedStaffs);
            for (var i = 0; i <= rsvps.length - 1; i++) {
              if (
                rsvps[i].staff &&
                rsvps[i].staff._id &&
                JSON.parse(
                  JSON.stringify(attendedStaffs).indexOf(
                    rsvps[i].staff._id.toString(),
                  ) > -1,
                )
              ) {
                rsvps[i].appointmentStatus = true;
              } else {
                rsvps[i].appointmentStatus = false;
              }
              let attendanceStaff = await StaffAttendance.find(
                {
                  staff: rsvps[i].staff._id,
                  event: event_id,
                  session: session_id,
                  status: { $ne: false },
                },
                { appointmentSlotNumber: 1, staff: 1 },
              ).lean();
              rsvps[i].attendanceStaff = attendanceStaff;
              console.log('ATTENDANCECOUNT: ', attendanceStaff);
            }
            // rsvps.forEach((rsvp, i) => {
            //     if (rsvp.staff
            //         && rsvp.staff._id
            //         && JSON.parse(JSON.stringify(attendedStaffs).indexOf(rsvp.staff._id.toString()) > -1)) {
            //         rsvps[i].appointmentStatus = true;
            //     } else {
            //         rsvps[i].appointmentStatus = false;
            //     }
            // });
            if (req.body.apptStatus == 'P' || req.body.apptStatus == 'p') {
              rsvps = rsvps.filter((x) => x.appointmentStatus);
            } else if (
              req.body.apptStatus == 'A' ||
              req.body.apptStatus == 'a'
            ) {
              rsvps = rsvps.filter((x) => !x.appointmentStatus);
            }
            console.log('RESPOPNSE: ');
            __.out(res, 201, rsvps);
          });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportAttendees(req, res) {
    console.log('here');
    const { event_id, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);
    try {
      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let where = {
        event: event_id,
        session: session_id,
      };
      if (parseInt(appointmentSlotNumber) > 0) {
        where['appointmentSlotNumber'] = appointmentSlotNumber;
      }
      const attendances = await StaffAttendance.find(where)
        .sort('appointmentSlotNumber')
        .populate({
          path: 'staff',
          select: 'name appointmentId staffId parentBussinessUnitId',
          populate: [
            {
              path: 'appointmentId',
              select: 'name',
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
            },
          ],
        })
        .populate({
          path: 'session',
          select: 'location startDate endDate',
        })
        .populate({
          path: 'event',
          select: 'teaser sessions',
          options: { lean: true },
        })
        .lean();
      let csvLink = '';
      let fieldsArray = [
        'event title',
        'session number',
        'location',
        'slot number',
        'staffId',
        'staff name',
        'appointment name',
        'parentBussinessUnitId',
        'attendance Date and Time',
        'attendance status',
        'RSVP start Date time',
        'RSVP end date time',
      ];
      let jsonArray = [];
      if (!attendances.length)
        return __.out(res, 201, { csvLink: csvLink, noData: false });

      attendances.forEach((attendance) => {
        let json = {};
        json['event title'] = attendance.event
          ? attendance.event.teaser
            ? attendance.event.teaser.title
            : null
          : null;
        json['event title'] = striptags(json['event title']);
        json['session number'] =
          attendance.event &&
          attendance.event.sessions &&
          typeof attendance.event.sessions == 'object' &&
          attendance.event.sessions instanceof Array
            ? JSON.parse(JSON.stringify(attendance.event.sessions)).indexOf(
                session_id,
              )
            : null;

        json['session number'] = parseInt(json['session number']) + 1;
        json['location'] = attendance.session
          ? attendance.session.location
          : null;
        json['slot number'] = attendance.appointmentSlotNumber;
        json['staffId'] = attendance.staff ? attendance.staff.staffId : null;
        json['staff name'] = attendance.staff ? attendance.staff.name : null;
        json['appointment name'] =
          attendance.staff && attendance.staff.appointmentId
            ? attendance.staff.appointmentId.name
            : null;
        json['parentBussinessUnitId'] =
          attendance.staff && attendance.staff.parentBussinessUnitId
            ? attendance.staff.parentBussinessUnitId.name
            : null;
        //json['attendance Date and Time'] = moment(attendance.createdAt).format('LLL');
        json['attendance Date and Time'] = moment(attendance.createdAt)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        json['attendance status'] = attendance.status;
        json['RSVP start Date time'] = moment(attendance.session.startDate)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        json['RSVP end date time'] = moment(attendance.session.endDate)
          .utcOffset(req.body.timeZone)
          .format('YYYY-MM-DD HH:mm');
        jsonArray.push(json);
      });
      
      if (!jsonArray.length)
        return __.out(res, 201, { csvLink: csvLink, noData: false });
      const fields = fieldsArray;
      const opts = { fields };
      var csv = parse(jsonArray, opts);
      res.setHeader('Content-disposition', 'attachment; filename=testing.csv');
      res.set('Content-Type', 'application/csv');
      res.status(200).json({ csv, noData: true });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async exportAttendeesNew(req, res) {
    console.log('here');
    const { event_id, session_id, appointmentSlotNumber } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        console.log('I am', event_id);
        let eventInfoTemp = await this.getAttendanceCount(res, event_id);
        // console.log('eventInfoTemp', JSON.stringify(eventInfoTemp));
        let eventInfo;
        let attendanceCount = 0;
        if (eventInfoTemp) {
          eventInfo = {
            eventId: eventInfoTemp._id,
            name: eventInfoTemp.teaser.title,
            sessionInfo: eventInfoTemp.sessions,
          };
          // console.log('hey', JSON.stringify(eventInfo));
          if (eventInfoTemp.eventDetails) {
            attendanceCount = eventInfoTemp.eventDetails.totalAttendanceTaking;
          }
          //res.json({attendanceCount});
        } else {
          return __.out(res, 201, { csvLink: '', noData: false });
        }
        RSVPRequest.aggregate([
          {
            $match: {
              event: mongoose.Types.ObjectId(event_id),
              isRSVPCancelled: false,
            },
          },
          {
            $lookup: {
              from: 'users',
              foreignField: '_id',
              localField: 'staff',
              as: 'userInfo',
            },
          },
          {
            $unwind: '$userInfo',
          },
          {
            $lookup: {
              from: 'appointments',
              foreignField: '_id',
              localField: 'userInfo.appointmentId',
              as: 'appointmentId',
            },
          },
          { $unwind: '$appointmentId' },
          {
            $lookup: {
              from: 'subsections',
              foreignField: '_id',
              localField: 'userInfo.parentBussinessUnitId',
              as: 'parentBussinessUnitId',
            },
          },
          { $unwind: '$parentBussinessUnitId' },
          {
            $lookup: {
              from: 'sections',
              foreignField: '_id',
              localField: 'parentBussinessUnitId.sectionId',
              as: 'sectionId',
            },
          },
          { $unwind: '$sectionId' },
          {
            $lookup: {
              from: 'departments',
              foreignField: '_id',
              localField: 'sectionId.departmentId',
              as: 'department',
            },
          },
          { $unwind: '$department' },
          {
            $lookup: {
              from: 'companies',
              foreignField: '_id',
              localField: 'department.companyId',
              as: 'company',
            },
          },
          { $unwind: '$company' },
          {
            $lookup: {
              from: 'staffattendances',
              foreignField: 'event',
              localField: 'event',
              as: 'attendance',
            },
          },
        ])
          .then((result) => {
            //return res.json(result);
            result.forEach((item) => {
              item.attendance = item.attendance.filter((att) => {
                return att.staff.toString() === item.userInfo._id.toString();
              });
              for (let i = 1; i <= attendanceCount; i++) {
                const slotFound = item.attendance.filter((slot) => {
                  return slot.appointmentSlotNumber === i;
                });
                if (slotFound.length === 0) {
                  const slotObj = {
                    appointmentSlotNumber: i,
                    attendanceStatus: 'No',
                  };
                  item.attendance.push(slotObj);
                }
              }
            });
            let fieldsArray = [
              'event title',
              'session number',
              'location',
              'number of slot',
              'staffId',
              'staff name',
              'appointment name',
              'parentBussinessUnitId',
              'RSVP start Date time',
              'RSVP end date time',
            ];
            // 'attendance Date and Time', 'attendance status'
            for (let i = 0; i < attendanceCount; i++) {
              const str1 = `Slot ${i + 1} Attendance Date and Time`;
              const str2 = `Slot ${i + 1} attendance status`;
              fieldsArray.push(str1);
              fieldsArray.push(str2);
            }
            let jsonArray = [];
            const sessionNumber = [];
            eventInfo.sessionInfo.forEach((item, index) => {
              const number = index + 1;
              const sessionId = item._id;
              const obj = {
                number,
                sessionId,
                location: item.location,
                startDate: item.startDate,
                endDate: item.endDate,
              };
              sessionNumber.push(obj);
            });
            if (!result.length)
              return __.out(res, 201, { csvLink: '', noData: false });
            result.forEach((attendance) => {
              let json = {};
              json['event title'] = eventInfo ? eventInfo.name : null;
              json['event title'] = striptags(json['event title']);
              const Number = sessionNumber.find((sesNum) => {
                return (
                  sesNum.sessionId.toString() === attendance.session.toString()
                );
              });
              if (Number) {
                json['session number'] = Number.number;
                json['location'] = Number.location;
              } else {
                json['session number'] = 0;
                json['location'] = 0;
              }
              json['number of slot'] = attendanceCount;
              json['staffId'] = attendance.userInfo
                ? attendance.userInfo.staffId
                : null;
              json['staff name'] = attendance.userInfo
                ? attendance.userInfo.name
                : null;
              json['appointment name'] = attendance.appointmentId
                ? attendance.appointmentId.name
                : null;
              json['parentBussinessUnitId'] = this.getBuName(attendance);
              if (Number) {
                json['RSVP start Date time'] = moment(Number.startDate)
                  .utcOffset(req.body.timeZone)
                  .format('YYYY-MM-DD HH:mm');
                json['RSVP end date time'] = moment(Number.endDate)
                  .utcOffset(req.body.timeZone)
                  .format('YYYY-MM-DD HH:mm');
              } else {
                json['RSVP start Date time'] = '';
                json['RSVP end date time'] = '';
              }
              for (let i = 1; i <= attendanceCount; i++) {
                const str1 = `Slot ${i} Attendance Date and Time`;
                const str2 = `Slot ${i} attendance status`;
                attendance.attendance.forEach((attItem) => {
                  if (attItem.appointmentSlotNumber === i) {
                    if (attItem.attendanceStatus === 'No') {
                      json[str1] = '';
                      json[str2] = '';
                    } else if (attItem.status) {
                      json[str1] = moment(attItem.createdAt)
                        .utcOffset(req.body.timeZone)
                        .format('YYYY-MM-DD HH:mm');
                      json[str2] = true;
                    } else {
                      json[str1] = '';
                      json[str2] = '';
                    }
                  }
                });
              }
              jsonArray.push(json);
            });
            console.log('HIIiiiiiiii********');
            //res.json({fieldsArray,jsonArray});
            const fields = fieldsArray;
            const opts = { fields };
            var csv = parse(jsonArray, opts);
            res.setHeader(
              'Content-disposition',
              'attachment; filename=testing.csv',
            );
            res.set('Content-Type', 'application/csv');
            return res.status(200).json({ csv, noData: true });
          })
          .catch((err1) => {
            console.log('err1', err1);
          });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  getBuName(attendance) {
    if (attendance.parentBussinessUnitId) {
      return (
        '' +
        attendance.company.name +
        '->' +
        attendance.department.name +
        '->' +
        attendance.sectionId.name +
        '->' +
        attendance.parentBussinessUnitId.name
      );
    } else {
      return '';
    }
  }
  getAttendanceCount(res, eventId) {
    try {
      return new Promise((resolve, reject) => {
        Post.findById(eventId)
          .populate('sessions')
          .exec((err, data) => {
            console.log(err);
            if (err) {
              reject(null);
            }
            resolve(data);
          });
        /* Post.find({_id:mongoose.Types.ObjectId(eventId)}).populate('sessions')
                /!*([
                    {
                        $match:{
                            _id: mongoose.Types.ObjectId(eventId)
                        }
                    },{
                    $lookup:{
                        from:'eventsessions',
                        foreignField:'_id',
                        localField:'sessions',
                        as:'sessionInfo'
                    }
                    }
                ])*!/
                    .then((result)=>{
                    resolve(result);
                }).catch((err)=>{
                    reject(null);
                })*/
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async createRSVPRequest(req, res) {
    const { event_id, staff_id, session_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'session_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let data = req.body;
        const rsvpRequest = await new RSVPRequest(data);
        const event = await Post.findOne({ _id: event_id, postType: 'event' });
        const session = await EventSession.findOne({
          _id: session_id,
          post: event,
        }).lean();
        console.log(session);
        if (!event || !session)
          return __.out(res, 400, { error: 'invalid event_id or session_id' });

        rsvpRequest.staff = staff_id;
        rsvpRequest.event = event;
        rsvpRequest.session = session;
        rsvpRequest.isRSVPRequested = true;
        rsvpRequest.isRSVPCancelled = false;
        rsvpRequest.isDeleted = false;
        // Check session expiry
        let sessionTime = new Date(session.endTime);
        let sessionDate = new Date(session.endDate).setHours(
          sessionTime.getHours(),
          sessionTime.getMinutes(),
          sessionTime.getSeconds(),
          0,
        );
        // console.log("sessionDate::",sessionDate)
        console.log({
          sessionDate,
          sessionTime,
          date: session.startDate,
          time: session.startTime,
        });
        console.log(new Date() - sessionDate);
        if (new Date() - sessionDate > 0)
          return __.out(res, 201, { error: 'Session expired', data: null });

        /* // rsvp request overflow check using attendanceRequireddCount field.
                console.log('session.atten: ',  session.attendaceRequiredCount);
                if (!session.attendaceRequiredCount) return __.out(res, 500);
                */
        // rsvp request overflow check
        let existingAcceptedReq = await RSVPRequest.find({
          isRSVPRequestAccepted: true,
          isRSVPCancelled: { $ne: true },
          isDeleted: { $ne: true },
          event: event,
          session: session,
        });
        console.log(
          'existingAcceptedReq.length::::',
          existingAcceptedReq.length,
        );
        console.log(
          'session.totalParticipantPerSession::::',
          session.totalParticipantPerSession,
        );
        if (existingAcceptedReq.length >= session.totalParticipantPerSession) {
          return __.out(res, 400, { error: 'All slots are full' });
        }
        let duplicateCheck = await RSVPRequest.find({
          staff: staff_id,
          event: event,
          isRSVPCancelled: { $ne: true },
          isDeleted: { $ne: true },
          session: session,
        });
        //if (duplicateCheck.length) return __.out(res, 201);
        if (duplicateCheck.length)
          return __.out(res, 201, {
            duplicates: duplicateCheck.map((x) => x._id),
          });

        await rsvpRequest.save(async (err, data) => {
          if (err) {
            __.log(err);
            return __.out(res, 500);
          }
          //await EventSession.findByIdAndUpdate(session_id, {attendaceRequiredCount: --session.attendaceRequiredCount});
          return __.out(res, 201, data);
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async createRSVPRequestMultiple(req, res) {
    let { event_id, staff_id, sessionid } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'staff_id',
      'event_id',
      'sessionid',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        //  session_id = session_id[0]
        let failedSessionBooking = [];
        let successSessionBooking = [];
        for (let i = 0; i < sessionid.length; i++) {
          let session_id = sessionid[i];
          console.log(session_id, sessionid);
          let data = req.body;
          console.log('data', data);
          data.session_id = session_id;
          delete data.sessionid;
          console.log('data', data);
          const rsvpRequest = await new RSVPRequest(data);
          const event = await Post.findOne({
            _id: event_id,
            postType: 'event',
          });
          const session = await EventSession.findOne({
            _id: session_id,
            post: event,
          }).lean();
          console.log(session);
          if (!event || !session) {
            failedSessionBooking.push({
              sessionId: session_id,
              message: 'invalid event_id or session_id',
            });
            //return __.out(res, 400, {'error': 'invalid event_id or session_id'});
            continue;
          }
          rsvpRequest.staff = staff_id;
          rsvpRequest.event = event;
          rsvpRequest.session = session;
          rsvpRequest.isRSVPRequested = true;
          rsvpRequest.isRSVPCancelled = false;
          rsvpRequest.isDeleted = false;
          // Check session expiry
          let sessionTime = new Date(session.endTime);
          let sessionDate = new Date(session.endDate).setHours(
            sessionTime.getHours(),
            sessionTime.getMinutes(),
            sessionTime.getSeconds(),
            0,
          );
          // console.log("sessionDate::",sessionDate)
          console.log({
            sessionDate,
            sessionTime,
            date: session.startDate,
            time: session.startTime,
          });
          console.log(new Date() - sessionDate);
          if (new Date() - sessionDate > 0) {
            failedSessionBooking.push({
              sessionId: session_id,
              message: 'Session expired',
            });
            //return __.out(res, 201, {'error': 'Session expired', 'data': null});
            continue;
          }
          /* // rsvp request overflow check using attendanceRequireddCount field.
                    console.log('session.atten: ',  session.attendaceRequiredCount);
                    if (!session.attendaceRequiredCount) return __.out(res, 500);
                    */
          // rsvp request overflow check
          let existingAcceptedReq = await RSVPRequest.find({
            isRSVPRequestAccepted: true,
            isRSVPCancelled: { $ne: true },
            isDeleted: { $ne: true },
            event: event,
            session: session,
          });
          console.log(
            'existingAcceptedReq.length::::',
            existingAcceptedReq.length,
          );
          console.log(
            'session.totalParticipantPerSession::::',
            session.totalParticipantPerSession,
          );
          if (
            existingAcceptedReq.length >= session.totalParticipantPerSession
          ) {
            failedSessionBooking.push({
              sessionId: session_id,
              message: 'Session expired',
            });
            continue;
          }
          let duplicateCheck = await RSVPRequest.find({
            staff: staff_id,
            event: event,
            isRSVPCancelled: { $ne: true },
            isDeleted: { $ne: true },
            session: session,
          });
          //if (duplicateCheck.length) return __.out(res, 201);
          if (duplicateCheck.length) {
            failedSessionBooking.push({
              sessionId: session_id,
              message: 'duplicate',
            });
            //return __.out(res, 201, {duplicates: duplicateCheck.map(x => x._id)});
            continue;
          }
          await rsvpRequest.save();
          successSessionBooking.push({
            sessionId: session_id,
            message: 'RSVP Book Successfully',
          });
        }
        __.out(res, 200, successSessionBooking);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async cancelRSVPRequest(req, res) {
    const { rsvp_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        // Disallow to cancel, if attendance is taken succussfully
        let rsvp = await RSVPRequest.findById(rsvp_id).lean();
        console.log({ rsvp });
        let attendance = await StaffAttendance.findOne({
          staff: rsvp.staff,
          event: rsvp.event,
          session: rsvp.session,
          status: { $ne: false },
        }).lean();
        console.log({ attendance });
        if (attendance) return __.out(res, 300, 'Not allowed');

        let data = await RSVPRequest.findOneAndUpdate(
          {
            _id: rsvp_id,
            isRSVPCancelled: { $ne: true },
          },
          { isRSVPCancelled: true },
        )
          .populate('session')
          .lean();
        console.log({ data });
        if (!data) return __.out(res, 201, data); // If already canceled

        let session =
          data && typeof data.session == 'object' ? data.session : false;
        console.log({ session });
        if (!session) return __.out(res, 201, data);
        await EventSession.findByIdAndUpdate(data.session, {
          attendaceRequiredCount: ++session.attendaceRequiredCount,
        });
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async cancelRSVPRequestMultiple(req, res) {
    const { rsvpId } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['rsvpId']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        // Disallow to cancel, if attendance is taken succussfully
        let failed = [];
        let success = [];
        for (let i = 0; i < rsvpId.length; i++) {
          let rsvp_id = rsvpId[i];
          let rsvp = await RSVPRequest.findById(rsvp_id).lean();
          console.log({ rsvp });
          let attendance = await StaffAttendance.findOne({
            staff: rsvp.staff,
            event: rsvp.event,
            session: rsvp.session,
            status: { $ne: false },
          }).lean();
          console.log({ attendance });
          if (attendance) {
            failed.push({ rsvpId: rsvp_id, message: 'Not Allowed' });
            continue;
            //return __.out(res, 300, 'Not allowed');
          }
          let data = await RSVPRequest.findOneAndUpdate(
            {
              _id: rsvp_id,
              isRSVPCancelled: { $ne: true },
            },
            { isRSVPCancelled: true },
          )
            .populate('session')
            .lean();
          console.log({ data });
          if (!data) {
            failed.push({ rsvpId: rsvp_id, message: 'Already Canceled' });
            //return __.out(res, 201, data)
            continue;
          } // If already canceled
          let session =
            data && typeof data.session == 'object' ? data.session : false;
          console.log({ session });
          if (!session) {
            success.push({ rsvpId: rsvp_id, message: 'Cancel Successfully' });
            //return __.out(res, 201, data)
            continue;
          }
          await EventSession.findByIdAndUpdate(data.session, {
            attendaceRequiredCount: ++session.attendaceRequiredCount,
          });
          success.push({ rsvpId: rsvp_id, message: 'Cancel Successfully' });
          // return __.out(res, 201, data)
        }
        return res.json({ status: true, success, failed });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async rejectRSVPRequest(req, res) {
    const { rsvp_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let data = await RSVPRequest.findOneAndUpdate(
          {
            _id: rsvp_id,
            isRSVPCancelled: { $ne: true },
            isRSVPRequestDeclined: { $ne: true },
          },
          { isRSVPRequestDeclined: true, isRSVPRequestAccepted: false },
        )
          .populate('session')
          .lean();
        console.log({ data });
        if (!data)
          return __.out(res, 400, {
            error: 'Already declined, canceled or invalid request ',
          });

        let session =
          data && typeof data.session == 'object' ? data.session : false;
        console.log({ session });
        if (!session) return __.out(res, 201, data);
        await EventSession.findByIdAndUpdate(data.session, {
          attendaceRequiredCount: ++session.attendaceRequiredCount,
        });
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async approveRSVPRequest(req, res) {
    const { rsvp_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['rsvp_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let data = await RSVPRequest.findOne({
          _id: rsvp_id,
          isRSVPRequestAccepted: { $ne: true },
          isRSVPCancelled: { $ne: true },
        }).lean();
        if (!data || typeof data != 'object')
          return __.out(res, 400, {
            error: 'Already declined, canceled or invalid request',
          });

        let session = await EventSession.findById(data.session).lean();
        if (!session) return __.out(res, 500);
        // RSVP request overflow check
        let existingAcceptedReq = await RSVPRequest.find({
          isRSVPRequestAccepted: true,
          event: data.event,
          session: data.session,
        });
        if (existingAcceptedReq.length >= session.totalParticipantPerSession)
          return __.out(res, 400, { error: 'All slots are full' });

        data = await RSVPRequest.findByIdAndUpdate(rsvp_id, {
          isRSVPRequestAccepted: true,
          isRSVPRequestDeclined: false,
        }).lean();
        if (data && typeof data == 'object') {
          // If it was not accepted earlier
          console.log(
            await EventSession.findByIdAndUpdate(session, {
              attendaceRequiredCount: --session.attendaceRequiredCount,
            }),
          );
        }
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getRSVPEventsForUser(req, res) {
    const { staff_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, ['staff_id']);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let where = {
          staff: staff_id,
          isRSVPCancelled: false,
          isRSVPRequestAccepted: true,
        };
        if (req.body.event_id) where.event = req.body.event_id;
        let data = await RSVPRequest.find(where).populate('session').exec();
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getRSVPRequests(req, res) {
    const { session_id, event_id } = req.body;
    let requiredResult = await __.checkRequiredFields(req, [
      'event_id',
      'session_id',
    ]);
    try {
      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        let where = {
          event: event_id,
          session: session_id,
          isRSVPCancelled: false,
          isRSVPRequestAccepted: true,
        };
        let data = await RSVPRequest.find(where).populate('staff').exec();
        return __.out(res, 201, data);
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

EventSessionController = new EventSessionController();
module.exports = EventSessionController;
