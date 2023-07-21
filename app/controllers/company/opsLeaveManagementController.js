const mongoose = require('mongoose');
const StaffSapData = require('../../models/staffSAPData');
const Ballot = require('../../models/ballot');
const opsLeaves = require('../../models/opsLeaves');
const OpsGroup = require('../../models/ops');
const userHoliday = require('../../models/userHoliday');
const swopRequests = require('../../models/swapRequests');
const OpsTeam = require('../../models/opsTeam');
const User = require('../../models/user');
const PageSettingModel = require('../../models/pageSetting');
const userLeaves = require('../../models/userLeaves');
const LeaveLog = require('../../models/leaveLogs');
//const _ = require('lodash');
var __ = require('../../../helpers/globalFunctions');
const CronJob = require('cron').CronJob;
var multiparty = require('multiparty');
const async = require('async');
const moment = require('moment');
const FCM = require('../../../helpers/fcm');
const leaveApplied = require('../../models/leaveApplied');
__ = require('../../../helpers/globalFunctions');

class opsLeave {
  async opsLeaveDataPage(req, res) {
    try {
      const opsGroups = await OpsGroup.find(
        { adminId: req.params.id, isDelete: false },
        { _id: 1, opsTeamId: 1, opsGroupName: 1, userId: 1 },
      )
        // const ballots = await Ballot.find({ops})
        .populate([
          {
            path: 'opsTeamId',
            select: ['name', '_id', 'userId'],
          },
          {
            path: 'userId',
            select: ['_id', 'name', 'staffId'],
          },
        ]);
      // let opsIds = [];
      // for(let ops=0;ops<=opsGroups.length-1;ops++){
      //     opsIds.push(opsGroups[ops]._id);
      // }
      //    const ballots =await Ballot.find({"opsGroupId" :{$in :opsIds}},{_id:1});
      //    console.log("ballots is: ",ballots);
      let opsLeavess = [];
      let opsData = [];
      let opss = [];
      for (let op = 0; op <= opsGroups.length - 1; op++) {
        //check if ops leave for this ops group is present
        const opsleave = await opsLeaves.findOne({
          opsGroupId: opsGroups[op]._id,
        });
        if (opsleave) {
          console.log('OPSLEAVE IS PRESENT: ', opsleave);
          opss.push(opsleave);
          var ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };
          if (opsGroups[op].opsTeamId.length > 0) {
            for (let t1 = 0; t1 <= opsGroups[op].opsTeamId.length - 1; t1++) {
              let tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };
              ops.team.push(tt);
            }
            opsData.push(ops);
          } else {
            opsData.push(ops);
          }
        } else {
          console.log('No its not there');
          var opsLeave = {
            opsGroupId: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            createdBy: req.user._id,
            users: [],
            opsTeamId: [],
          };
          var ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };
          opsLeave.companyId = req.user.companyId;
          if (opsGroups[op].opsTeamId.length > 0) {
            for (let t1 = 0; t1 <= opsGroups[op].opsTeamId.length - 1; t1++) {
              let tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };
              ops.team.push(tt);
            }
            for (let u = 0; u <= opsGroups[op].userId.length - 1; u++) {
              for (let t = 0; t <= opsGroups[op].opsTeamId.length - 1; t++) {
                let ids = opsGroups[op].opsTeamId[t].userId.filter(
                  (id) => id == opsGroups[op].userId[u]._id.toString(),
                );
                console.log('ids fund are: ', ids);
                if (ids.length > 0) {
                  let user = {};
                  user.staffId = opsGroups[op].userId[u].staffId;
                  user.id = opsGroups[op].userId[u]._id;
                  user.name = opsGroups[op].userId[u].name;
                  console.log('I am inside of if condition');
                  user.teamId = opsGroups[op].opsTeamId[t]._id;
                  user.teamName = opsGroups[op].opsTeamId[t].name;
                  opsLeave.users.push(user);
                } else {
                  console.log('I am inside of else condition y');
                }

                if (
                  !opsLeave.opsTeamId.includes(opsGroups[op].opsTeamId[t]._id)
                ) {
                  opsLeave.opsTeamId.push(opsGroups[op].opsTeamId[t]._id);
                } else {
                  console.log('team id is already there');
                }
              }
            }
          } else {
            opsLeave.users = opsGroups[op].userId;
          }
          opsLeavess.push(opsLeave);
          opsData.push(ops);
        }
      }
      if (opsLeavess.length > 0) {
        console.log('I am in here');
        let data = await opsLeaves.insertMany(opsLeavess);
        if (opss.length > 0) {
          data = data.concat(opss);
        }
        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Successfull!!',
        });
      } else {
        console.log('I am tata', opss);
        let data = opss;
        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Got Successfully..!!',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: e, message: 'Something went wrong!!' });
    }
  }
  async opsLeaveDataPageSwap(req, res) {
    try {
      const opsGroups = await OpsGroup.find(
        { adminId: req.params.id, isDelete: false },
        { _id: 1, opsTeamId: 1, opsGroupName: 1, userId: 1 },
      )
        // const ballots = await Ballot.find({ops})
        .populate([
          {
            path: 'opsTeamId',
            select: ['name', '_id', 'userId'],
          },
          {
            path: 'userId',
            select: ['_id', 'name', 'staffId'],
          },
        ]);
      // let opsIds = [];
      // for(let ops=0;ops<=opsGroups.length-1;ops++){
      //     opsIds.push(opsGroups[ops]._id);
      // }
      //    const ballots =await Ballot.find({"opsGroupId" :{$in :opsIds}},{_id:1});
      //    console.log("ballots is: ",ballots);
      let opsLeavess = [];
      let opsData = [];
      let opss = [];
      for (let op = 0; op <= opsGroups.length - 1; op++) {
        //check if ops leave for this ops group is present
        const opsleave = await opsLeaves.findOne({
          opsGroupId: opsGroups[op]._id,
        });
        if (opsleave) {
          console.log('OPSLEAVE IS PRESENT: ', opsleave);
          opss.push(opsleave);
          var ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };
          if (opsGroups[op].opsTeamId.length > 0) {
            for (let t1 = 0; t1 <= opsGroups[op].opsTeamId.length - 1; t1++) {
              let tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };
              ops.team.push(tt);
            }
            opsData.push(ops);
          } else {
            opsData.push(ops);
          }
        } else {
          console.log('No its not there');
          var opsLeave = {
            opsGroupId: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            createdBy: req.user._id,
            users: [],
            opsTeamId: [],
          };
          var ops = {
            id: opsGroups[op]._id,
            name: opsGroups[op].opsGroupName,
            team: [],
          };

          opsLeave.companyId = req.user.companyId;
          if (opsGroups[op].opsTeamId.length > 0) {
            for (let t1 = 0; t1 <= opsGroups[op].opsTeamId.length - 1; t1++) {
              let tt = {
                id: opsGroups[op].opsTeamId[t1]._id,
                name: opsGroups[op].opsTeamId[t1].name,
              };
              ops.team.push(tt);
            }
            for (let u = 0; u <= opsGroups[op].userId.length - 1; u++) {
              for (let t = 0; t <= opsGroups[op].opsTeamId.length - 1; t++) {
                let ids = opsGroups[op].opsTeamId[t].userId.filter(
                  (id) => id == opsGroups[op].userId[u]._id.toString(),
                );
                console.log('ids fund are: ', ids);
                if (ids.length > 0) {
                  let user = {};
                  user.staffId = opsGroups[op].userId[u].staffId;
                  user.id = opsGroups[op].userId[u]._id;
                  user.name = opsGroups[op].userId[u].name;
                  console.log('I am inside of if condition');
                  user.teamId = opsGroups[op].opsTeamId[t]._id;
                  user.teamName = opsGroups[op].opsTeamId[t].name;
                  opsLeave.users.push(user);
                } else {
                  console.log('I am inside of else condition y');
                }

                if (
                  !opsLeave.opsTeamId.includes(opsGroups[op].opsTeamId[t]._id)
                ) {
                  opsLeave.opsTeamId.push(opsGroups[op].opsTeamId[t]._id);
                } else {
                  console.log('team id is already there');
                }
              }
            }
          } else {
            opsLeave.users = opsGroups[op].userId;
          }
          opsLeavess.push(opsLeave);
          opsData.push(ops);
        }
      }

      if (opsLeavess.length > 0) {
        console.log('I am in here');
        let data = await opsLeaves.insertMany(opsLeavess);
        if (opss.length > 0) {
          data = data.concat(opss);
        }
        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Successfull!!',
        });
      } else {
        console.log('I am tata', opss);
        let data = opss;
        res.status(201).json({
          status: true,
          data: { leavedata: data, opsids: opsData },
          message: 'Got Successfully..!!',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: e, message: 'Something went wrong!!' });
    }
  }
  async getOpsLeaveCanlender(req, res) {
    try {
      console.log('req.params.id: ', req.params.id);
      const ballot = await Ballot.findOne({ _id: req.params.id });
      console.log('Got BAllot:', ballot);
      if (!ballot) {
        res.status(404).json({
          status: false,
          data: null,
          message: "couldn't find requested ballot.",
        });
      } else {
        const opsLeaveData = await opsLeaves.findOne({
          ballots: { $in: [ballot._id] },
        });
        console.log('got: ', opsLeaveData);
        if (!opsLeaveData || opsLeaveData == null) {
          console.log('I am inside of opsleavedata yep:');
          let allBallots = [];
          if (ballot.parentBallot) {
            console.log('HERE ME!!!');
            let rounds = await this.findParent(res, ballot, allBallots);
            console.log('Rounds Found here: ', rounds);
            this.findQuotas(rounds, res, req);
          } else if (ballot.childBallots.length > 0) {
            //If selected ballot is parnt ballot
            console.log('Its a parent ballot may be');
            //let allBallots=[];
            allBallots.push(ballot._id);
            for (let c = 0; c <= ballot.childBallots.length - 1; c++) {
              allBallots.push(ballot.childBallots[c]);
            }
            this.findQuotas(allBallots, res, req);
          } else {
            //This is alone ballot its has not parent and np children
            allBallots.push(ballot._id);
            this.findQuotas(allBallots, res, req);
          }
        } else {
          res.status(201).json({
            status: true,
            data: opsLeaveData,
            message: 'got it in ops Leaves.',
          });
        }
      }
    } catch (e) {
      res.status(501).json({
        status: false,
        data: null,
        message: 'Oops! something went wrong.',
      });
    }
  }
  async findParent(ballotdata, allBallots) {
    try {
      console.log('ballotData is : ');
      if (ballotdata.parentBallot) {
        let BBallot = await Ballot.findOne(
          { _id: ballotdata.parentBallot },
          { _id: 1, parentBallot: 1, childBallots: 1 },
        );
        console.log('ballotData is : ', BBallot);
        console.log('allBallots is : ', allBallots);
        return this.findParent(BBallot, allBallots);
      } else if (ballotdata.childBallots.length > 0) {
        console.log('Yoooo!!! its has a child ballots');
        allBallots.push(ballotdata._id);
        for (let c = 0; c <= ballotdata.childBallots.length - 1; c++) {
          console.log('Inside of for loop here', ballotdata.childBallots[c]);
          allBallots.push(ballotdata.childBallots[c]);
        }
        console.log('here at all Ballots e: ', allBallots);
        //  return allBallots;
      } else {
        console.log('It is just a ballot so no worries');
      }
      return allBallots;
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async findQuotas(allballots, res, req) {
    try {
      console.log('before reverse: ', allballots);
      allballots.reverse();
      console.log('after reverse: ', allballots);
      //let ballotToWork = allballots[0];
      const ballotIs = await Ballot.findOne(
        { _id: allballots[0] },
        {
          _id: 1,
          ballotName: 1,
          weekRange: 1,
          slotCreation: 1,
          OpsGroupId: 1,
          wonStaff: 1,
          adminId: 1,
        },
      );
      if (!ballotIs) {
        res
          .status(204)
          .json({ status: true, data: null, message: "Couldn't find ballot." });
      }
      let slots = ballotIs.slotCreation;
      ballotIs.monthRange = [];
      ballotIs.monthRange = JSON.stringify(ballotIs.weekRange);
      ballotIs.monthRange = JSON.parse(ballotIs.monthRange);
      ballotIs.monthRange.forEach((dd, index) => {
        dd.month = moment(dd.start).format('MMMM-YY');
        dd.weekNO = index;
      });
      ballotIs.monthRange = groupBy(ballotIs.monthRange, 'month');
      const MONTH = [];
      await Object.entries(ballotIs.monthRange).forEach((entry) => {
        console.log('entry is:', entry);
        let key = entry[0];
        let value = entry[1];
        var objTo = {};
        objTo[key] = value;
        MONTH.push(objTo);
        //use key and value here
      });
      ballotIs.monthRange = MONTH;
      function groupBy(xs, key) {
        return xs.reduce(function (rv, x) {
          (rv[x[key]] = rv[x[key]] || []).push(x);
          return rv;
        }, {});
      }
      let weekData = [];
      for (let i = 0; i <= slots.length - 1; i++) {
        let opsGrpid = slots[i].opsGroup.opsId;
        let opsGroup = {
          id: opsGrpid,
          value: slots[i].opsGroup.value,
          weekdata: [],
          opsTeams: [],
        };
        for (let j = 0; j <= slots[i].arr.length - 1; j++) {
          let currentweek = j + 'A';
          var found = ballotIs.wonStaff.filter(function (element) {
            return (
              element.opsGroupId.toString() === opsGrpid.toString() &&
              element.weekNo === j
            );
          });
          //slots[i].weekRangeSlot[currentweek].weeksValues={};
          slots[i].weekRangeSlot[currentweek].value =
            slots[i].weekRangeSlot[currentweek].value - found.length;
          let currentWeekIs = ballotIs.weekRange[j];
          var daylist = getDaysArray(
            new Date(currentWeekIs.start),
            new Date(currentWeekIs.end),
            slots[i].weekRangeSlot[currentweek].value,
            j,
          );
          console.log('daylist is: ', daylist);
          opsGroup.weekdata = opsGroup.weekdata.concat(daylist);
          if (slots[i].opsTeam.length > 0) {
            slots[i].opsTeam.forEach((team, d) => {
              let currentweek = j + d.toString();
              //console.logs("Current week in Team: ", currentweek);
              var found = ballotIs.wonStaff.filter(function (element) {
                if (element.opsTeamId) {
                  return (
                    element.opsTeamId.toString() === team._id.toString() &&
                    element.weekNo === j
                  );
                } else {
                  return (
                    element.opsGroupId === opsGrpid &&
                    !element.opsTeamId &&
                    element.weekNO === j
                  );
                }
              });
              //console.logs("FOUND: ", found);
              //  slots[i].weekRangeSlot[currentweek].weeksValues={};
              slots[i].weekRangeSlot[currentweek].value =
                slots[i].weekRangeSlot[currentweek].value - found.length;
              if (
                opsGroup.opsTeams[d] &&
                opsGroup.opsTeams[d].weekdata &&
                opsGroup.opsTeams[d].weekdata.length > 0
              ) {
                let currentWeekIs = ballotIs.weekRange[j];
                var daylist = getDaysArray(
                  new Date(currentWeekIs.start),
                  new Date(currentWeekIs.end),
                  slots[i].weekRangeSlot[currentweek].value,
                  j,
                );
                opsGroup.opsTeams[d].weekdata =
                  opsGroup.opsTeams[d].weekdata.concat(daylist);
              } else {
                let tm = { id: team._id, name: team.name, weekdata: [] };
                opsGroup.opsTeams.push(tm);
                let currentWeekIs = ballotIs.weekRange[j];
                var daylist = getDaysArray(
                  new Date(currentWeekIs.start),
                  new Date(currentWeekIs.end),
                  slots[i].weekRangeSlot[currentweek].value,
                  j,
                );
                opsGroup.opsTeams[d].weekdata =
                  opsGroup.opsTeams[d].weekdata.concat(daylist);
              }
            });
          }
        }
        //delete slots[i].arr;
        weekData.push(opsGroup);
      }
      //after all we need to create ops leave object
      let OpsLeave = {};
      OpsLeave.createdBy = req.user._id;
      OpsLeave.ballots = allballots;
      OpsLeave.adminId = ballotIs.adminId;
      OpsLeave.opsGroupId = ballotIs.opsGroupId;
      OpsLeave.weekRange = ballotIs.weekRange;
      OpsLeave.companyId = req.user.companyId;
      OpsLeave.slotRange = weekData;
      OpsLeave.monthRange = ballotIs.monthRange;
      var opsleave = new opsLeaves(OpsLeave);
      var leaveops = await opsleave.save();
      console.log('Successfully saved!!: ', leaveops);
      res
        .status(201)
        .json({ status: true, data: leaveops, message: 'got it.' });
      //  return(ballotIs);
      function getDaysArray(start, end, value, week) {
        for (
          var arr = [], dt = start;
          dt <= end;
          dt.setDate(dt.getDate() + 1)
        ) {
          console.log('Arr: ', arr);
          arr.push({ date: new Date(dt), value: value, weekNo: week });
        }
        return arr;
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getDateRange(req, res) {
    try {
      const bb = await Ballot.findOne(
        { _id: req.params.id },
        { _id: 1, weekRange: 1 },
      );
      let arrOfWeekIs = bb.weekRange[0];
      console.log('arrOfWeekIs: ', arrOfWeekIs);
      var daylist = getDaysArray(
        new Date(arrOfWeekIs.start),
        new Date(arrOfWeekIs.end),
      );
      console.log('dayList is:', daylist);
      res.status(201).json({ status: true, data: daylist, message: 'got it.' });
      function getDaysArray(start, end) {
        for (
          var arr = [], dt = start;
          dt <= end;
          dt.setDate(dt.getDate() + 1)
        ) {
          console.log('Arr: ', arr);
          arr.push(new Date(dt));
        }
        return arr;
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async savePerDayOpsQuota(req, res) {
    try {
      let id = req.body.opsGroup.id;
      let opsleave = await opsLeaves.findOne(
        { opsGroupId: id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );
      if (!opsleave) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      }
      opsleave = JSON.parse(JSON.stringify(opsleave));
      let data = req.body.opsGroup;
      let key;
      let values;
      let ddquota = {};
      data.quota.map((dd) => {
        // dd.value = parseInt(dd.value);
        ddquota = dd;
        key = Object.keys(dd)[0];
        values = Object.values(dd)[0];
      });
      if (opsleave.perDayQuota) {
        let filterquota = opsleave.perDayQuota.quota.filter((q) => {
          let qq = q.hasOwnProperty(key);
          return qq;
        });
        if (filterquota.length > 0) {
          for (let kk = 0; kk <= opsleave.perDayQuota.quota.length - 1; kk++) {
            if (opsleave.perDayQuota.quota[kk].hasOwnProperty(key)) {
              opsleave.perDayQuota.quota[kk] = ddquota;
            } else {
              //this does not have any own property for that object.
            }
          }
        } else {
          opsleave.perDayQuota.quota.push(ddquota);
        }
      } else {
        opsleave.perDayQuota = {
          id: data.id,
          name: data.name,
          quota: data.quota,
          opsTeams: [],
        };
      }
      //For Ops Teams
      if (opsleave.opsTeamId.length > 0 && req.body.opsTeam) {
        if (opsleave.perDayQuota.opsTeams.length > 0) {
          var ttquota;
          var key1;
          var values1;
          req.body.opsTeam.quota.map((dd) => {
            // dd.value = parseInt(dd.value);
            ttquota = dd;
            key1 = Object.keys(dd)[0];
            values1 = Object.values(dd)[0];
          });
          let Isteam = opsleave.perDayQuota.opsTeams.filter(
            (qa) => qa.id === req.body.opsTeam.id,
          );
          if (Isteam && Isteam.length > 0) {
            //This ieam exists there replace it in opsteam array.
            for (
              let tm = 0;
              tm <= opsleave.perDayQuota.opsTeams.length - 1;
              tm++
            ) {
              if (opsleave.perDayQuota.opsTeams[tm].id == req.body.opsTeam.id) {
                //update value
                let filtertmquota = opsleave.perDayQuota.opsTeams[
                  tm
                ].quota.filter((q) => {
                  let qq = q.hasOwnProperty(key1);
                  return qq;
                });
                if (filtertmquota.length > 0) {
                  for (
                    let kk = 0;
                    kk <= opsleave.perDayQuota.opsTeams[tm].quota.length - 1;
                    kk++
                  ) {
                    if (
                      opsleave.perDayQuota.opsTeams[tm].quota[
                        kk
                      ].hasOwnProperty(key1)
                    ) {
                      console.log('foing in if as I foind that property');
                      opsleave.perDayQuota.opsTeams[tm].quota[kk] = {};
                      opsleave.perDayQuota.opsTeams[tm].quota[kk] = ttquota;
                    } else {
                      //this does not have any own property for that object.
                    }
                  }
                } else {
                  console.log('I am going in this case');
                  opsleave.perDayQuota.opsTeams[tm].quota.push(ttquota);
                }
                // opsleave.perDayQuota.opsTeams[tm].quota = req.body.opsTeam.quota;
                console.log(
                  'updated that :',
                  opsleave.perDayQuota.opsTeams[tm],
                );
              } else {
                //nothing to update or save
              }
            }
          } else {
            // does not exists there so just push it directly in opsteam array.
            opsleave.perDayQuota.opsTeams.push(req.body.opsTeam);
          }
        } else {
          opsleave.perDayQuota.opsTeams.push(req.body.opsTeam);
        }
      } else {
        console.log('Does not have teams');
      }

      console.log('per day quots id: ', opsleave.perDayQuota);
      let updated = await opsLeaves.update(
        { _id: opsleave._id },
        { $set: { perDayQuota: opsleave.perDayQuota } },
      );
      if (updated) {
        res.status(201).json({
          status: true,
          data: updated,
          message: 'Successfully updated quota values.',
        });
      } else {
        res
          .status(203)
          .json({
            status: false,
            data: null,
            message: "couldn't update values",
          });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getQuotaByOpsGroup(req, res) {
    try {
      let id = req.params.id;
      const opsleave = await opsLeaves.findOne(
        { opsGroupId: id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );
      if (!opsleave) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      } else {
        res.status(201).json({
          status: true,
          data: opsleave,
          message: 'found data successfully',
        });
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async quotaByOpsGroup(req, res) {
    try {
      const body = req.body;
      const opsleave = await opsLeaves.findOne(
        { opsGroupId: body.opsGroupId },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );
      let obj = {};
      if (!opsleave) {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
        return res.status(200).json({
          status: false,
          data: obj,
          message: 'couldent find this ops group in opsLeave',
        });
      }
      const perDayQuota = opsleave.perDayQuota;
      if (!perDayQuota) {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
        return res.status(200).json({
          status: false,
          data: obj,
          message: 'Per day quota not found',
        });
      }
      // return res.json({ perDayQuota })
      const data = perDayQuota.quota.filter((item) => {
        const year = Object.keys(item)[0];
        return year == req.body.year;
      });
      if (data.length > 0) {
        obj.perDayQuota = {
          quota: data[0],
        };
        if (body.opsTeamId && perDayQuota.opsTeams.length > 0) {
          let finalTeam = null;
          for (let i = 0; i < perDayQuota.opsTeams.length; i++) {
            const team = perDayQuota.opsTeams[i];
            if (team.id == body.opsTeamId) {
              finalTeam = team;
              break;
            }
          }
          if (finalTeam) {
            const teamQuota = finalTeam.quota.filter((item) => {
              const year = Object.keys(item)[0];
              return year == req.body.year;
            });
            if (teamQuota.length > 0) {
              obj.perDayQuota.opsTeams = {
                quota: teamQuota[0],
                id: finalTeam.id,
                name: finalTeam.name,
              };
            } else {
              obj.perDayQuota.opsTeams = {
                id: body.opsTeamId,
                quota: [],
                name: finalTeam.name,
              };
            }
          } else {
            obj.perDayQuota.opsTeams = {
              id: body.opsTeamId,
              quota: [],
            };
          }
        } else if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
      } else {
        obj.perDayQuota = {
          quota: [],
        };
        if (body.opsTeamId) {
          obj.perDayQuota.opsTeams = {
            id: body.opsTeamId,
            quota: [],
          };
        }
      }
      return res.json({ status: true, data: obj });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }
  async getCalenderForYear(req, res) {
    try {
      let data = req.body;
      let id = req.body.opsGroupId;
      const opsGrp = await OpsGroup.findOne(
        { _id: id },
        { userId: 1, opsTeamId: 1 },
      );
      const opsleave = await opsLeaves.findOne(
        { opsGroupId: id },
        { _id: 1, perDayQuota: 1, opsTeamId: 1 },
      );
      //    let userOnHoliday= await userHoliday.find({opsGroupId:id});//,fromdate:data.date
      //    const Ballots = await Ballot.find({opsGroupId : data.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      // return res.json({opsleave, userOnHoliday})
      if (!opsleave) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldent find this ops group in opsLeave',
        });
      }
      if (!req.body.opsTeamId) {
        if (!opsleave.perDayQuota) {
          res.status(203).json({
            status: false,
            data: null,
            message: 'Please set per day quota for requested ops group',
          });
        } else {
          let userOnHoliday = await leaveApplied.find({
            userId: { $in: opsGrp.userId },
            status: { $in: [0, 1, 3, 4, 7, 8] },
            $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
          });
          //return res.json({ userOnHoliday })
          if (opsleave.perDayQuota.quota.length > 0) {
            let isQuotaForYear = true;
            for (let q = 0; q <= opsleave.perDayQuota.quota.length - 1; q++) {
              if (opsleave.perDayQuota.quota[q].hasOwnProperty(req.body.year)) {
                isQuotaForYear = false;
                let finalData = opsleave.perDayQuota.quota[q];
                console.log('finalData : ', finalData);
                //return res.json({finalData, q})
                // if(finalData){
                for (let j = 0; j < finalData[req.body.year].length; j++) {
                  const dayData = finalData[req.body.year][j];
                  //Here I have dates of data.
                  // dd-mm-yyyy
                  let currdate = dayData.date.split('-');
                  // currdate = new Date(+currdate[2], currdate[1] - 1, +currdate[0] + 1).getTime();
                  currdate = new Date(
                    +currdate[2],
                    currdate[1] - 1,
                    +currdate[0],
                  ).getTime(); //Add +1 for local as above commented line
                  console.log('Currdate here is: ', currdate);
                  let woncount = 0;
                  // console.log("WONCOUNT S: ", woncount);
                  const countUser = userOnHoliday.filter((item) => {
                    var datePartsss = new Date(item.startDate).getTime();
                    var dateParteee = new Date(item.endDate).getTime(); //Add 18.30 hours for local.
                    return currdate <= dateParteee && currdate >= datePartsss;
                  });
                  //  var filtered = countUser.filter(filterWithStatus);
                  var countFiltered = countUser.length; //- filtered.length;
                  console.log('countFiltered', countFiltered);
                  const qo = parseInt(dayData.value);
                  let v = qo - (countFiltered + woncount);
                  finalData[req.body.year][j].value = v;
                  finalData[req.body.year][j].quota = parseInt(qo);
                }
                res.status(201).json({
                  status: true,
                  data: opsleave.perDayQuota.quota[q],
                  message: 'Found requested quota',
                });
              } else {
                console.log('Its not requested year');
              }
            }
            if (isQuotaForYear) {
              return res.json({
                status: false,
                data: null,
                message: 'Please set per day quota for requested ops group',
              });
            }
          } else {
            return res.json({
              status: false,
              data: null,
              message: 'Please set per day quota for requested ops group',
            });
          }
        }
      } else {
        // console.log("Hi i m in else:", opsleave.perDayQuota);
        const opsTm = await OpsTeam.findOne(
          { _id: req.body.opsTeamId },
          { userId: 1 },
        );
        if (!opsleave.perDayQuota) {
          res.status(203).json({
            status: false,
            data: null,
            message:
              'Please set per day quota for requested ops group and ops team',
          });
        } else {
          let opsData = {};
          let hasopsData = false;
          if (opsleave.perDayQuota.quota.length > 0) {
            for (let q = 0; q <= opsleave.perDayQuota.quota.length - 1; q++) {
              if (opsleave.perDayQuota.quota[q].hasOwnProperty(req.body.year)) {
                hasopsData = true;
                opsData = opsleave.perDayQuota.quota[q];
                break;
              } else {
                console.log('not in');
              }
            }
          }
          if (opsleave.perDayQuota.opsTeams.length > 0) {
            let allTeams = [];
            var filteOtherTeams = opsleave.perDayQuota.opsTeams.filter(
              (q) => q.id !== req.body.opsTeamId,
            );
            //console.log("filteOtherTeams:", filteOtherTeams);
            if (filteOtherTeams.length > 0) {
              for (let ot = 0; ot <= filteOtherTeams.length - 1; ot++) {
                let curreQuota = filteOtherTeams[ot].quota;
                //   console.log("current quota is: ");
                var filterwithprop = curreQuota.filter((cc) =>
                  cc.hasOwnProperty(req.body.year),
                );
                //   console.log("current quota isfilterwithprop: ", filterwithprop);
                if (filterwithprop.length > 0) {
                  allTeams.push(filterwithprop[0]);
                }
              }
            }

            var opsTeamdata = opsleave.perDayQuota.opsTeams.filter(
              (q) => q.id == req.body.opsTeamId,
            );
            // console.log("opsTeamdata: ", opsTeamdata);
            if (opsTeamdata.length > 0) {
              let userOnHoliday = await leaveApplied.find({
                userId: { $in: opsTm.userId },
                status: { $in: [1, 3, 4, 7, 8] },
                $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
              });
              console.log('userOnHoliday', userOnHoliday.length);
              let isQuotaForYear = true;
              for (let q = 0; q <= opsTeamdata[0].quota.length - 1; q++) {
                if (opsTeamdata[0].quota[q].hasOwnProperty(req.body.year)) {
                  //   console.log("ALLTEAMS: ", allTeams);
                  isQuotaForYear = false;
                  let finalData = opsTeamdata[0].quota[q];
                  for (let j = 0; j < finalData[req.body.year].length; j++) {
                    const dayData = finalData[req.body.year][j];
                    let currdate = dayData.date.split('-');
                    currdate = new Date(
                      +currdate[2],
                      currdate[1] - 1,
                      +currdate[0],
                    ).getTime();
                    //get ballot won counts from ballots
                    let woncount = 0;
                    //Here I have dates of data from casual holidays.
                    const countUser = userOnHoliday.filter((item) => {
                      var datePartsss = new Date(item.startDate).getTime();
                      var dateParteee = new Date(item.endDate).getTime();
                      return currdate <= dateParteee && currdate >= datePartsss;
                    });
                    var countFiltered = countUser.length;
                    const qo = parseInt(dayData.value);
                    let v = countFiltered + woncount;
                    finalData[req.body.year][j].quota = parseInt(qo);
                    finalData[req.body.year][j].value =
                      finalData[req.body.year][j].quota - v;
                  }
                  // }
                  res.status(201).json({
                    status: true,
                    data: finalData,
                    userOnHoliday,
                    message: 'Found requested quota 1',
                  });
                } else {
                  console.log('Its not requested year');
                }
              }
              if (isQuotaForYear) {
                return res.json({
                  status: false,
                  data: null,
                  message: 'Please set per day quota for requested ops group',
                });
              }
            } else {
              res.status(203).json({
                status: false,
                data: null,
                message: 'Please set Quota Values for requested year first',
              });
            }
          } else {
            return res.json({
              status: false,
              data: null,
              message: 'Please set per day quota for requested ops group',
            });
          }
        }
      }
    } catch (e) {
      res.status(203).json({
        status: false,
        data: null,
        message: 'something went worng or Please check selected year',
      });
    }
    function filterWithStatus(event) {
      return event.status == 'cancelled';
    }
  }
  async getUserByDate(req, res) {
    let data = req.body;
    try {
      const opsleave = await opsLeaves.findOne(
        { opsGroupId: data.opsGroupId },
        { _id: 1, perDayQuota: 1, opsTeamId: 1, users: 1 },
      );
      const ops = await OpsGroup.findOne(
        { _id: data.opsGroupId },
        { userId: 1, opsTeamId: 1 },
      );
      var dateParts = data.date.split('-');
      // dateParts:  [ '04', '01', '2020' ]
      // dateObject:  2020-01-03T18:30:00.000Z
      // month is 0-based, that's why we need dataParts[1] - 1
      var dateObject = new Date(
        +dateParts[2],
        dateParts[1] - 1,
        +dateParts[0] + 1,
      );
      let woncount = 0;
      if (!opsleave || !ops) {
        res.status(203).json({
          status: false,
          data: null,
          message: 'couldnt find this ops group in opsLeave',
        });
      } else {
        if (opsleave.perDayQuota) {
          let casualCount = 0;
          if (!data.opsTeamId) {
            // let userOnHoliday= await userHoliday.find({opsGroupId:data.opsGroupId,fromdate:data.date}).populate({path:"userId",select:"staffId"});
            let userOnHoliday = await userLeaves.find({
              userId: { $in: ops.userId },
            });
            console.log('No team id in request: ', userOnHoliday);
            userOnHoliday = userOnHoliday.reduce(function (
              accumulator,
              currentValue,
            ) {
              var startdd = new Date(currentValue.fromdate);
              var startdd1 = nextDayUTC(startdd);
              var enddd = new Date(currentValue.todate);
              let end1 = nextDayUTC(enddd);
              if (dateObject <= end1 && dateObject >= startdd1) {
                console.log('Motha if');
                accumulator.push(currentValue);
              }
              return accumulator;
            },
            []);
            function nextDayUTC(d) {
              var aDay = 1440 * 60 * 1000;
              var d2 = new Date(Math.trunc((d.getTime() + aDay) / aDay) * aDay);
              return d2;
            }
            //var filtered = userOnHoliday.filter(filterWithStatus);
            // let casualCount = userOnHoliday.length;
            //casualCount = userOnHoliday.length - filtered.length;
            let casualcount = userOnHoliday.filter(
              (uu) => uu.type == 2 && uu.status !== 'cancelled',
            );
            casualCount = casualcount.length;
            let specialCount = userOnHoliday.filter(
              (uuh) => uuh.type == 4 && uuh.status !== 'cancelled',
            );
            let specialcount = specialCount.length;
            let blockCount = userOnHoliday.filter(
              (uh) => uh.type == 3 && uh.status !== 'cancelled',
            );
            let wonsballot = userOnHoliday.filter(
              (uh) => uh.type == 1 && uh.status !== 'cancelled',
            );
            woncount = wonsballot.length;
            woncount = woncount + blockCount.length;
            // userOnHoliday = userOnHoliday.concat(allUsers);
            // casualCount = casualCount -(specialcount+blockCount.length);
            if (opsleave.perDayQuota.quota.length > 0) {
              console.log('here inside of if me');
              let yeardata = opsleave.perDayQuota.quota.filter((q) => {
                if (q.hasOwnProperty(data.year)) {
                  return q;
                }
              });
              // console.log("yeardata is:",yeardata);
              if (yeardata.length > 0) {
                console.log('in if');
                // find quota for that date and the users.
                let key = Object.keys(yeardata[0])[0];
                console.log('keyis: ', key);
                let thatdateIs = yeardata[0][key].filter(
                  (qa) => qa.date == data.date,
                );
                // console.log("thatdate is : ",thatdateIs);
                if (thatdateIs.length > 0) {
                  let balance =
                    thatdateIs[0].value -
                    (casualCount + specialcount + woncount);
                  if (balance < 0) {
                    balance = 0;
                  }
                  let UsersOnHoliday = groupUsersByLeaves(
                    userOnHoliday,
                    'userId',
                  );
                  console.log('USERS HERE ARE: ', UsersOnHoliday);
                  var datatosend = {
                    date: thatdateIs[0],
                    users: opsleave.users,
                    userOnHoliday: UsersOnHoliday,
                    balance,
                    casualCount,
                    balloted: woncount,
                    specialcount,
                  };
                  this.sendResponse(datatosend, res);
                  // res.status(201).json({status: true, data: {date:thatdateIs[0],users:opsleave.users,userOnHoliday:UsersOnHoliday, balance, casualCount,balloted:woncount,specialcount}, message: "Successfully reveived data."});
                } else {
                  res.status(203).json({
                    status: false,
                    data: null,
                    message: 'date is not found ',
                  });
                }
              } else {
                res.status(203).json({
                  status: false,
                  data: null,
                  message: 'requested object does not found',
                });
              }
            } else {
              res.status(203).json({
                status: false,
                data: null,
                message: 'Please set quota values for requested ops group',
              });
            }
          } else {
            let opsdateIs = [];
            if (opsleave.perDayQuota.quota.length > 0) {
              for (let q = 0; q <= opsleave.perDayQuota.quota.length - 1; q++) {
                if (
                  opsleave.perDayQuota.quota[q].hasOwnProperty(req.body.year)
                ) {
                  let opsData = opsleave.perDayQuota.quota[q];
                  opsdateIs = opsData[req.body.year].filter(
                    (qa) => qa.date == data.date,
                  );
                  break;
                } else {
                  console.log('not in');
                }
              }
            }

            if (
              opsleave.opsTeamId.length > 0 &&
              opsleave.perDayQuota.opsTeams.length > 0
            ) {
              //to find all other teams quotas
              let allTeams = [];
              var filteOtherTeams = opsleave.perDayQuota.opsTeams.filter(
                (q) => q.id !== req.body.opsTeamId,
              );
              console.log('filteOtherTeams:', filteOtherTeams);
              if (filteOtherTeams.length > 0) {
                for (let ot = 0; ot <= filteOtherTeams.length - 1; ot++) {
                  let curreQuota = filteOtherTeams[ot].quota;
                  console.log('current quota is: ');
                  var filterwithprop = curreQuota.filter((cc) =>
                    cc.hasOwnProperty(req.body.year),
                  );
                  console.log(
                    'current quota isfilterwithprop: ',
                    filterwithprop,
                  );
                  if (filterwithprop.length > 0) {
                    allTeams.push(filterwithprop[0]);
                  }
                }
              }
              //TILL HERE
              const opsTeam = await OpsTeam.findOne(
                { _id: data.opsTeamId },
                { userId: 1 },
              );
              let userOnHoliday = await userLeaves.find({
                userId: { $in: opsTeam.userId },
              });
              //    let userOnHoliday= await userHoliday.find({opsGroupId:data.opsGroupId,opsTeamId: data.opsTeamId}).populate({path:"userId",select:"staffId"});
              userOnHoliday = userOnHoliday.reduce(function (
                accumulator,
                currentValue,
              ) {
                let startdd = new Date(currentValue.fromdate);
                var startdd1 = nextDayUTC(startdd);
                let enddd = new Date(currentValue.todate);
                let end1 = nextDayUTC(enddd);
                if (dateObject <= end1 && dateObject >= startdd1) {
                  console.log('Motha if');
                  accumulator.push(currentValue);
                }
                return accumulator;
              },
              []);

              function nextDayUTC(d) {
                var aDay = 1440 * 60 * 1000;
                var d2 = new Date(
                  Math.trunc((d.getTime() + aDay) / aDay) * aDay,
                );
                return d2;
              }

              let casualcount = userOnHoliday.filter(
                (uu) => uu.type == 2 && uu.status !== 'cancelled',
              );
              let specialCount = userOnHoliday.filter(
                (uuh) => uuh.type == 4 && uuh.status !== 'cancelled',
              );
              casualCount = casualcount.length;
              let specialcount = specialCount.length;
              let blockCount = userOnHoliday.filter(
                (uh) => uh.type == 3 && uh.status !== 'cancelled',
              );
              let winballots = userOnHoliday.filter(
                (uh) => uh.type == 1 && uh.status !== 'cancelled',
              );
              woncount = winballots.length;
              woncount = woncount + blockCount.length;
              // let casualCount = userOnHoliday.length;
              let usersHere = opsleave.users.filter(
                (u) => u.teamId.toString() == data.opsTeamId.toString(),
              );
              // casualCount = casualCount -(specialcount+blockCount.length);
              let teamSelectedIs = opsleave.perDayQuota.opsTeams.filter(
                (q) => q.id == data.opsTeamId,
              );
              if (teamSelectedIs.length > 0) {
                let yeardata = teamSelectedIs[0].quota.filter((q) => {
                  if (q.hasOwnProperty(data.year)) {
                    return q;
                  }
                });
                // console.log("yeardata in team is:",yeardata);
                if (yeardata.length > 0) {
                  console.log('in if');
                  // find quota for that date and the users.
                  let key = Object.keys(yeardata[0])[0];
                  console.log('keyis team: ', key);
                  let thatdateIs = yeardata[0][key].filter(
                    (qa) => qa.date == data.date,
                  );
                  let teamquota = 0;
                  if (allTeams.length > 0) {
                    for (let i = 0; i <= allTeams.length - 1; i++) {
                      console.log('In if here: ');
                      let teamCurrQuota = allTeams[i][req.body.year].filter(
                        (da) => da.date == data.date,
                      );
                      if (teamCurrQuota.length > 0) {
                        teamquota =
                          teamquota + parseInt(teamCurrQuota[0].value);
                      }
                      console.log('teamquota: ', teamquota);
                    }
                  }
                  console.log('thatdate is : ', thatdateIs);
                  if (thatdateIs.length > 0) {
                    const totalsOfTeam =
                      parseInt(thatdateIs[0].value) + parseInt(teamquota);
                    console.log('TOTALS FO TEAM IS: ', totalsOfTeam);
                    let opsBalance = 0;
                    let balanceToUse = 0;
                    if (opsdateIs.length > 0) {
                      console.log(
                        'Inside check og opsdate is cha balance: ',
                        opsdateIs,
                      );
                      opsBalance = opsdateIs[0].value;
                    }
                    console.log('OPS BALANCE IS: ', opsBalance);
                    if (parseInt(opsBalance) > totalsOfTeam) {
                      console.log('IN IFA ');
                      balanceToUse = thatdateIs[0].value;
                    } else {
                      console.log('IN IFA  ELSE');
                      balanceToUse = opsBalance;
                      thatdateIs[0] = opsdateIs[0];
                    }
                    console.log('blance to use is: ', balanceToUse);
                    let balance =
                      balanceToUse - (casualCount + specialcount + woncount);
                    // let balance = thatdateIs[0].value - (casualCount+specialcount+blockCount.length);
                    if (balance < 0) {
                      balance = 0;
                    }
                    let UsersOnHoliday = groupUsersByLeaves(
                      userOnHoliday,
                      'userId',
                    );
                    var datatosend = {
                      date: thatdateIs[0],
                      users: usersHere,
                      userOnHoliday: UsersOnHoliday,
                      balance,
                      casualCount,
                      balloted: woncount,
                      specialcount,
                    };
                    this.sendResponse(datatosend, res);
                    // res.status(201).json({status: true, data: {date:thatdateIs[0],users:usersHere,userOnHoliday:UsersOnHoliday,balance,casualCount,balloted:woncount,specialcount}, message: "Successfully reveived data."});
                  } else {
                    res.status(203).json({
                      status: false,
                      data: null,
                      message: 'date is not found ',
                    });
                  }
                } else {
                  res.status(203).json({
                    status: false,
                    data: null,
                    message: 'requested object does not found',
                  });
                }
              } else {
                res.status(203).json({
                  status: false,
                  data: null,
                  message: 'please set ops team quota first',
                });
              }
            }
          }
        } else {
          res.status(203).json({
            status: false,
            data: null,
            message:
              'Please set quota values for requested ops group and ops teams',
          });
        }

        function groupUsersByLeaves(xs, key) {
          return xs.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
          }, {});
        }
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }
  async sendResponse(datar, res) {
    let response = [];
    console.log('I m here');
    for (let [key, value] of Object.entries(datar.userOnHoliday)) {
      console.log('key: ', key);
      try {
        const user = await User.findOne(
          { _id: key },
          { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
        );
        console.log('user : ', user);
        var User1 = {
          id: user._id,
          name: user.name,
          staffId: user.staffId,
          leaveStatus: value[value.length - 1].leaveStatus,
          type: value[value.length - 1].type,
          leavedata: value,
          isAllowedToSwap: user.isLeaveSwapAllowed,
        };
        if (value[0].status) {
          User1.status = value[value.length - 1].status;
        }
        response.push(User1);
      } catch (e) {
        console.log('e', e);
        res
          .status(501)
          .json({
            status: false,
            data: null,
            message: 'Something went wrong!',
          });
      }
    }
    delete datar.userOnHoliday;
    datar.userOnHoliday = response;
    console.log('found object as such: ', datar);
    res.status(201).json({
      status: true,
      data: datar,
      message: 'Successfully reveived data.',
    });
  }
  async allocateLeave(req, res) {
    try {
      let request = req.body;
      request.logs = [];
      var myLog = {
        updatedBy: req.user.name,
        message: 1, //1-Allocation 2- Change date 3-cancellation,
        fromdate: request.fromdate,
        todate: request.todate,
      };
      request.logs.push(myLog);
      // console.log("request:" ,request);
      var userholiday = new userLeaves(request);
      console.log('userholiday:', userholiday);
      var holiday = await userholiday.save();
      let startdd = new Date(request.fromdate);
      let enddd = new Date(request.todate);
      var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
      days = days + 1;
      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      var configurationNumber = 2;
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 1) {
        configurationNumber = 2;
      }
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 2) {
        configurationNumber = 1;
      }
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 3) {
        configurationNumber = 0;
      }
      let daysToDeduct = days;
      if (daysToDeduct % 7 == 0) {
        var n = daysToDeduct / 7;
        n = n * configurationNumber;
        daysToDeduct = daysToDeduct - n;
      }
      if (daysToDeduct > 0 && daysToDeduct < 7) {
        if (daysToDeduct == 6) {
          console.log('AT HHHHHH');
          daysToDeduct = 5;
        } else {
          daysToDeduct = daysToDeduct - configurationNumber * 0;
        }
      }
      if (daysToDeduct > 7 && daysToDeduct < 14) {
        daysToDeduct = daysToDeduct - configurationNumber * 1;
      }
      if (daysToDeduct > 14 && daysToDeduct < 21) {
        daysToDeduct = daysToDeduct - configurationNumber * 2;
      }
      if (daysToDeduct > 21 && daysToDeduct < 28) {
        daysToDeduct = daysToDeduct - configurationNumber * 3;
      }
      //   if(days%7 == 0){
      //       var no = days/7;
      //       let daysOfFreeLeaves = no*2;
      //       days = days - daysOfFreeLeaves;
      //   }
      let sapupdate = await StaffSapData.update(
        { staff_Id: request.userId },
        { $inc: { ballotLeaveBalanced: -daysToDeduct } },
      );
      //let holiday= await userHoliday.save(userholiday);
      console.log('holiday: ', holiday);
      if (holiday) {
        res.status(201).json({
          status: true,
          data: holiday,
          message: 'Successfully Allocated leave to user.',
        });
        //Notification saying leave is allocated.
        const user = await User.findOne(
          { _id: req.body.userId },
          { _id: 0, deviceToken: 1 },
        );
        let usersDeviceTokens = [];
        var dd = new Date();
        if (user && user.deviceToken) {
          console.log('USER: ', user);
          usersDeviceTokens.push(user.deviceToken);
          var collapseKey = holiday._id;
          var strt = holiday.fromdate.split('-');
          strt = strt[2] + '-' + strt[1] + '-' + strt[0];
          var end = holiday.todate.split('-');
          end = end[2] + '-' + end[1] + '-' + end[0];
          let notificationObj = {
            title: 'Leave Allocated.',
            body:
              'Leave dated from  ' +
              strt +
              ' to ' +
              end +
              ' has been allocated to you.',
            bodyText:
              'Leave dated from  ' +
              strt +
              ' to ' +
              end +
              ' has been allocated to you.',
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };
          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
          console.log('sent');
        }
      } else {
        res.status(203).json({
          status: false,
          data: null,
          message: 'Unable to allocate leave',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }
  async getMobileScreenForLeave(req, res) {
    console.log('request body is: ', req.body); //,fromdate:req.body.date
    try {
      const ops = await OpsGroup.findOne(
        { userId: req.body.userId, isDelete: false },
        { _id: 1, opsGroupName: 1 },
      );
      const user = await User.findOne(
        { _id: req.body.userId },
        { _id: 0, parentBussinessUnitId: 1 },
      ).populate({
        path: 'parentBussinessUnitId',
        select: 'name',
        populate: {
          path: 'sectionId',
          select: 'name',
          populate: {
            path: 'departmentId',
            select: 'name',
            populate: {
              path: 'companyId',
              select: 'name',
            },
          },
        },
      });
      let BU =
        user.parentBussinessUnitId.sectionId.departmentId.companyId.name +
        ' > ' +
        user.parentBussinessUnitId.sectionId.departmentId.name +
        ' > ' +
        user.parentBussinessUnitId.sectionId.name +
        ' > ' +
        user.parentBussinessUnitId.name;
      //  .populate([{
      //      path:'parentBussinessUnitId',select:"name"
      //  }]);
      let dateHere = new Date(req.body.date);
      dateHere = moment(dateHere).format('DD-MM-YYYY');
      var dateParts = req.body.date.split('-');
      var dateObject = new Date(
        +dateParts[2],
        dateParts[1] - 1,
        +dateParts[0] + 1,
      );
      console.log('dateObject is:', dateObject);
      let leaves1 = await userLeaves.find(
        { userId: req.body.userId },
        {
          _id: 1,
          fromdate: 1,
          todate: 1,
          type: 1,
          status: 1,
          attachment: 1,
          reason: 1,
          userId: 1,
          isSwapable: 1,
        },
      );
      // const Ballots = await Ballot.find({opsGroupId : ops._id,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      let leaves = JSON.stringify(leaves1);
      leaves = JSON.parse(leaves);
      let all = [];

      for (let leave = 0; leave <= leaves.length - 1; leave++) {
        // var datePartsss = leaves[leave].fromdate.split("-");
        //var dateParteee = leaves[leave].todate.split("-");
        let startdd = new Date(leaves[leave].fromdate);
        let startdd1 = nextDayUTC(startdd);
        let enddd = new Date(leaves[leave].todate);
        let end1 = nextDayUTC(enddd);
        function nextDayUTC(d) {
          var aDay = 1440 * 60 * 1000;
          var d2 = new Date(Math.trunc((d.getTime() + aDay) / aDay) * aDay);
          return d2;
        }
        if (dateObject <= end1 && dateObject >= startdd1) {
          leaves[leave].isCurrentDate = true;
        }
      }
      //From usersHolidays
      // var leaves1 = leaves.filter(ff=>ff.status !=='cancelled');
      // console.log("LEAVES: ",leaves1);
      all = all.concat(leaves);
      var dataToSend = { opsName: ops.opsGroupName, Bu: BU, leave: all };
      //console.log("User data id: ",all);
      res.status(201).json({
        status: true,
        data: dataToSend,
        message: 'successfully received data.',
      });
    } catch (e) {
      res
        .status(500)
        .json({ status: false, data: e, message: 'Something went wrong.' });
    }
  }
  async cancelLeaveForStaff(req, res) {
    console.log('request here is: ', req.body);
    try {
      const holiday = await userLeaves.findOne({ _id: req.body._id });
      const user = await User.findOne(
        { _id: req.body.userid },
        { _id: 0, deviceToken: 1 },
      );
      console.log('holiday found is:', holiday);
      if (holiday) {
        let log = holiday.logs;
        var myLog = {
          updatedBy: req.user.name,
          message: 3, //1-Allocation 2- Change date 3-cancellation,
          fromdate: holiday.fromdate,
          todate: holiday.todate,
        };
        log.push(myLog);
        holiday.logs = log;
        console.log('HERE: ', holiday.logs);
        holiday.status = 'cancelled';
        try {
          await holiday.save();
          let startdd = new Date(holiday.fromdate);
          let enddd = new Date(holiday.todate);
          var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
          days = days + 1;
          var daysAsLeaves = await noOfDays(res, days);
          let sapupdate = await StaffSapData.update(
            { staff_Id: holiday.userId },
            { $inc: { ballotLeaveBalanced: daysAsLeaves } },
          );
        } catch (e) {
          res.status(203).json({ status: false, data: e, message: 'error' });
        }
        res
          .status(201)
          .json({ status: false, data: holiday, message: 'Cancelled leave' });
        //Notification saying leave is cancelled.
        let usersDeviceTokens = [];
        var dd = new Date();
        if (user && user.deviceToken) {
          let leaveType = 'Casual';
          if (holiday.type == 1 || holiday.type == 3) {
            leaveType = 'Block';
          }
          console.log('USER: ', user);
          usersDeviceTokens.push(user.deviceToken);
          var collapseKey = holiday._id;
          var strt = holiday.fromdate.split('-');
          strt = strt[2] + '-' + strt[1] + '-' + strt[0];
          var end = holiday.todate.split('-');
          end = end[2] + '-' + end[1] + '-' + end[0];
          let notificationObj = {
            title: 'Your Leave has been cancelled.',
            body:
              'Your ' +
              leaveType +
              ' leave dated from ' +
              strt +
              ' to ' +
              end +
              ' has been cancelled.',
            bodyText:
              'Your ' +
              leaveType +
              ' leave dated from ' +
              strt +
              ' to ' +
              end +
              ' has been cancelled.',
            bodyTime: dd,
            bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
          };
          console.log('usersDeviceTokens', usersDeviceTokens);
          console.log('notificationObj', notificationObj);
          console.log('collapseKey', collapseKey);
          FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        }
      } else {
        res.status(203).json({
          status: false,
          data: null,
          message: 'Sorry ! couldnt find similar data',
        });
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }
  async changeLeaveDates(req, res) {
    console.log('request data: ', req.body);
    let data = req.body;
    let frmDt = data.startdate.split('-');
    frmDt = frmDt[2] + '-' + frmDt[1] + '-' + frmDt[0];
    let toDt = data.enddate.split('-');
    toDt = toDt[2] + '-' + toDt[1] + '-' + toDt[0];
    //Check if these dates lready assigned;
    let dates = [];
    let startdd = new Date(frmDt);
    let enddd = new Date(toDt);
    //check in that dates.
    dates = getDateArray(startdd, enddd);
    console.log('date: ', dates);
    const leaves = await userLeaves.find({
      userId: data.userId,
      status: { $ne: 'cancelled' },
      type: { $in: [1, 2] },
    });
    console.log('date: ', leaves.length);
    for (let km = 0; km <= dates.length - 1; km++) {
      for (let leave = 0; leave <= leaves.length - 1; leave++) {
        let leavestart = new Date(leaves[leave].fromdate);
        let leaveend = new Date(leaves[leave].todate);
        if (data._id && data._id.toString() == leaves[leave]._id.toString()) {
          console.log('same id found', data.idis);
        } else {
          if (
            dates[km] >= leavestart &&
            dates[km] <= leaveend &&
            leaves[leave].status !== 'cancelled'
          ) {
            // 0 says dates overlapping..
            return res.status(203).json({
              status: false,
              data: null,
              message: 'Dates Overlapping',
            });
            //break;
          } else {
            console.log('notfound');
          }
        }
      }
    }
    try {
      console.log('coming here');
      let leave = await userLeaves.findOne({ _id: data._id });
      let existingleavedates = [];
      let currentStartDate = new Date(leave.fromdate);
      let currentEndDate = new Date(leave.todate);
      //check in that dates.
      existingleavedates = getDateArray(currentStartDate, currentEndDate);
      // let leave = JSON.stringify(Leave);
      // leave = JSON.parse(leave);
      if (dates.length >= 5) {
        if (leave.type == 1 || leave.type == 3) {
          var existingdates = await noOfDays(res, existingleavedates.length);
          //console.log("existingdates: ",existingdates);
          let firstAddUsersBallotBalance = await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: existingdates } },
          );
          let log = leave.logs;
          var myLog = {
            updatedBy: req.user.name,
            message: 2, //1-Allocation 2- Change date 3-cancellation,
            fromdate: leave.fromdate,
            todate: leave.todate,
            fromCurrentdate: req.body.startdate,
            toCurrentdate: req.body.enddate,
          };
          log.push(myLog);
          leave.logs = log;
          leave.fromdate = frmDt;
          leave.todate = toDt;
          leave.status = 'Allocated';
          leave.type = 3;
          leave.isSwapable = data.isSwapable;
          console.log('leave', leave);
          await leave.save();
          let daysTodeduct = await noOfDays(res, dates.length);
          // console.log("daysTodeduct: ",daysTodeduct);
          //var existingdates = await noOfDays(existingleavedates.length);
          //     if((dates.length)%7 == 0){
          //        var no = days/7;
          //        let daysOfFreeLeaves = no*2;
          //        daysTodeduct = daysTodeduct - daysOfFreeLeaves;
          //    }
          let sapupdate = await StaffSapData.update(
            { staff_Id: leave.userId },
            { $inc: { ballotLeaveBalanced: -daysTodeduct } },
          );
          console.log;
          res.status(201).json({
            status: false,
            data: leave,
            message: 'dates changed',
          });
        } else {
          res.status(203).json({
            status: false,
            data: leave,
            message: 'Casual leave cannot be more than 5 days.',
          });
        }
      } else {
        if (leave.type == 2) {
          let log = leave.logs;
          var myLog = {
            updatedBy: req.user.name,
            message: 2, //1-Allocation 2- Change date 3-cancellation,
            fromdate: leave.fromdate,
            todate: leave.todate,
            fromCurrentdate: req.body.startdate,
            toCurrentdate: req.body.enddate,
          };
          log.push(myLog);
          leave.logs = log;
          leave.fromdate = frmDt;
          leave.todate = toDt;
          leave.status = 'Allocated';
          leave.type = 2;
          await leave.save();
          if (existingleavedates.length > dates.length) {
            let diff = existingleavedates.length - dates.length;
            let sapupdate = await StaffSapData.update(
              { staff_Id: leave.userId },
              { $inc: { ballotLeaveBalanced: diff } },
            );
          } else if (dates.length > existingleavedates.length) {
            let diff = dates.length - existingleavedates.length;
            let sapupdate = await StaffSapData.update(
              { staff_Id: leave.userId },
              { $inc: { ballotLeaveBalanced: -diff } },
            );
          }
          res.status(201).json({
            status: false,
            data: leave,
            message: 'dates changed',
          });
        } else {
          res.status(203).json({
            status: false,
            data: leave,
            message: 'Block leave cannot be less than 5 days.',
          });
        }
      }
      const user = await User.findOne(
        { _id: leave.userId },
        { _id: 1, name: 1, deviceToken: 1 },
      );
      let usersDeviceTokens = [];
      var dd = new Date();
      if (user && user.deviceToken) {
        let leaveType = 'Casual';
        if (leave.type == 1 || leave.type == 3) {
          leaveType = 'Block';
        }
        usersDeviceTokens.push(user.deviceToken);
        var collapseKey = leave._id;
        let notificationObj = {
          title: 'Leave Changed.',
          body:
            'Your ' +
            leaveType +
            ' Leaves dates have been changed to ' +
            data.startdate +
            ' to ' +
            data.enddate,
          bodyText:
            'Your ' +
            leaveType +
            ' Leaves dates have been changed to ' +
            data.startdate +
            ' to ' +
            data.enddate,
          bodyTime: dd,
          bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
        };
        FCM.push(usersDeviceTokens, notificationObj, collapseKey);
        console.log('sent');
      }
    } catch (e) {
      res.status(500).json({
        status: false,
        data: e,
        message: 'Something went wrong!.',
      });
    }

    function getDateArray(start, end) {
      console.log('In get dates : ');
      var arr = new Array(),
        dt = new Date(start);
      while (dt <= end) {
        console.log('in while....');
        arr.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
      }
      console.log('At array: ', arr);
      return arr;
    }
  }
  async findIfDateIsAssigned(req, res) {
    try {
      if (!req.body.opsGroupId || !req.body.userId) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'please select user and OpsGroup.',
        });
      }
      var ballotBalance = await StaffSapData.findOne(
        { staff_Id: req.body.userId },
        { ballotLeaveBalanced: 1 },
      );
      if (!ballotBalance) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'Could not find leave balance for this staff.',
        });
      }

      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select('opsGroup')
        .lean();

      let dates = [];
      //var startDate = req.body.fromdate.split("-");
      let startdd = new Date(req.body.fromdate);
      console.log('StartDD : ', startdd);
      //let endDate= req.body.todate.split("-");
      let enddd = new Date(req.body.todate);
      console.log('enddd : ', enddd);
      //check in that dates.
      dates = getDateArray(startdd, enddd);
      console.log('DAtes: ', dates);
      var configurationNumber = 2;
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 1) {
        configurationNumber = 2;
      }
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 2) {
        configurationNumber = 1;
      }
      if (pageSettingData.opsGroup.blockLeaveConfiguration == 3) {
        configurationNumber = 0;
      }
      let daysToDeduct = dates.length;
      if (daysToDeduct % 7 == 0) {
        var n = daysToDeduct / 7;
        n = n * configurationNumber;
        daysToDeduct = daysToDeduct - n;
      }
      if (daysToDeduct > 0 && daysToDeduct < 7) {
        if (daysToDeduct == 6) {
          console.log('AT HHHHHH');
          daysToDeduct = 5;
        } else {
          daysToDeduct = daysToDeduct - configurationNumber * 0;
        }
      }
      if (daysToDeduct > 7 && daysToDeduct < 14) {
        daysToDeduct = daysToDeduct - configurationNumber * 1;
      }
      if (daysToDeduct > 14 && daysToDeduct < 21) {
        daysToDeduct = daysToDeduct - configurationNumber * 2;
      }
      if (daysToDeduct > 21 && daysToDeduct < 28) {
        daysToDeduct = daysToDeduct - configurationNumber * 3;
      }

      if (parseInt(ballotBalance.ballotLeaveBalanced) < daysToDeduct) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'This staff does not have sufficient leave ballance',
        });
      }
      let leaves = await userLeaves.find(
        { userId: req.body.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1, status: 1 },
      );
      // const Ballots = await Ballot.find({opsGroupId : req.body.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
      console.log('Leaves found are: ', leaves);
      for (let km = 0; km <= dates.length - 1; km++) {
        for (let leave = 0; leave <= leaves.length - 1; leave++) {
          let leavestart = new Date(leaves[leave].fromdate);
          let leaveend = new Date(leaves[leave].todate);
          if (
            dates[km] >= leavestart &&
            dates[km] <= leaveend &&
            leaves[leave].status !== 'cancelled'
          ) {
            return res.status(203).json({
              status: false,
              data: null,
              message:
                'Dates overlapping.. please check this user has assigned leave in requested period',
            });
            //break;
          } else {
            console.log('notfound');
          }
        }
      }
      console.log('Coming out here: ');
      res.status(201).json({ status: false, message: 'Everything is Fine' });
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }

    function getDateArray(start, end) {
      console.log('In get dates : ');
      var arr = new Array(),
        dt = new Date(start);
      while (dt <= end) {
        console.log('in while....');
        arr.push(new Date(dt));
        dt.setDate(dt.getDate() + 1);
      }
      console.log('At array: ', arr);
      return arr;
    }
  }
  async getLeaveByUser(req, res) {
    try {
      if (!req.body.opsGroupId || !req.body.userId) {
        return res.status(203).json({
          status: false,
          data: null,
          message: 'please select user and OpsGroup.',
        });
      }
      let isSwap = true;
      let ops = await OpsGroup.findOne(
        { _id: req.body.opsGroupId },
        { swopSetup: 1, userId: 1 },
      );
      if (ops && ops.swopSetup) {
        let isSwappable = parseInt(ops.swopSetup);
        if (isSwappable == 0) {
          isSwap = false;
        } else {
          isSwap = true;
        }
      }
      console.log('HER reached');
      let leaves = await userLeaves.find(
        { userId: req.body.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1, status: 1, isSwapable: 1 },
      );
      for (let l = 0; l <= leaves.length - 1; l++) {
        if (leaves[l].isSwapable == true) {
          console.log('true ahe');
        } else {
          leaves[l].isSwapable = isSwap;
        }
      }

      //From usersHolidays
      var leaves1 = leaves.filter((ff) => ff.status !== 'cancelled');
      // console.log("LEAVES: ",leaves1);
      let resp = { isSwap: isSwap, data: leaves1 };
      //console.log("User data id: ",all);
      res.status(201).json({
        status: true,
        data: resp,
        message: 'successfully received data.',
      });
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
  }
  async getUserLeaveLogs(req, res) {
    try {
      let leaves = await LeaveLog.find({
        userId: req.body.userId,
        $expr: { $eq: [{ $year: '$startDate' }, req.body.year] },
        $or: [
          {
            isChangeDate: true,
          },
          { status: 5 },
          {
            submittedFrom: 3,
          },
        ],
      }).populate([
        {
          path: 'cancelledBy',
          select: 'staffId name',
        },
        {
          path: 'changeDateHistory.changeBy',
          select: 'staffId name',
        },
        {
          path: 'allocatedBy',
          select: 'staffId name',
        },
      ]);
      leaves = JSON.parse(JSON.stringify(leaves));
      const finalLeave = [];
      for (let i = 0; i < leaves.length; i++) {
        if (leaves[i].isChangeDate) {
          const obj = leaves[i];
          for (let j = 0; j < obj.changeDateHistory.length; j++) {
            obj.changedBy = obj.changeDateHistory[j];
            finalLeave.push(obj);
          }
        } else {
          finalLeave.push(leaves[i]);
        }
      }
      res.status(201).json({
        status: true,
        data: leaves,
        message: 'successfully received data.',
      });
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
  }
  async getUsersListWithSwap(req, res) {
    let requestdata = req.body;
    try {
      if (requestdata.opsTeamId) {
        //ops team id is present there.
        const users = await OpsTeam.findOne(
          { _id: requestdata.opsTeamId },
          { _id: 0, userId: 1 },
        );
        const leaves = await userLeaves.find(
          { userId: { $in: users.userId } },
          {
            _id: 0,
            fromdate: 1,
            todate: 1,
            type: 1,
            status: 1,
            isSwapable: 1,
            userId: 1,
          },
        );
        // const Ballotings = await Ballot.find({opsGroupId : requestdata.opsGroupId,isCanceled:false},{_id:1,ballotName:1,ballotStartDate:1,ballotEndDate:1,weekRange:1,wonStaff:1});
        let wons = [];
        wons = wons.concat(leaves);
        let data = groupBy(wons, 'userId');
        //find data of individual user
        let response = [];
        for (let [key, value] of Object.entries(data)) {
          //console.log("key: ",key);
          try {
            const ops = await OpsGroup.findOne(
              { userId: key, isDelete: false },
              { swopSetup: 1 },
            );
            const user = await User.findOne(
              { _id: key },
              { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
            );
            ops.swopSetup = parseInt(ops.swopSetup);
            let isSwap = false;
            if (ops.swopSetup == 0) {
              isSwap = false;
              if (user.isLeaveSwapAllowed == true) {
                isSwap = false;
              } else if (user.hasOwnProperty('isLeaveSwapAllowed')) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed == false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            } else {
              isSwap = false;
              if (user.isLeaveSwapAllowed == true) {
                isSwap = true;
              } else if (user.hasOwnProperty('isLeaveSwapAllowed')) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed == false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            }
            // console.log("user : ",user);
            value.map(function (entry) {
              if (entry.type == 1) {
                if (ops.swopSetup == 0) {
                  entry.isSwapable = false;
                } else {
                  entry.isSwapable = true;
                }
              } else {
                console.log('kuch nhi');
              }
              return entry;
            });
            var User1 = {
              id: user._id,
              name: user.name,
              staffId: user.staffId,
              leavedata: value,
              isAllowedToSwap: isSwap,
            };
            response.push(User1);
          } catch (e) {
            console.log('e', e);
            // res.send(e);
          }
        }
        res.status(201).json({
          status: true,
          data: response,
          message: 'successfully received data.',
        });
      } else {
        const users = await OpsGroup.findOne(
          { _id: requestdata.opsGroupId },
          { _id: 0, userId: 1 },
        );
        const leaves = await userLeaves.find(
          { userId: { $in: users.userId } },
          {
            _id: 0,
            fromdate: 1,
            todate: 1,
            type: 1,
            status: 1,
            isSwapable: 1,
            userId: 1,
          },
        );
        let wons = [];
        wons = wons.concat(leaves);
        let data = groupBy(wons, 'userId');
        //find data of individual user
        let response = [];
        for (let [key, value] of Object.entries(data)) {
          console.log('key: ', key);
          try {
            const ops = await OpsGroup.findOne(
              { userId: key, isDelete: false },
              { swopSetup: 1 },
            );
            const user = await User.findOne(
              { _id: key },
              { name: 1, staffId: 1, isLeaveSwapAllowed: 1 },
            );
            ops.swopSetup = parseInt(ops.swopSetup);
            let isSwap = false;
            if (ops.swopSetup == 0) {
              isSwap = false;
              if (user.isLeaveSwapAllowed == true) {
                isSwap = false;
              } else if (user.hasOwnProperty('isLeaveSwapAllowed')) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed == false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            } else {
              isSwap = false;
              if (user.isLeaveSwapAllowed == true) {
                isSwap = true;
              } else if (user.hasOwnProperty('isLeaveSwapAllowed')) {
                isSwap = user.isLeaveSwapAllowed;
              } else if (user.isLeaveSwapAllowed == false) {
                isSwap = false;
              } else {
                isSwap = false;
              }
            }

            value.map(function (entry) {
              if (entry.type == 1) {
                if (ops.swopSetup == 0) {
                  entry.isSwapable = false;
                } else {
                  entry.isSwapable = true;
                }
              } else {
                console.log('kuch nhi');
              }
              return entry;
            });

            var User1 = {
              id: user._id,
              name: user.name,
              staffId: user.staffId,
              leavedata: value,
              isAllowedToSwap: isSwap,
            };
            response.push(User1);
          } catch (e) {
            console.log('e', e);
            // res.send(e);
          }
        }
        res.status(201).json({
          status: true,
          data: response,
          message: 'successfully received data.',
        });
      }
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
  }
  async getUsersListWithSwapNew(req, res) {
    let requestdata = req.body;
    try {
      if (requestdata.opsTeamId) {
        //ops team id is present there.
        const users = await OpsTeam.findOne(
          { _id: requestdata.opsTeamId },
          { _id: 0, userId: 1 },
        ).populate([
          {
            path: 'userId',
            select: 'name staffId isLeaveSwapAllowed',
          },
        ]);
        res.status(201).json({
          status: true,
          data: users,
          message: 'successfully received data.',
        });
      } else {
        const users = await OpsGroup.findOne(
          { _id: requestdata.opsGroupId },
          { _id: 0, userId: 1 },
        ).populate([
          {
            path: 'userId',
            select: 'name staffId isLeaveSwapAllowed',
          },
        ]);
        res.status(201).json({
          status: true,
          data: users,
          message: 'successfully received data.',
        });
      }
    } catch (e) {
      res.status(500).json({ status: false, message: 'Something went wrong!' });
    }
    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
  }
  async swapRestrictToUser(req, res) {
    try {
      let userId = req.params.userid;
      const user = await User.findOne(
        { _id: userId },
        { isLeaveSwapAllowed: 1 },
      );
      if (user.isLeaveSwapAllowed && user.isLeaveSwapAllowed == true) {
        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { isLeaveSwapAllowed: false } }
        );
        res
           .status(201)
           .json({ status: true, message: 'successfully updated.' });
      } else {
        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { isLeaveSwapAllowed: true }});

        res
        .status(201)
        .json({ status: true, message: 'successfully updated.' });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async checkForDateOverlapWhenApply(res, data) {
    try {
      let dates = [];
      var startDate = data.fromdate.split('-');
      let startdd = new Date(
        +startDate[2],
        startDate[1] - 1,
        +startDate[0] + 1,
      );
      let endDate = data.todate.split('-');
      let enddd = new Date(+endDate[2], endDate[1] - 1, +endDate[0] + 1);
      //check in that dates.
      dates = getDateArray(startdd, enddd);
      let leaves = await userHoliday.find(
        { userId: data.userId },
        { _id: 1, fromdate: 1, todate: 1, type: 1 },
      );
      const Ballots = await Ballot.find(
        { opsGroupId: data.opsGroupId, isCanceled: false },
        {
          _id: 1,
          ballotName: 1,
          ballotStartDate: 1,
          ballotEndDate: 1,
          weekRange: 1,
          wonStaff: 1,
        },
      );

      for (let km = 0; km <= dates.length - 1; km++) {
        for (let leave = 0; leave <= leaves.length - 1; leave++) {
          let leaveend;
          var leavestart = leaves[leave].fromdate.split('-');
          leavestart = new Date(
            +leavestart[2],
            leavestart[1] - 1,
            +leavestart[0] + 1,
          );
          if (leaves[leave].todate) {
            leaveend = leaves[leave].todate.split('-');
            leaveend = new Date(
              +leaveend[2],
              leaveend[1] - 1,
              +leaveend[0] + 1,
            );
          }
          if (
            data.idis &&
            data.idis.toString() == leaves[leave]._id.toString()
          ) {
            console.log('same id found', data.idis);
          } else {
            if (
              dates[km] >= leavestart &&
              dates[km] <= leaveend &&
              leaves[leave].status !== 'cancelled'
            ) {
              return 0; // 0 says dates overlapping..
              //break;
            } else {
              console.log('notfound');
            }
          }
        }
      }
      //check with Ballots as well
      for (let km = 0; km <= dates.length - 1; km++) {
        for (let bb = 0; bb <= Ballots.length - 1; bb++) {
          for (let dm = 0; dm <= Ballots[bb].weekRange.length - 1; dm++) {
            let start = new Date(Ballots[bb].weekRange[dm].start);
            let end = new Date(Ballots[bb].weekRange[dm].end);
            let end1 = nextDayUTC(end);
            if (dates[km] <= end1 && dates[km] >= start) {
              let wondate = Ballots[bb].wonStaff.filter(
                (ws) =>
                  ws.opsGroupId == data.opsGroupId &&
                  ws.userId == data.userId &&
                  ws.weekNo == dm,
              );
              if (wondate.length > 0) {
                return 0; //0 says dates overlapping
                // return res.status(203).json({status: false, data: null, message: "Dates overlapping.. plese check if this user has won some ballots"});
              } else {
                console.log('in ballotings');
              }
            }
            //to add day in end date found from end date of ballot weekRange.
            function nextDayUTC(d) {
              var aDay = 1440 * 60 * 1000;
              var d2 = new Date(Math.trunc((d.getTime() + aDay) / aDay) * aDay);
              return d2;
            }
          }
        }
      }
      console.log('returnong');
      return 1;
      function getDateArray(start, end) {
        console.log('In get dates : ');
        var arr = new Array(),
          dt = new Date(start);
        while (dt <= end) {
          console.log('in while....');
          arr.push(new Date(dt));
          dt.setDate(dt.getDate() + 1);
        }
        console.log('At array: ', arr);
        return arr;
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async applyForLeave(req, res) {
    try {
      console.log('here see');
      let request = req.body;
      const ops = await OpsGroup.findOne(
        { userId: request.userId, isDelete: false },
        { _id: 1 },
      );
      const opsTeam = await OpsTeam.findOne(
        { userId: request.userId, isDeleted: false },
        { _id: 1 },
      );
      let data = {
        fromdate: request.fromdate,
        todate: request.todate,
        userId: request.userId,
        opsGroupId: ops._id,
      };
      var check = await this.checkForDateOverlapWhenApply(res, data);
      console.log('here check is: ', check);
      if (check == 0) {
        return res.status(300).json({
          success: false,
          data: check,
          message: 'Dates overlapping!',
        });
      }
      console.log('check', check);
      var myLog = {
        updatedBy: req.user.name,
        message: 4, //1-Allocation 2- Change date 3-cancellation,4-applied
        fromdate: request.fromdate,
        todate: request.todate,
      };
      var leaveapplication = {
        userId: request.userId,
        username: req.user.name,
        fromdate: request.fromdate,
        todate: request.todate,
        type: request.leaveType,
        reason: request.reason,
        status: 'Applied',
        opsGroupId: ops._id,
        logs: [myLog],
      };
      if (req.body.attachment) {
        leaveapplication.attachment = req.body.attachment[0].url;
        leaveapplication.fileName = req.body.attachment[0].fileName;
      }
      if (opsTeam) {
        leaveapplication.opsTeamId = opsTeam._id;
      }
      console.log('leave: ', leaveapplication);
      var apply = new userHoliday(leaveapplication);
      apply.save(function (err, applied) {
        if (err) {
          console.log('ree: ', err);
          return res.status(500).json({
            success: false,
            data: err,
            message: 'Something went wrong!',
          });
        } else {
          console.log('in else');
          return res.status(201).json({
            success: true,
            data: applied,
            message: 'Successfully saved!',
          });
        }
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }
  async getMyLeaves(req, res) {
    //In this api , neet to also give swop /no swop status to show and hide swop buttons on mobile
    let userrequested = req.user._id;
    try {
      const leaves1 = await userHoliday.find(
        { userId: userrequested },
        {
          _id: 1,
          fromdate: 1,
          todate: 1,
          username: 1,
          type: 1,
          status: 1,
          isSwapable: 1,
        },
      );
      let leaves = JSON.stringify(leaves1);
      leaves = JSON.parse(leaves);
      for (let l = 0; l <= leaves.length - 1; l++) {
        var datePartsss = leaves[l].fromdate.split('-');
        var dateParteee = leaves[l].todate.split('-');
        let startdd = new Date(
          +datePartsss[2],
          datePartsss[1] - 1,
          +datePartsss[0] + 1,
        );
        let enddd = new Date(
          +dateParteee[2],
          dateParteee[1] - 1,
          +dateParteee[0] + 1,
        );
        const leaveswaprequest = await swopRequests.find({
          userTo: req.user._id,
          leaveTo: leaves[l]._id,
        });
        if (leaveswaprequest && leaveswaprequest.length > 0) {
          leaves[l].isSwapRequest = true;
          let pendings = leaveswaprequest.filter((x) => x.requestStatus == 1);
          if (pendings.length > 0) {
            leaves[l].swapCount = pendings.length;
          }
        }
        try {
          var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
          leaves[l].days = days + 1;
        } catch (e) {
          return res.status(500).json({
            success: false,
            data: e,
            message: 'Something went wrong!',
          });
        }
      }

      return res.status(201).json({
        success: true,
        data: leaves,
        message: 'received!',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }
  // Upload social banner image
  async uploadAtachment(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }
      // const result = await __.scanFile(req.file.filename, `public/uploads/leaves/${req.file.filename}`);
      // if (!!result) {
      //     return __.out(res, 300, result);
      // }
      return __.out(res, 201, {
        filePath: `uploads/leaves/${req.file.filename}`,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
  async getLeaveById(req, res) {
    let leaveId = req.params.id;
    try {
      const leave = await userHoliday.findOne(
        { _id: leaveId },
        {
          userId: 1,
          username: 1,
          fromdate: 1,
          todate: 1,
          attachment: 1,
          isSwapable: 1,
          type: 1,
        },
      );
      return res.status(201).json({
        success: true,
        data: leave,
        message: 'received!',
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went wrong!',
      });
    }
  }
  async updateLeave(req, res) {
    try {
      console.log('req,', req.body);
      const currentLeave = await userHoliday.findOne({ _id: req.body._id });
      console.log('curr leave: ', currentLeave);
      let data = {
        opsGroupId: currentLeave.opsGroupId,
        userId: req.user._id,
        fromdate: req.body.fromdate,
        todate: req.body.todate,
        idis: currentLeave._id,
      };
      var check = await this.checkForDateOverlapWhenApply(res, data);
      if (check == 0) {
        return res.status(300).json({
          success: false,
          data: check,
          message: 'Dates overlapping!',
        });
      } else {
        console.log('in else');
        if (currentLeave) {
          console.log('Here currentleave is: ', currentLeave);
          let log = currentLeave.logs;
          var myLog = {
            updatedBy: req.user.name,
            message: 2, //1-Allocation 2- Change date 3-cancellation,
            fromdate: currentLeave.fromdate,
            todate: currentLeave.todate,
            fromCurrentdate: req.body.fromdate,
            toCurrentdate: req.body.todate,
          };
          log.push(myLog);
          var from = currentLeave.fromdate;
          currentLeave.logs = log;
          currentLeave.fromdate = req.body.fromdate;
          currentLeave.todate = req.body.todate;
          currentLeave.type = req.body.type;
          currentLeave.isSwapable = req.body.isSwapable;
          //currentLeave.attachment = req.body.isSwapable;
          await currentLeave.save();
          return res.status(201).json({
            success: true,
            data: currentLeave,
            message: 'Updated Successfully!',
          });
        } else {
          res.status(203).json({
            status: false,
            data: null,
            message: 'Sorry ! couldnt find similar data',
          });
        }
      }
    } catch (e) {
      res
        .status(501)
        .json({ status: false, data: null, message: 'Something went wrong!' });
    }
  }
  async checkIfHasParent(res, ballotid) {
    try {
      console.log('parat alao');
      let currentBallot = await Ballot.findOne(
        { _id: ballotid },
        { parentBallot: 1, childBallots: 1 },
      );
      if (!currentBallot) {
        //console.logs("NO ballot found");
      } else {
        //console.logs("in else of current data found");
        if (currentBallot.parentBallot) {
          console.log('here in parent checkbaga baga');
          //console.logs("in if of parent data",currentBallot.parentBallot);
          return this.checkIfHasParent(res, currentBallot.parentBallot);
        }
        if (
          currentBallot.childBallots &&
          currentBallot.childBallots.length > 0
        ) {
          console.log('here baga baga');
          let list = [];
          list.push(currentBallot._id);
          list = list.concat(currentBallot.childBallots);
          console.log('list s: ', list);
          return list;
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getSwapDetailChanges(req, res) {
    try {
      let reqdata = req.body;
      let slotDates;
      let ballot;
      let leave;
      let wons = [];
      leave = await userLeaves.findOne({ _id: reqdata.leaveId });
      let frm = leave.fromdate;
      let tm = leave.todate;
      slotDates = { start: frm, end: tm };
      const ops = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { opsGroupName: 1, swopSetup: 1, userId: 1 },
      );
      // .populate({path:'userId',select:'name staffId'});
      if (ops) {
        const currentuser = await User.findOne(
          { _id: req.user._id },
          { _id: 0, parentBussinessUnitId: 1 },
        ).populate({
          path: 'parentBussinessUnitId',
          select: 'name',
          populate: {
            path: 'sectionId',
            select: 'name',
            populate: {
              path: 'departmentId',
              select: 'name',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        });
        let BU =
          currentuser.parentBussinessUnitId.sectionId.departmentId.companyId
            .name +
          ' > ' +
          currentuser.parentBussinessUnitId.sectionId.departmentId.name +
          ' > ' +
          currentuser.parentBussinessUnitId.sectionId.name +
          ' > ' +
          currentuser.parentBussinessUnitId.name;
        let resObj = {};
        let allUsers = ops.userId.filter(
          (op) => op.toString() !== req.user._id.toString(),
        );
        let allLeaves = [];
        if (leave.type == 1 || leave.type == 3) {
          const balloted = await userLeaves.find({
            type: 1,
            status: 'Balloted',
            userId: { $in: allUsers },
          });
          allLeaves = allLeaves.concat(balloted);
          const blockAllocated = await userLeaves.find({
            type: 3,
            status: 'Allocated',
            userId: { $in: allUsers },
          });
          allLeaves = allLeaves.concat(blockAllocated);
        } else {
          const casualAllocated = await userLeaves.find({
            type: 2,
            status: 'Allocated',
            userId: { $in: allUsers },
          });
          allLeaves = allLeaves.concat(casualAllocated);
        }
        //console.log("casualAlocated: ",casualAlocated);
        resObj.Bu = BU;
        resObj.opsName = ops.opsGroupName;
        resObj.opsGroupId = ops._id;
        if (leave.type == 1) {
          resObj.type = 'Block-Balloted';
        }
        if (leave.type == 3) {
          resObj.type = 'Block-Allocated';
        }
        if (leave.type == 2) {
          resObj.type = 'Casual';
        }
        if (leave.type == 4) {
          resObj.type = 'Special';
        }
        var datePartsss = leave.fromdate;
        var dateParteee = leave.todate;
        let startdd = new Date(datePartsss);
        let enddd = new Date(dateParteee);
        var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
        days = days + 1;
        resObj.leavedays = days - 2;
        resObj.currentdates = slotDates;
        // resObj.users=users,
        resObj.leaveId = reqdata.leaveId;
        resObj.weekRange = [];
        for (let key = 0; key <= allLeaves.length - 1; key++) {
          if (
            leave.fromdate == allLeaves[key].fromdate &&
            leave.todate == allLeaves[key].todate
          ) {
            console.log('same ahe');
          } else {
            let from = allLeaves[key].fromdate;
            let to = allLeaves[key].todate;
            let frmdd = new Date(from);
            let todd = new Date(to);
            var totaldays = Math.floor((todd - frmdd) / (1000 * 60 * 60 * 24));
            totaldays = totaldays + 1;
            let type = '';
            if (totaldays > 7) {
              type = 'Non-standanrd';
            } else {
              type = 'standard';
            }
            let range = {
              date: frmdd,
              start: from,
              end: to,
              days: totaldays,
              type: type,
            };
            resObj.weekRange.push(range);
          }
        }

        if (leave.type == 1 || leave.type == 3) {
          console.log('INSIDE ME ');
          let weekRange = [];
          var standards = resObj.weekRange.filter(
            (qq) => qq.type == 'standard',
          );
          const BB = standards.sort((a, b) => b.date - a.date);
          BB == BB.reverse();
          var trrObject = removeDuplicates(BB, 'start', 'end');
          weekRange = weekRange.concat(trrObject);
          var nonstandards = resObj.weekRange.filter(
            (qq) => qq.type == 'Non-standanrd',
          );
          const BB1 = nonstandards.sort((a, b) => b.date - a.date);
          BB1 == BB1.reverse();
          weekRange = weekRange.concat(BB1);
          resObj.weekRange = [];
          resObj.weekRange = weekRange;
        } else {
          //  let weekRange = resObj.weekRange;
          const BB = resObj.weekRange.sort((a, b) => b.date - a.date);
          BB == BB.reverse();
          resObj.weekRange = [];
          resObj.weekRange = BB;
        }
        console.log('OUTSIDE ME ');

        function removeDuplicates(originalArray, objKey, objKey1) {
          var trimmedArray = [];
          var values = [];
          var value;
          var val1;
          for (var i = 0; i < originalArray.length; i++) {
            value = {
              start: originalArray[i][objKey],
              end: originalArray[i][objKey1],
            };
            var val1 = JSON.stringify(value);
            if (values.indexOf(val1) === -1) {
              trimmedArray.push(originalArray[i]);
              values.push(val1);
            } else {
              console.log('in else else /...');
            }
          }
          return trimmedArray;
        }
        //  var trrObject=  removeDuplicates(resObj.weekRange, 'start','end');
        // resObj.weekRange = trrObject;
        return res.status(201).json({
          success: true,
          data: resObj,
          message: 'received!',
        });
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find ops group data of you.",
        });
      }
      function groupBy(xs, key) {
        return xs.reduce(function (rv, x) {
          (rv[x[key]] = rv[x[key]] || []).push(x);
          return rv;
        }, {});
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getslotswonByUser(req, res) {
    try {
      const leave = await userLeaves.findOne({ _id: req.body.leaveId });
      let dates = [];
      var startDate = req.body.start.split('-');
      startDate = startDate[2] + '-' + startDate[1] + '-' + startDate[0];
      startDate = startDate.split('-');
      let startdd = new Date(
        +startDate[2],
        startDate[1] - 1,
        +startDate[0] + 1,
      );
      // let startdd = new Date(req.body.start);
      // let enddd = new Date(req.body.end);
      let endDate = req.body.end.split('-');
      endDate = endDate[2] + '-' + endDate[1] + '-' + endDate[0];
      endDate = endDate.split('-');
      let enddd = new Date(+endDate[2], endDate[1] - 1, +endDate[0] + 1);
      //check in that dates.
      dates = await getDateArray(startdd, enddd);
      //console.log("userleave: ",leave);
      const ops = await OpsGroup.findOne(
        { _id: req.body.opsGroupId },
        { opsGroupName: 1, userId: 1 },
      );
      let allUsers = ops.userId.filter(
        (op) => op.toString() !== req.user._id.toString(),
      );
      // console.log("allUsers",allUsers);
      let userleaves = [];
      if (leave.type == 1 || leave.type == 3) {
        userleaves = await userLeaves
          .find({
            userId: { $in: allUsers },
            type: { $in: [1, 3] },
            status: { $in: ['Allocated', 'Balloted'] },
          })
          .populate([{ path: 'userId', select: 'name staffId' }]);
      } else {
        userleaves = await userLeaves
          .find({ userId: { $in: allUsers }, type: 2, status: 'Allocated' })
          .populate([{ path: 'userId', select: 'name staffId' }]);
      }
      //  console.log("userleaves are: ",userleaves);
      if (userleaves && userleaves.length > 0) {
        let resArr = [];
        for (let i = 0; i <= userleaves.length - 1; i++) {
          var dateInLeave = [];
          var startleave = userleaves[i].fromdate.split('-');
          startleave =
            startleave[2] + '-' + startleave[1] + '-' + startleave[0];
          startleave = startleave.split('-');
          let startddleave = new Date(
            +startleave[2],
            startleave[1] - 1,
            +startleave[0] + 1,
          );
          //let startddleave = new Date(startleave);
          //    let endddleave = new Date(userleaves[i].todate);
          let endleave = userleaves[i].todate.split('-');
          endleave = endleave[2] + '-' + endleave[1] + '-' + endleave[0];
          endleave = endleave.split('-');
          let endddleave = new Date(
            +endleave[2],
            endleave[1] - 1,
            +endleave[0] + 1,
          );
          //    let endleave= userleaves[i].todate.split("-");
          //    let endddleave = new Date(endleave);
          //check in that dates.
          dateInLeave = await getDateArray(startddleave, endddleave);
          var check = findCommonElement(dates, dateInLeave);
          if (check == true) {
            const sapData = await StaffSapData.findOne(
              { staff_Id: userleaves[i].userId._id },
              { ballotLeaveBalanced: 1 },
            );
            let currObj = {};
            var checkIfUserAlreadyExists;
            if (resArr.length > 0) {
              var checkIfUserAlreadyExists = checkOfUser(
                resArr,
                userleaves[i].userId._id,
              );
            }

            if (checkIfUserAlreadyExists !== -1) {
              currObj.type = userleaves[i].type;
              currObj.leaveId = userleaves[i]._id;
              currObj._id = userleaves[i].userId._id;
              currObj.name = userleaves[i].userId.name;
              currObj.staffId = userleaves[i].userId.staffId;
              currObj.ballotBalance = sapData.ballotLeaveBalanced;
              resArr.push(currObj);
            } else {
              console.log('need not to push');
            }
          }
        }
        function checkOfUser(array, currentuserid) {
          for (let i = 0; i <= array.length - 1; i++) {
            if (array[i]._id.toString() == currentuserid.toString()) {
              return -1;
            } else {
              console.log('no');
            }
          }
        }
        //console.log("RES ARA: ",resArr);
        return res.status(201).json({
          success: true,
          data: resArr,
          message: 'received!',
        });
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find requested users leaves.",
        });
      }

      async function getDateArray(start, end) {
        // console.log("In get dates : ");
        var arr = new Array(),
          dt = new Date(start);
        while (dt <= end) {
          //  console.log("in while....");
          arr.push(new Date(dt));
          dt.setDate(dt.getDate() + 1);
        }
        // console.log("At array: ",arr);
        return arr;
      }

      function findCommonElement(array1, array2) {
        for (let i = 0; i < array1.length; i++) {
          for (let j = 0; j < array2.length; j++) {
            if (array1[i].toString() == array2[j].toString()) {
              // console.log("inside of if");
              // Return if common element found
              return true;
            }
          }
        }
        // Return if no common element exist
        return false;
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async saveSwopRequest(req, res) {
    try {
      let reqObject = req.body;
      let requiredResult = await __.checkRequiredFields(req, [
        'userFrom',
        'userTo',
        'opsGroupId',
        'leaveFrom',
        'leaveTo',
      ]);
      if (requiredResult.status == false) {
        return res.status(300).json({
          success: false,
          data: null,
          message: 'Missing Fields Error!',
        });
      } else {
        const requestsswoping = await swopRequests.find({
          userFrom: req.user._id,
          leaveTo: reqObject.leaveTo,
          requestStatus: 1,
        });
        if (requestsswoping.length > 0) {
          return res.status(300).json({
            success: false,
            data: null,
            message: 'You have already sent request for these leave dates!',
          });
        }

        //check if userFrom already have dates which he is requesting for
        const leaveTo = await userLeaves.findOne(
          { _id: reqObject.leaveTo },
          { fromdate: 1, todate: 1 },
        );
        if (leaveTo) {
          const userFrom = await userLeaves.find({
            userId: reqObject.userFrom,
            fromdate: leaveTo.fromdate,
            todate: leaveTo.todate,
          });
          if (userFrom.length > 0) {
            return res.status(300).json({
              success: false,
              data: null,
              message: 'You already have these dates.',
            });
          } else {
            console.log('Go ahead');
          }
        } else {
          return res.status(300).json({
            success: false,
            data: null,
            message: 'Could not find your leave data!',
          });
        }

        //check if userFrom already has dates within requesting date ranges
        const userFromLeaves = await userLeaves.find({
          userId: reqObject.userFrom,
        });
        if (userFromLeaves.length > 0) {
          let dates = [];
          let startdd = new Date(leaveTo.fromdate);
          let enddd = new Date(leaveTo.todate);

          //check in that dates.
          dates = getArrayOfDates(startdd, enddd);
          console.log('date: ', dates);

          for (let km = 0; km <= dates.length - 1; km++) {
            for (let leave = 0; leave <= userFromLeaves.length - 1; leave++) {
              let leavestart = new Date(userFromLeaves[leave].fromdate);
              let leaveend = new Date(userFromLeaves[leave].todate);

              if (
                dates[km] >= leavestart &&
                dates[km] <= leaveend &&
                userFromLeaves[leave].status !== 'cancelled'
              ) {
                // 0 says dates overlapping..
                return res.status(300).json({
                  success: false,
                  data: null,
                  message: 'This staff has these dates within this date range.',
                });
                //break;
              } else {
                console.log('notfound');
              }
            }
          }
          function getArrayOfDates(start, end) {
            console.log('In get dates : ');
            var arr = new Array(),
              dt = new Date(start);

            while (dt <= end) {
              console.log('in while....');
              arr.push(new Date(dt));
              dt.setDate(dt.getDate() + 1);
            }
            console.log('At array: ', arr);
            return arr;
          }
        } else {
          console.log('in els go ahead');
        }

        //Check if userTo already have those dates which are requested.
        const leaveFrom = await userLeaves.findOne(
          { _id: reqObject.leaveFrom },
          { fromdate: 1, todate: 1 },
        );
        if (leaveFrom) {
          const userTo = await userLeaves.find({
            userId: reqObject.userTo,
            fromdate: leaveFrom.fromdate,
            todate: leaveFrom.todate,
          });
          if (userTo.length > 0) {
            return res.status(300).json({
              success: false,
              data: null,
              message: 'This staff already has these dates.',
            });
          } else {
            console.log('Go ahead');
          }
        } else {
          return res.status(300).json({
            success: false,
            data: null,
            message: 'Could not find leave you are requesting to!',
          });
        }

        let oobj = new swopRequests(reqObject);
        oobj.save(async function (err, resObj) {
          if (err) {
            return res.status(500).json({
              success: false,
              data: err,
              message: 'Something went wrong!!',
            });
          } else {
            res.status(201).json({
              success: true,
              data: resObj,
              message: 'Saved!!',
            });
            const user = await User.findOne(
              { _id: reqObject.userTo },
              { _id: 0, deviceToken: 1 },
            );
            const userFrom = await User.findOne(
              { _id: resObj.userFrom },
              { name: 1 },
            );
            let usersDeviceTokens = [];
            var dd = new Date();
            if (user && user.deviceToken) {
              console.log('USER: ', user);
              usersDeviceTokens.push(user.deviceToken);
              var collapseKey = resObj._id;
              let notificationObj = {
                title: 'Leave Swap Request.',
                body: 'You have Leave Swap request from ' + userFrom.name + '.',
                bodyText: 'You have Leave Swap request ' + userFrom.name + '.',
                bodyTime: dd,
                bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
              };

              FCM.push(usersDeviceTokens, notificationObj, collapseKey);
              console.log('sent');
            }
          }
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getMyReceivedSwapRequests(req, res) {
    try {
      let reqdata = req.body;
      const swapRequests = await swopRequests
        .find({
          userTo: reqdata.userId,
          leaveTo: reqdata.leaveId,
          requestStatus: 1,
        })
        .populate([
          { path: 'userFrom', select: 'name staffId' },
          { path: 'opsGroupId', select: 'opsGroupName' },
          { path: 'leaveFrom', select: 'fromdate todate type status' },
          { path: 'leaveTo', select: 'fromdate todate type status' },
        ]);
      let resdata = [];
      if (swapRequests.length > 0) {
        for (let i = 0; i <= swapRequests.length - 1; i++) {
          var startslotdate = swapRequests[i].leaveFrom.fromdate;
          var endslotdate = swapRequests[i].leaveFrom.todate;
          let slotDates = { start: startslotdate, end: endslotdate };
          const user = await User.findOne(
            { _id: swapRequests[i].userFrom._id },
            { _id: 0, parentBussinessUnitId: 1 },
          ).populate({
            path: 'parentBussinessUnitId',
            select: 'name',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          });
          let BU =
            user.parentBussinessUnitId.sectionId.departmentId.companyId.name +
            ' > ' +
            user.parentBussinessUnitId.sectionId.departmentId.name +
            ' > ' +
            user.parentBussinessUnitId.sectionId.name +
            ' > ' +
            user.parentBussinessUnitId.name;
          let data = {};
          data.Bu = BU;
          data.opsName = swapRequests[i].opsGroupId.opsGroupName;
          data.opsGroupId = swapRequests[i].opsGroupId._id;
          if (swapRequests[i].leaveFrom.type == 1) {
            data.type = 'Block-Balloted';
          }
          if (swapRequests[i].leaveFrom.type == 3) {
            data.type = 'Block-Allocated';
          }
          if (swapRequests[i].leaveFrom.type == 2) {
            data.type = 'Casual';
          }
          if (swapRequests[i].leaveFrom.type == 4) {
            data.type = 'Special';
          }
          // var datePartsss = swapRequests[i].leaveFrom.fromdate.split("-");
          // var dateParteee = swapRequests[i].leaveFrom.todate.split("-");
          let startdd = new Date(swapRequests[i].leaveFrom.fromdate);
          let enddd = new Date(swapRequests[i].leaveFrom.todate);
          var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
          days = days + 1;
          var daysAsLeaves = await noOfDays(res, days);
          //  if(days % 7==0){
          //      var n = days/7;
          //      n = n*2;
          //      days = days-n;
          //  }
          data.leavedays = daysAsLeaves;
          data.slotNoFor = reqdata.slotNo;
          data.leaveId = reqdata.leaveId;
          // var Toslotdate = swapRequests[i].leaveTo.fromdate.split("-");
          // Toslotdate=Toslotdate[2]+'-'+Toslotdate[1]+'-'+Toslotdate[0];
          // var Toendslotdate = swapRequests[i].leaveTo.todate.split("-");
          // Toendslotdate=Toendslotdate[2]+'-'+Toendslotdate[1]+'-'+Toendslotdate[0];
          data.currentdates = {
            start: swapRequests[i].leaveTo.fromdate,
            end: swapRequests[i].leaveTo.todate,
          };
          data.slotToExchange = slotDates;
          data.users = swapRequests[i].userFrom;
          // data.ballotId=reqdata.ballotId;
          data.swapRequestId = swapRequests[i]._id;
          data.requestStatus = swapRequests[i].requestStatus;
          resdata.push(data);
        }
        return res.status(201).json({
          success: true,
          data: resdata,
          message: 'received!',
        });
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find swap requests for this slot.",
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async acceptSwopRequest(req, res) {
    try {
      let data = req.body;
      console.log('data: ', data);
      const swopReq = await swopRequests.findOne({ _id: data.requestId });
      console.log('SWON: ', swopReq);
      if (!swopReq) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find swap request.",
        });
      } else {
        if (data.action == 2) {
          const leaveTo = await userLeaves.findOne(
            { _id: swopReq.leaveTo },
            { fromdate: 1, todate: 1, type: 1 },
          );
          const leaveFrom = await userLeaves.findOne(
            { _id: swopReq.leaveFrom },
            { fromdate: 1, todate: 1, type: 1 },
          );
          //check diffrences of leaves
          //For leaveTodats here
          // var dateLeaveToPartsss = leaveTo.fromdate.split("-");
          // var dateLeaveToParteee = leaveTo.todate.split("-");
          let startLeaveTodd = new Date(leaveTo.fromdate);
          let endLeaveTodd = new Date(leaveTo.todate);
          var LeaveTodays = Math.floor(
            (endLeaveTodd - startLeaveTodd) / (1000 * 60 * 60 * 24),
          );
          LeaveTodays = LeaveTodays + 1;
          if (leaveTo.type == 1 || leaveTo.type == 3) {
            LeaveTodays = await noOfDays(res, LeaveTodays);
          }
          //  var dateLeaveFromPartsss = leaveFrom.fromdate.split("-");
          //  var dateLeaveFromParteee = leaveFrom.todate.split("-");
          let startLeaveFromdd = new Date(leaveFrom.fromdate);
          let endLeaveFromdd = new Date(leaveFrom.todate);
          var LeaveFromdays = Math.floor(
            (endLeaveFromdd - startLeaveFromdd) / (1000 * 60 * 60 * 24),
          );
          LeaveFromdays = LeaveFromdays + 1;
          if (leaveFrom.type == 1 || leaveFrom.type == 3) {
            LeaveFromdays = await noOfDays(res, LeaveFromdays);
          }

          if (LeaveFromdays == LeaveTodays) {
            console.log('sssame');
          }
          if (LeaveFromdays > LeaveTodays) {
            console.log('From is greater');
            var diff = LeaveFromdays - LeaveTodays;
            let updateduserFrom = await StaffSapData.update(
              { staff_Id: swopReq.userFrom },
              { $inc: { ballotLeaveBalanced: diff } },
            );
            let updateduserTo = await StaffSapData.update(
              { staff_Id: swopReq.userTo },
              { $inc: { ballotLeaveBalanced: -diff } },
            );
          }
          if (LeaveFromdays < LeaveTodays) {
            console.log('From is lesser');
            var diff = LeaveTodays - LeaveFromdays;
            let updateduserFrom = await StaffSapData.update(
              { staff_Id: swopReq.userFrom },
              { $inc: { ballotLeaveBalanced: -diff } },
            );
            let updateduserTo = await StaffSapData.update(
              { staff_Id: swopReq.userTo },
              { $inc: { ballotLeaveBalanced: diff } },
            );
          }
          //Exchange Actual leaves
          //LevaeFrom
          const userFrom = await User.findOne(
            { _id: swopReq.userFrom },
            { name: 1, staffId: 1 },
          );
          leaveTo.userId = userFrom._id;
          await leaveTo.save();
          const userTo = await User.findOne(
            { _id: swopReq.userTo },
            { name: 1, staffId: 1 },
          );
          leaveFrom.userId = userTo._id;
          await leaveFrom.save();
          swopReq.requestStatus = 2;
          await swopReq.save();
          let userFromTokens = [];
          //same request from dates
          const leavesall = await userLeaves.find({
            fromdate: leaveFrom.fromdate,
            todate: leaveFrom.todate,
            userId: { $nin: [swopReq.userFrom, swopReq.userTo] },
          });

          if (leavesall.length > 0) {
            for (let i = 0; i <= leavesall.length - 1; i++) {
              const sameLeaveFroms = await swopRequests.find({
                userTo: swopReq.userTo,
                userFrom: leavesall[i].userId,
                requestStatus: 1,
              });
              if (sameLeaveFroms.length > 0) {
                let idss = [];
                for (
                  let element = 0;
                  element <= sameLeaveFroms.length - 1;
                  element++
                ) {
                  idss.push(sameLeaveFroms[element]._id);
                  const userFrm = await User.findOne(
                    { _id: sameLeaveFroms[element].userFrom },
                    { _id: 0, deviceToken: 1 },
                  );
                  userFromTokens.push(userFrm.deviceToken);
                }
                await swopRequests.update(
                  { _id: { $in: idss } },
                  { $set: { requestStatus: 3 } },
                  { multi: true },
                );
              }
            }
          }

          //same leaveTo
          const sameLeaveTos = await swopRequests.find({
            userTo: swopReq.userTo,
            leaveTo: swopReq.leaveTo,
            requestStatus: 1,
          });
          if (sameLeaveTos.length > 0) {
            let idss = [];
            for (
              let element = 0;
              element <= sameLeaveTos.length - 1;
              element++
            ) {
              idss.push(sameLeaveTos[element]._id);
              const userFrm = await User.findOne(
                { _id: swopReq.userFrom },
                { _id: 0, deviceToken: 1 },
              );
              userFromTokens.push(userFrm.deviceToken);
            }
            await swopRequests.update(
              { _id: { $in: idss } },
              { $set: { requestStatus: 3 } },
              { multi: true },
            );
          }
          res.status(201).json({
            success: true,
            data: swopReq,
            message: 'updated!.',
          });

          const user = await User.findOne(
            { _id: swopReq.userFrom },
            { _id: 0, deviceToken: 1 },
          );
          const userTo1 = await User.findOne(
            { _id: swopReq.userTo },
            { name: 1 },
          );
          let usersDeviceTokens = [];
          var dd = new Date();
          if (user && user.deviceToken) {
            console.log('USER: ', user);
            usersDeviceTokens.push(user.deviceToken);
            var collapseKey = swopReq._id;
            let notificationObj = {
              title: 'Leave Swap Request Accepted.',
              body:
                'Your leave swap request with ' +
                userTo1.name +
                ' is Accepted.',
              bodyText:
                'Your leave swap request with ' +
                userTo1.name +
                ' is Accepted.',
              bodyTime: dd,
              bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
            };
            FCM.push(usersDeviceTokens, notificationObj, collapseKey);
            console.log('sent');
          }
          if (userFromTokens.length > 0) {
            var collapseKey = swopReq._id;
            let notificationObj = {
              title: 'Leave Swap Request Rejected.',
              body:
                'Your leave swap request with ' +
                userTo1.name +
                ' is Rejected.',
              bodyText:
                'Your leave swap request with ' +
                userTo1.name +
                ' is Rejected.',
              bodyTime: dd,
              bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
            };
            FCM.push(userFromTokens, notificationObj, collapseKey);
          }
        } else {
          //Reject
          swopReq.requestStatus = 3;
          await swopReq.save();
          res.status(201).json({
            success: true,
            data: swopReq,
            message: 'updated!.',
          });
          const user = await User.findOne(
            { _id: swopReq.userFrom },
            { _id: 0, deviceToken: 1 },
          );
          const userTo = await User.findOne(
            { _id: swopReq.userTo },
            { name: 1 },
          );
          let usersDeviceTokens = [];
          var dd = new Date();
          if (user && user.deviceToken) {
            console.log('USER: ', user);
            usersDeviceTokens.push(user.deviceToken);
            var collapseKey = swopReq._id;
            let notificationObj = {
              title: 'Leave Swap Request Rejected.',
              body:
                'Your leave swap request with ' + userTo.name + ' is rejected.',
              bodyText:
                'Your leave swap request with ' + userTo.name + ' is rejected.',
              bodyTime: dd,
              bodyTimeFormat: ['DD-MMM-YYYY HH:mm'],
            };
            FCM.push(usersDeviceTokens, notificationObj, collapseKey);
            console.log('sent');
          }
        }
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getMyTeamMembers(req, res) {
    try {
      let reqObj = req.body;
      let users = [];
      let allUsers = [];
      let data = {};
      const opsGrp = await OpsGroup.findOne(
        { userId: req.user._id, isDelete: false },
        { userId: 1, swopSetup: 1, opsGroupName: 1 },
      ).populate([
        {
          path: 'opsTeamId',
          select: ['name', '_id', 'userId'],
        },
        {
          path: 'userId',
          select: ['_id', 'name', 'staffId'],
        },
      ]);
      if (!opsGrp) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find ops group data of you.",
        });
      } else {
        let swopsetup = parseInt(opsGrp.swopSetup);
        data.opsGroupId = opsGrp._id;
        data.opsName = opsGrp.opsGroupName;
        if (swopsetup == 0 || swopsetup == 1) {
          users = opsGrp.userId;
        } else {
          const opsTm = await OpsTeam.findOne(
            { userId: req.user._id, isDeleted: false },
            { userId: 1, name: 1 },
          ).populate([
            {
              path: 'userId',
              select: ['_id', 'name', 'staffId'],
            },
          ]);
          if (opsTm && opsTm.userId.length > 0) {
            users = opsTm.userId;
            data.opsTeamId = opsTm._id;
            data.opsTeamName = opsTm.name;
          } else {
            users = opsGrp.userId;
          }
        }
        var dateParts = reqObj.date.split('-');
        var dateObject = new Date(
          +dateParts[2],
          dateParts[1] - 1,
          +dateParts[0] + 1,
        );
        //Leaves data
        let userOnHoliday;
        userOnHoliday = await userLeaves
          .find({ userId: { $in: users } })
          .populate([
            {
              path: 'userId',
              select: 'name staffId',
              populate: {
                path: 'appointmentId',
                select: 'name',
              },
            },
          ]);

        //    let userOnHoliday= await userHoliday.find({opsGroupId:data.opsGroupId,opsTeamId: data.opsTeamId}).populate({path:"userId",select:"staffId"});
        userOnHoliday = userOnHoliday.reduce(function (
          accumulator,
          currentValue,
        ) {
          if (currentValue.todate) {
            var datePartsss = currentValue.fromdate.split('-');
            datePartsss =
              datePartsss[2] + '-' + datePartsss[1] + '-' + datePartsss[0];
            datePartsss = datePartsss.split('-');
            var dateParteee = currentValue.todate.split('-');
            dateParteee =
              dateParteee[2] + '-' + dateParteee[1] + '-' + dateParteee[0];
            dateParteee = dateParteee.split('-');
            let startdd = new Date(
              +datePartsss[2],
              datePartsss[1] - 1,
              +datePartsss[0] + 1,
            );
            let enddd = new Date(
              +dateParteee[2],
              dateParteee[1] - 1,
              +dateParteee[0] + 1,
            );
            if (dateObject <= enddd && dateObject >= startdd) {
              console.log('Motha if');
              accumulator.push(currentValue);
            }
            // if(currentValue.fromdate == data.date || currentValue.todate == data.date){
            //     accumulator.push(currentValue);
            // }
          } else {
            if (currentValue.fromdate == data.date) {
              console.log('else cha if');
              accumulator.push(currentValue);
            }
          }
          return accumulator;
        },
        []);
        userOnHoliday = userOnHoliday.filter((uu) => uu.status !== 'cancelled');
        allUsers = allUsers.concat(userOnHoliday);
        var Users = [];
        var appointments = [];
        for (let k = 0; k <= allUsers.length - 1; k++) {
          var user = {};
          user.leaveId = allUsers[k]._id;
          user._id = allUsers[k].userId._id;
          user.appointmentId = allUsers[k].userId.appointmentId;
          user.name = allUsers[k].userId.name;
          user.staffId = allUsers[k].userId.staffId;
          Users.push(user);
          appointments.push(user.appointmentId);
        }
        var jsonObject = appointments.map(JSON.stringify);
        var uniqueSet = new Set(jsonObject);
        var uniqueArray = Array.from(uniqueSet).map(JSON.parse);
        return res.status(201).json({
          success: true,
          data: { users: Users, appointment: uniqueArray },
          message: 'Received!.',
        });
      }
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: 'Something went Wrong!.',
      });
    }
  }
  async getLeaveDetails(req, res) {
    try {
      let reqObject = req.body;
      const ops = await OpsGroup.findOne(
        { userId: req.body.userId, isDelete: false },
        { _id: 1, opsGroupName: 1 },
      );
      const user = await User.findOne(
        { _id: req.body.userId },
        {
          _id: 0,
          parentBussinessUnitId: 1,
          name: 1,
          staffId: 1,
          email: 1,
          profilePicture: 1,
          contactNumber: 1,
        },
      ).populate([
        {
          path: 'parentBussinessUnitId',
          select: 'name',
          populate: {
            path: 'sectionId',
            select: 'name',
            populate: {
              path: 'departmentId',
              select: 'name',
              populate: {
                path: 'companyId',
                select: 'name',
              },
            },
          },
        },
        {
          path: 'appointmentId',
          select: 'name',
        },
      ]);
      let BU =
        user.parentBussinessUnitId.sectionId.departmentId.companyId.name +
        ' > ' +
        user.parentBussinessUnitId.sectionId.departmentId.name +
        ' > ' +
        user.parentBussinessUnitId.sectionId.name +
        ' > ' +
        user.parentBussinessUnitId.name;

      const leave = await userLeaves.findOne(
        { _id: reqObject.leaveId },
        { fromdate: 1, todate: 1, type: 1 },
      );
      if (!leave) {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find leave for this user.",
        });
      } else {
        let useResponse = {};
        (useResponse.Bu = BU), (useResponse.opsName = ops.opsGroupName);
        useResponse.form = leave.fromdate;
        useResponse.To = leave.todate;
        useResponse.contactNumber = user.contactNumber;
        useResponse.profilePicture = user.profilePicture;
        useResponse.email = user.email;
        useResponse.staffId = user.staffId;
        useResponse.name = user.name;
        useResponse.appointment = user.appointmentId.name;
        if (leave.type == 1) {
          useResponse.type = 'Block-Balloted';
        }
        if (leave.type == 2) {
          useResponse.type = 'Casual Leave';
        }
        if (leave.type == 3) {
          useResponse.type = 'Block-Allocated';
        }
        if (leave.type == 4) {
          useResponse.type = 'Special Leave';
        }
        return res.status(201).json({
          success: true,
          data: useResponse,
          message: 'data received!.',
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async getSwapLogs(req, res) {
    try {
      let reqdata = req.body;
      if (reqdata.ballotId) {
        // const ballot = await Ballot.findOne({_id:reqdata.ballotId},{weekRange:1});
        const ballot = await Ballot.findOne({ _id: reqdata.ballotId });
        var ballotList = [];
        if (ballot.parentBallot) {
          ballotList = await this.checkIfHasParent(res, ballot._id);
        }
        if (ballot.childBallots && ballot.childBallots.length > 0) {
          ballotList.push(ballot._id);
          ballotList = ballotList.concat(ballot.childBallots);
        }
        if (!ballot.parentBallot && !ballot.childBallots.length > 0) {
          ballotList.push(ballot._id);
        }
        const swapRequests1 = await swopRequests
          .find({
            ballotId: { $in: ballotList },
            $or: [
              {
                $and: [
                  { userFrom: reqdata.userId },
                  { slotNumberTo: reqdata.weekNo },
                ],
              },
              {
                $and: [
                  { userTo: reqdata.userId },
                  { slotNumberFrom: reqdata.weekNo },
                ],
              },
            ],
            requestStatus: 2,
          })
          .populate([
            {
              path: 'userTo',
              select: 'name staffId',
            },
            {
              path: 'opsGroupId',
              select: 'opsGroupName opsTeamId',
            },
            {
              path: 'userFrom',
              select: 'name staffId',
            },
            {
              path: 'ballotId',
              select: 'ballotName',
            },
          ]);
        let swapRequests = JSON.stringify(swapRequests1);
        swapRequests = JSON.parse(swapRequests);
        let resdata = [];
        for (let i = 0; i <= swapRequests.length - 1; i++) {
          console.log('in here');
          if (
            swapRequests[i].userFrom._id.toString() == reqdata.userId.toString()
          ) {
            console.log('in first if');
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userTo._id, isDeleted: false },
                { name: 1 },
              );
              swapRequests[i].teamName = Tm.name;
            }
            swapRequests[i].status = 'Sent';
            let start =
              ballot.weekRange[swapRequests[i].slotNumberFrom].start.split('-');
            swapRequests[i].formdate =
              start[2] + '-' + start[1] + '-' + start[0];
            let end =
              ballot.weekRange[swapRequests[i].slotNumberFrom].end.split('-');
            swapRequests[i].todate = end[2] + '-' + end[1] + '-' + end[0];
          }
          if (
            swapRequests[i].userTo._id.toString() == reqdata.userId.toString()
          ) {
            console.log('in second if');
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userFrom._id, isDeleted: false },
                { name: 1 },
              );
              swapRequests[i].teamName = Tm.name;
            }
            swapRequests[i].status = 'Received';
            let start =
              ballot.weekRange[swapRequests[i].slotNumberTo].start.split('-');
            swapRequests[i].formdate =
              start[2] + '-' + start[1] + '-' + start[0];
            let end =
              ballot.weekRange[swapRequests[i].slotNumberTo].end.split('-');
            swapRequests[i].todate = end[2] + '-' + end[1] + '-' + end[0];
          }
          console.log('pushing the data');
          resdata.push(swapRequests[i]);
        }
        res
          .status(201)
          .json({ status: true, data: resdata, message: 'Received!' });
      } else {
        console.log('IN ELSE');

        const swapRequests1 = await swopRequests
          .find({
            $or: [
              {
                $and: [
                  { userFrom: reqdata.userId },
                  { leaveTo: reqdata.leaveId },
                ],
              },
              {
                $and: [
                  { userTo: reqdata.userId },
                  { leaveFrom: reqdata.leaveId },
                ],
              },
            ],
            requestStatus: 2,
          })
          .populate([
            {
              path: 'userTo',
              select: 'name staffId',
            },
            {
              path: 'opsGroupId',
              select: 'opsGroupName opsTeamId',
            },
            {
              path: 'userFrom',
              select: 'name staffId',
            },
            {
              path: 'leaveTo',
              select: 'fromdate todate type',
            },
            {
              path: 'leaveFrom',
              select: 'fromdate todate type',
            },
          ]);
        let swapRequests = JSON.stringify(swapRequests1);
        swapRequests = JSON.parse(swapRequests);
        let resdata = [];
        for (let i = 0; i <= swapRequests.length - 1; i++) {
          console.log('in here');
          if (
            swapRequests[i].userFrom._id.toString() == reqdata.userId.toString()
          ) {
            console.log('in first if');
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userTo._id, isDeleted: false },
                { name: 1 },
              );
              swapRequests[i].teamName = Tm.name;
            }
            swapRequests[i].status = 'Sent';
            swapRequests[i].formdate = swapRequests[i].leaveFrom.fromdate;
            swapRequests[i].todate = swapRequests[i].leaveFrom.todate;
            swapRequests[i].type = swapRequests[i].leaveFrom.type;
          }
          if (
            swapRequests[i].userTo._id.toString() == reqdata.userId.toString()
          ) {
            console.log('in second if');
            if (swapRequests[i].opsGroupId.opsTeamId.length > 0) {
              const Tm = await OpsTeam.findOne(
                { userId: swapRequests[i].userFrom._id, isDeleted: false },
                { name: 1 },
              );
              swapRequests[i].teamName = Tm.name;
            }
            swapRequests[i].status = 'Received';
            swapRequests[i].formdate = swapRequests[i].leaveTo.fromdate;
            swapRequests[i].todate = swapRequests[i].leaveTo.todate;
            swapRequests[i].type = swapRequests[i].leaveTo.type;
          }
          console.log('pushing the data');
          resdata.push(swapRequests[i]);
        }
        res
          .status(201)
          .json({ status: true, data: swapRequests, message: 'Received!' });
      }
    } catch (e) {
      res
        .status(203)
        .json({ status: false, data: null, message: 'something went wrong!' });
    }
  }
  async getMySentSwapRequests(req, res) {
    try {
      let reqdata = req.body;
      const swapRequests = await swopRequests
        .find({
          userFrom: reqdata.userId,
          leaveFrom: reqdata.leaveId,
          requestStatus: 1,
        })
        .populate([
          { path: 'userTo', select: 'name staffId' },
          { path: 'opsGroupId', select: 'opsGroupName' },
          { path: 'leaveFrom', select: 'fromdate todate type status' },
          { path: 'leaveTo', select: 'fromdate todate type status' },
        ]);
      console.log('Wop requests: ', swapRequests);
      let resdata = [];
      if (swapRequests.length > 0) {
        for (let i = 0; i <= swapRequests.length - 1; i++) {
          var startslotdate = swapRequests[i].leaveFrom.fromdate;
          var endslotdate = swapRequests[i].leaveFrom.todate;
          let slotDates = { start: startslotdate, end: endslotdate };
          const user = await User.findOne(
            { _id: swapRequests[i].userTo._id },
            { _id: 0, parentBussinessUnitId: 1 },
          ).populate({
            path: 'parentBussinessUnitId',
            select: 'name',
            populate: {
              path: 'sectionId',
              select: 'name',
              populate: {
                path: 'departmentId',
                select: 'name',
                populate: {
                  path: 'companyId',
                  select: 'name',
                },
              },
            },
          });
          let BU =
            user.parentBussinessUnitId.sectionId.departmentId.companyId.name +
            ' > ' +
            user.parentBussinessUnitId.sectionId.departmentId.name +
            ' > ' +
            user.parentBussinessUnitId.sectionId.name +
            ' > ' +
            user.parentBussinessUnitId.name;
          let data = {};
          data.Bu = BU;
          data.opsName = swapRequests[i].opsGroupId.opsGroupName;
          data.opsGroupId = swapRequests[i].opsGroupId._id;
          if (swapRequests[i].leaveFrom.type == 1) {
            data.type = 'Block-Balloted';
          }
          if (swapRequests[i].leaveFrom.type == 3) {
            data.type = 'Block-Allocated';
          }
          if (swapRequests[i].leaveFrom.type == 2) {
            data.type = 'Casual';
          }
          if (swapRequests[i].leaveFrom.type == 4) {
            data.type = 'Special';
          }
          // var datePartsss = swapRequests[i].leaveTo.fromdate.split("-");
          // var dateParteee = swapRequests[i].leaveTo.todate.split("-");
          let startdd = new Date(swapRequests[i].leaveTo.fromdate);
          let enddd = new Date(swapRequests[i].leaveTo.todate);
          var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
          days = days + 1;
          var daysAsLeaves = await noOfDays(res, days);
          //  if(days % 7==0){
          //     var n = days/7;
          //     n = n*2;
          //     days = days-n;
          // }
          data.leavedays = daysAsLeaves;
          //data.slotNoFor = reqdata.slotNo;
          data.leaveId = reqdata.leaveId;

          var Toslotdate = swapRequests[i].leaveTo.fromdate;
          var Toendslotdate = swapRequests[i].leaveTo.todate;
          data.currentdates = slotDates;
          // data.currentdates= {start:swapRequests[i].leaveFrom.fromdate,end:swapRequests[i].leaveFrom.todate};
          data.slotToExchange = { start: Toslotdate, end: Toendslotdate };
          data.users = swapRequests[i].userTo;
          // data.ballotId=reqdata.ballotId;
          data.swapRequestId = swapRequests[i]._id;
          data.requestStatus = swapRequests[i].requestStatus;
          resdata.push(data);
        }
        return res.status(201).json({
          success: true,
          data: resdata,
          message: 'received!',
        });
      } else {
        return res.status(300).json({
          success: false,
          data: null,
          message: "Couldn't find swap requests for this slot.",
        });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
  async cancelMySwopRequest(req, res) {
    try {
      let swopId = req.params.id;
      let updated = await swopRequests.update(
        { _id: swopId },
        { $set: { requestStatus: 4 } },
      );
      if (updated) {
        res.status(201).json({
          status: true,
          data: updated,
          message: 'Successfully updated.',
        });
      } else {
        res
          .status(203)
          .json({
            status: false,
            data: null,
            message: "couldn't update values",
          });
      }
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
async function noOfDays(res, totaldays) {
  try {
    let pageSettingData = await PageSettingModel.findOne({
      companyId: '5a9d162b36ab4f444b4271c8',
      status: 1,
    })
      .select('opsGroup')
      .lean();

    var configurationNumber = 2;
    if (pageSettingData.opsGroup.blockLeaveConfiguration == 1) {
      configurationNumber = 2;
    }
    if (pageSettingData.opsGroup.blockLeaveConfiguration == 2) {
      configurationNumber = 1;
    }
    if (pageSettingData.opsGroup.blockLeaveConfiguration == 3) {
      configurationNumber = 0;
    }
    let daysToDeduct = totaldays;
    if (daysToDeduct % 7 == 0) {
      var n = daysToDeduct / 7;
      n = n * configurationNumber;
      daysToDeduct = daysToDeduct - n;
    }
    if (daysToDeduct > 0 && daysToDeduct < 7) {
      if (daysToDeduct == 6) {
        console.log('AT HHHHHH');
        daysToDeduct = 5;
      } else {
        daysToDeduct = daysToDeduct - configurationNumber * 0;
      }
    }
    if (daysToDeduct > 7 && daysToDeduct < 14) {
      daysToDeduct = daysToDeduct - configurationNumber * 1;
    }
    if (daysToDeduct > 14 && daysToDeduct < 21) {
      daysToDeduct = daysToDeduct - configurationNumber * 2;
    }
    if (daysToDeduct > 21 && daysToDeduct < 28) {
      daysToDeduct = daysToDeduct - configurationNumber * 3;
    }

    return daysToDeduct;
  } catch (err) {
    __.log(err);
    return __.out(res, 500);
  }
}

async function autoTerminateSwapRequest() {
  console.log('in auto cancel request');
  const todayIs = new Date();
  let weeksToApply = 1;
  let pageSettingData = await PageSettingModel.findOne({
    companyId: '5a9d162b36ab4f444b4271c8',
    status: 1,
  })
    .select('opsGroup')
    .lean();
  if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
    weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
    console.log('pagesettngs weeks are: ', weeksToApply);
  }
  let totaldays = weeksToApply * 7;
  const swapList = await swopRequests.find({
    requestStatus: 1,
  });
  if (swapList.length > 0) {
    for (let i = 0; i <= swapList.length - 1; i++) {
      console.log(' ');
      const leaveTo = await userLeaves.findOne(
        { _id: swapList[i].leaveTo },
        { fromdate: 1 },
      );
      //var leaveStart = leaveTo.fromdate.split("-");
      var leaveStart = new Date(leaveTo.fromdate);
      var daysleft = Math.floor((leaveStart - todayIs) / (1000 * 60 * 60 * 24));
      console.log('daysleft 1: ', daysleft);
      daysleft = daysleft + 1;
      console.log('daysleft 2: ', daysleft);
      console.log('startdate', startdate);
      if (daysleft < 0 || daysleft < totaldays) {
        let updated = await swopRequests.update(
          { _id: swapList[i]._id },
          { $set: { requestStatus: 5 } },
        );
      }
    }
  }
}

let methods = {};
methods.autoTerminateSwapRequest = async function () {
  console.log('in auto cancel request');
  const todayIs = new Date();
  let weeksToApply = 1;
  let pageSettingData = await PageSettingModel.findOne({
    companyId: '5a9d162b36ab4f444b4271c8',
    status: 1,
  })
    .select('opsGroup')
    .lean();
  if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
    weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
    console.log('pagesettngs weeks are: ', weeksToApply);
  }
  let totaldays = weeksToApply * 7;
  const swapList = await swopRequests.find({
    requestStatus: 1,
  });
  if (swapList.length > 0) {
    for (let i = 0; i <= swapList.length - 1; i++) {
      console.log(' ');
      const leaveTo = await userLeaves.findOne(
        { _id: swapList[i].leaveTo },
        { fromdate: 1 },
      );
      //var leaveStart = leaveTo.fromdate.split("-");
      var leaveStart = new Date(leaveTo.fromdate);
      var daysleft = Math.floor((leaveStart - todayIs) / (1000 * 60 * 60 * 24));
      daysleft = daysleft + 1;
      if (daysleft < 0 || daysleft < totaldays) {
        let updated = await swopRequests.update(
          { _id: swapList[i]._id },
          { $set: { requestStatus: 5 } },
        );
      }
    }
  }
};
new CronJob({
  cronTime: '0 18 * * *',
  onTick: function () {
    console.log('yuup');
    autoTerminateSwapRequest();
    //Your code that is to be executed on every midnight
  },
  start: true,
  runOnInit: false,
});

const opsleave = new opsLeave();
module.exports = opsleave;
module.exports.myMethod = methods;
