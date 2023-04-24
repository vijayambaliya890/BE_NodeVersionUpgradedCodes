// Controller Code Starts here
const mongoose = require("mongoose");
const StaffSapData = require("../../models/staffSAPData");
const Ballot = require("../../models/ballot");
const OpsGroup = require("../../models/ops");
const OpsTeam = require("../../models/opsTeam");
const User = require("../../models/user");
const PageSettingModel = require("../../models/pageSetting");
const _ = require("lodash");
const __ = require("../../../helpers/globalFunctions");
var multiparty = require("multiparty");
const async = require("async");
const moment = require("moment");
const FCM = require("../../../helpers/fcm");
const csv = require("csvtojson");
const swopRequests = require("../../models/swapRequests");
const userHoliday = require("../../models/userHoliday");
const leaveApplications = require("../../models/leaveApplication");
const userLeaves = require("../../models/userLeaves");
const leaveType = require("../../models/leaveType");
const staffLeave = require("../../models/staffLeave");
const LeaveApplied = require("../../models/leaveApplied");
const LeaveType = require("../../models/leaveType");
const LeaveGroup = require("../../models/leaveGroup");
const RATIO = 1
const { agendaNormal } = require('../../../helpers/agendaInit');
const AgendaJobs = require('../../models/agenda');
const { logInfo, logError } = require('../../../helpers/logger.helper');
class ballot {
  async ballotEvent(data, from, isUpdate = false) {
    try {
      logInfo('ballotEvent called',{data, from, isUpdate})
      if (isUpdate) {
        const deletedJob = await AgendaJobs.deleteMany({ 'data.ballotId': data._id });
        logInfo('ballotEvent jobs deleted',{deletedJob})
      }
      // notification 2 days before
      const obj = {
        ballotId: data._id,
        type: 'notificationBefore2Days',
      };
      const applicationCloseDate = new Date(data.applicationCloseDateTime);
      // applicationCloseDate.setHours(0, 0, 0, 0);
      const twoDayBeforeDate = moment(applicationCloseDate).add(-2, 'd').toDate();
      const oneDayBeforeDate = moment(applicationCloseDate).add(-1, 'd').toDate();
      // notification 1 day before
      // notification on day
      const job2 = await agendaNormal.schedule(
        twoDayBeforeDate,
        'eventHandler',
        obj,
      );
      obj.type = 'notificationBefore1Day';
  
      const job1 = await agendaNormal.schedule(
        oneDayBeforeDate,
        'eventHandler',
        obj,
      );
      obj.type = 'notificationOnDay';
      const job = await agendaNormal.schedule(
        applicationCloseDate,
        'eventHandler',
        obj,
      );
  
      obj.type = 'conductBallot';
      const conductTime = moment(applicationCloseDate).add(15, 'm').toDate();
  
      const conduct = await agendaNormal.schedule(
        conductTime,
        'eventHandler',
        obj,
      );

      obj.type = 'publishBallot';
      const publishBallot = moment(data.applicationOpenDateTime).toDate();
  
      const publish = await agendaNormal.schedule(
        publishBallot,
        'eventHandler',
        obj,
      );
      if (data.resultRelease === 1) {
        obj.type = 'resultRelease';
        const resultRelease = moment(data.resultReleaseDateTime).toDate();
        const result = await agendaNormal.schedule(
          resultRelease,
          'eventHandler',
          obj,
        );
      }
      return true;
    } catch (e) {
      logError('create cron has error', e.stack);
      logError('create cron has error', e);
      return false;
    }
  }

  async deleteEvent(id){
    try{
      logInfo('deleteEvent called',{id})
      const job = await AgendaJobs.updateMany({ 'data.ballotId': id }, {
        $set: { nextRunAt: null, 'data.isRemoved': true, 'data.removedAt': new Date() },
      });
      return true;
    }catch(e){
      return false;
    }
  }

  async conductBallot(req, res) {
    try {
      console.log("CONDUCT BALLOT HERE......");
      const ballotId = "5f9f7361b164f269c0a72e53";
      //console.logs('ballotId', ballotId)
      let ballotResult = await Ballot.findOne({
        _id: ballotId,
      }); //isConduct: false
      if (ballotResult) {
        // result for BU
        let totalDeducated = 5;
        if (ballotResult.leaveConfiguration === 2) {
          totalDeducated = 6;
        } else if (ballotResult.leaveConfiguration === 3) {
          totalDeducated = 7;
        }
        if (ballotResult.leaveType == 2) {
          totalDeducated = 1;
        }
        console.log("ballotResult", ballotResult.ballotName);
        if (ballotResult.userFrom === 2) {
          ballotResult = JSON.stringify(ballotResult);
          ballotResult = JSON.parse(ballotResult);
          ////console.logs('ballotResult', ballotResult);
          let shuffle = [];
          shuffle = ballotResult.slotCreation;
          ballotResult.appliedStaff.forEach((appliedStaff) => {
            const indexOfBu = ballotResult.slotCreation.findIndex((x) => x.buId === appliedStaff.buId);
            if (shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
            } else {
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
            }
          });
          let finalWinStaff = [];
          shuffle.forEach((staffShuffle) => {
            staffShuffle.arr.forEach((slotWise) => {
              const howMuchWin = slotWise.value;

              if (slotWise.appliedStaff && slotWise.appliedStaff.length <= howMuchWin) {
                finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
              } else if (slotWise.appliedStaff) {
                const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                randomStaff.forEach((randomSelectedStaff) => {
                  finalWinStaff.push(slotWise.appliedStaff[randomSelectedStaff]);
                });
                //console.logs('slotWise.appliedStaff.length', slotWise.appliedStaff.length, howMuchWin, randomStaff)
              }
            });
          });
          const updateWin = await Ballot.findOneAndUpdate(
            { _id: ballotId },
            {
              $set: {
                wonStaff: finalWinStaff,
                isConduct: true,
                isResultRelease: false,
              },
            }
          );
          insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
          unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
        } else {
          // for ops group
          ballotResult = JSON.stringify(ballotResult);
          ballotResult = JSON.parse(ballotResult);
          ////console.logs('ballotResult', ballotResult);
          let shuffle = [];

          const opsGroupQuota = [];
          shuffle = ballotResult.slotCreation;
          let appliedStaffArray = [];
          for (let i = 0; i < ballotResult.slotCreation.length; i++) {
            const opsGroupSlot = ballotResult.slotCreation[i];
            // get quato for ops group
            // get quato for team
            let slotValue = {
              opsGroupId: opsGroupSlot.opsGroup.opsId,
              slotQuota: [],
            };
            opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
              ////console.logs('aaaaaaaa');
              let key = "" + arrIndex + "A";
              let slotNumber = arrIndex;
              let slotOpsGroupValue = parseInt(opsGroupSlot.weekRangeSlot[key].value);
              //opsGroupQuato.push({value:opsGroupSlot.weekRangeSlot[key].value, key});
              const teamValue = [];
              let totalTeamQuota = 0;
              opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
                ////console.logs('aaaaaaaa');
                let key = 'OG' + arrIndex + 'OT' + teamIndex;
                totalTeamQuota = totalTeamQuota + parseInt(opsGroupSlot.weekRangeSlot[key].value);
                teamValue.push(parseInt(opsGroupSlot.weekRangeSlot[key].value));
              });
              const obj = {
                slot: slotNumber,
                opsGroupQuotaValue: slotOpsGroupValue,
                opsTeamQuotaValue: teamValue,
                totalTeamQuota,
              };
              slotValue.slotQuota.push(obj);
            });
            ////console.logs('aauued', slotValue)
            opsGroupQuota.push(slotValue);
            ////console.logs('yyegwb');
            ////console.logs('aaaa', groupBy(ballotResult.appliedStaff,'weekNo'));
            let appliedStaffObject = {};
            appliedStaffObject = groupBy(ballotResult.appliedStaff, "opsTeamId");
            ////console.logs('appliedStaffObject', appliedStaffObject)
            //return res.send(ballotResult.appliedStaff)
            /* for(let keyyy in appliedStaffObject){
                           const ayaya = groupBy(appliedStaffObject[keyyy],'weekNo');
                           appliedStaffArray.push(ayaya);
                       }*/
            const opsGroupSlotWithTeam = {
              opsGroupId: opsGroupSlot.opsGroup.opsId,
              opsTeamValue: [],
            };
            //console.logs('yyegwbaaa',opsGroupSlot.opsTeam);
            if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
              opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
                if (appliedStaffObject[teamItem._id]) {
                  const ayaya = groupBy(appliedStaffObject[teamItem._id], "weekNo");
                  opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
                } else {
                  opsGroupSlotWithTeam.opsTeamValue.push({});
                }
              });
            } else {
              //console.logs('no temmmm',appliedStaffObject);
              if (isEmpty(appliedStaffObject)) {
                // Object is empty (Would return true in this example)
                //console.logs("do nothing obect is empty");
              } else {
                // Object is NOT empty
                if (appliedStaffObject["undefined"]) {
                  const staffAyaya = appliedStaffObject["undefined"].filter((sta) => {
                    return sta.opsGroupId.toString() === opsGroupSlot.opsGroup.opsId.toString();
                  });
                  appliedStaffObject["undefined"] = [];
                  appliedStaffObject["undefined"] = staffAyaya;
                  const ayaya = groupBy(appliedStaffObject["undefined"], "weekNo");
                  opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
                }
                //console.logs("please check here");
              }
            }
            ////console.logs('hgfgetgt')
            appliedStaffArray.push(opsGroupSlotWithTeam);
            /*groupBy(ballotResult.appliedStaff, function(item)
                      {
                          return [item.weekNo, item.opsTeamId];
                      });*/
          }
          function isEmpty(obj) {
            for (var key in obj) {
              if (obj.hasOwnProperty(key)) return false;
            }
            return true;
          }
          ////console.logs('aaaaaaaa');
          function groupBy(xs, key) {
            return xs.reduce(function (rv, x) {
              (rv[x[key]] = rv[x[key]] || []).push(x);
              return rv;
            }, {});
          }

          //return res.json({ opsGroupQuota, appliedStaffArray })
          let limitQuota = [];
          let finalWinStaff = [];
          console.log("aaaaaaaa");
          opsGroupQuota.forEach((item, topIndex) => {
            ////console.logs('aaa')
            let objA = {
              opsGroupId: item.opsGroupId,
            };
            item.slotQuota.forEach((slll) => {
              objA.slot = slll.slot;
              if (slll.opsTeamQuotaValue.length === 0) {
                objA.isTeamPresent = false;
                objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
                // //console.logs('callleddd');
                if (appliedStaffArray[topIndex].opsTeamValue[0] && appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]) {
                  if (slll.opsGroupQuotaValue >= appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length) {
                    finalWinStaff = finalWinStaff.concat(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]);
                  } else {
                    const randomStaff = getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length, slll.opsGroupQuotaValue);
                    randomStaff.forEach((ppp) => {
                      finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot][ppp]);
                    });
                  }
                }

                // const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
              } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
                // all team quota should win
                slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                  if (
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                  ) {
                    console.log("bbb");
                    const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length;
                    //console.logs('len', len, slll.slot, p);
                    // p means no of win
                    // len means no of applied
                    if (len > p) {
                      const randomStaff = getRandomNumber(len, p);
                      //console.logs('randomStaff', randomStaff);
                      randomStaff.forEach((randomSelectedStaff) => {
                        finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][randomSelectedStaff]);
                      });
                    } else {
                      for (let x = 0; x < len; x++) {
                        finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][x]);
                      }
                    }
                  }
                  //const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                });
              } else {
                // if ops group quota value is less then total team quota
                let allAppliedStaff = [];
                slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                  ////console.logs('topIndexppppppp', topIndex, opsTeamQuotaValueIndex);
                  if (
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                  ) {
                    //console.logs('aaaaeee');
                    if (p >= appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length) {
                      // //console.logs('hh', appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot])
                      allAppliedStaff = allAppliedStaff.concat(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]);
                    } else {
                      //console.logs('thiselseworkssss')
                      const randomStaff = getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length, p);
                      randomStaff.forEach((ppp) => {
                        allAppliedStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][ppp]);
                      });
                    }
                    /*       //console.logs('bbb');
                                      const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot].length;
                                      //console.logs('len', len, slll.slot, p);
                                      // p means no of win
                                      // len means no of applied
                                      if(len>p) {
                                          const randomStaff = getRandomNumber(len, p);
                                          //console.logs('randomStaff', randomStaff);
                                          randomStaff.forEach((randomSelectedStaff)=>{
                                              finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][randomSelectedStaff])
                                          });
                                      }else {
                                          for(let x=0; x<len; x++){
                                              finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][x]);
                                          }
                                      }*/
                  }

                  //const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                });
                if (allAppliedStaff.length > 0) {
                  //console.logs('ahugwgg')
                  const finalAppliedStaff = [];
                  const randomStaff = getRandomNumber(allAppliedStaff.length, allAppliedStaff.length);
                  //console.logs('randomStaff', randomStaff, allAppliedStaff.length);
                  randomStaff.forEach((ppp) => {
                    finalAppliedStaff.push(allAppliedStaff[ppp]);
                  });
                  const finalRandomStaff = getRandomNumber(allAppliedStaff.length, slll.opsGroupQuotaValue);
                  //console.logs('finalRandomStaff', finalRandomStaff)
                  //console.logs('sdhfys', allAppliedStaff.length, finalRandomStaff, slll.opsGroupQuotaValue);
                  finalRandomStaff.forEach((ppp) => {
                    finalWinStaff.push(finalAppliedStaff[ppp]);
                  });
                }
              }
            });
          });
          //return res.json({ finalWinStaff })
          console.log("finalWinStaff", finalWinStaff);
          const updateWin = await Ballot.findOneAndUpdate(
            { _id: ballotId },
            {
              $set: {
                wonStaff: finalWinStaff,
                isConduct: true,
                isResultRelease: false,
              },
            }
          );
          return res.json({ finalWinStaff })
          //insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
          //  unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
        }
      } else {
        console.log("not found");
      }
    } catch (e) {
      console.log("éee", e);
    }
  }
  async formatData(data) {
    function genrows(groups, groupKey) {
      return _.toPairs(groups).map(([key, data]) => ({
        [groupKey]: key,
        data,
      }));
    }

    function gengroups(arr, iteratee, key) {
      const grouped = _.groupBy(arr, iteratee);
      return genrows(grouped, key);
    }

    function grouparray(data, props) {
      let result = [{ data }];

      props.map((prop, i) => {
        let k11 = "";
        if (i === 0) {
          k11 = "opsGroupId";
        } else {
          k11 = "opsTeamId";
        }
        const key = prop.key || k11;
        const iteratee = prop.iteratee || prop;

        result = _.flatten(
          result.map((row) => {
            return gengroups(row.data, iteratee, key).map((group) =>
              Object.assign({}, row, {
                [key]: group[key],
                data: group.data,
              })
            );
          })
        );
      });

      return _.flatten(result);
    }
    const result = grouparray(data.data, ["opsG", "opsT"]);
    return result;
  }
  async checkDateIsOverlapping() {

  }
  async autoResultRelease(req, res) {
    //return res.json('hi');

    const staffData = req.body.data;
    const ballotId = req.body.ballotId;
    const userFrom = req.body.userFrom;
    //console.log("ballotId", ballotId);
    // const ratio = 2;// req.body.ratio;
    // for OPS group
    const userData = [];
    staffData.forEach((staff) => {
      delete staff.deepClone;
      userData.push(staff);
    });
    //return res.json({userData})
    if (userFrom === 1) {
      //const result = await this.formatData(data);
      const ballotData = await Ballot.findById({ _id: ballotId });

      //return res.json({})
      let reaminSlot = [];
      let slotWiseStaff = [];
      let finalWonStaff = [];
      let allBallotId = [];
      allBallotId.push(ballotId)
      let totalslotRemain = 0;
      // let resultFilter;
      if (ballotData) {
        //console.log("I amhere 1");

        //console.log("I amhere 5", ballotData.isConduct);
        console.log("ballotData.isConduct", ballotData.isConduct);
        if (ballotData.isConduct) {
          return res.json({ message: "Already Conduct" });
        }
        let parentBallotWon = [];
        let parentBallotData1;
        let parentBallotData;
        let idd;
        const ballotYear = new Date(ballotData.weekRange[0].end).getFullYear()
        //console.log("aaaaaa");
        for (let ij = 0; ij < ballotData.ballotRound; ij++) {
          if (ij == 0) {
            idd = ballotData.parentBallot;
          } else {
            idd = parentBallotData1.parentBallot;
          }
          allBallotId.push(idd)
          parentBallotData1 = await Ballot.findById({ _id: idd });
          if (ij == 0) {
            parentBallotData = parentBallotData1;
          }
          const parentBallotWon1 = JSON.parse(JSON.stringify(parentBallotData1.wonStaff));
          parentBallotWon = parentBallotWon.concat(parentBallotWon1);
        }
        const checkSlot = 5;
        // return res.json({ len: parentBallotWon.length, parentBallotWon });
        for (let i = 0; i < ballotData.slotCreation.length; i++) {
          console.log("heheh");
          const slotData = ballotData.slotCreation[i];
          /* // if team present in slot ops group
                      if(slotData.opsTeam && slotData.opsTeam.length>0){
                          slotData.opsTeam.forEach((opsTeamIdF)=>{
                             const resultFilter = result.filter((opt)=>{
                                return opt.opsTeamId == opsTeamIdF._id;
                             });

                          });*/
          // console.log("slotData.opsGroup.opsId", slotData.opsGroup.opsId, staffData);
          let resultFilter = staffData.filter((opt) => {
            return opt.opsG == slotData.opsGroup.opsId;
          });
          if (resultFilter.length > 0) {
            function shuffle(array) {
              return array.sort(() => Math.random() - 0.5);
            }

            resultFilter = shuffle(resultFilter);
            const oldBallotStaffWon = [];
            const oldBallotWon = await Ballot.find({ opsGroupId: slotData.opsGroup.opsId, isConduct: true, _id: { $nin: allBallotId } });
            for (let oldIndex = 0; oldIndex < oldBallotWon.length; oldIndex++) {
              const oldBallot = oldBallotWon[oldIndex]
              if (ballotYear === new Date(oldBallot.weekRange[0].end).getFullYear() && oldBallot.wonStaff.length > 0) {
                for (let wonSIndex = 0; wonSIndex < oldBallot.wonStaff.length; wonSIndex++) {
                  let wonSStaff = oldBallot.wonStaff[wonSIndex]
                  const wonObj = {
                    userId: wonSStaff.userId,
                    startDate: new Date(oldBallot.weekRange[wonSStaff.weekNo].start).getTime(),
                    endDate: new Date(oldBallot.weekRange[wonSStaff.weekNo].end).getTime(),
                    opsTeamId: wonSStaff.opsTeamId,
                    opsGroupId: wonSStaff.opsGroupId
                  }
                  oldBallotStaffWon.push(wonObj)
                }
              }
            }
            //return res.json({ oldBallotStaffWon })
            const wonStaffForOpsGroup = ballotData.wonStaff.filter((win) => {
              return win.opsGroupId == slotData.opsGroup.opsId;
            });
            for (let j = 0; j < ballotData.weekRange.length; j++) {
              // console.log("iiiii", j);
              let opsGroupQuota = Math.round(parseInt(slotData.weekRangeSlot[j + "A"].balanceToBeAssigned));
              const wonStaffList = wonStaffForOpsGroup.filter((win) => {
                return win.weekNo == j;
              });
              const wonStaffCount = wonStaffList.length;
              //console.log("wonStaffCount with team", wonStaffCount);
              // check if team is present or not
              let totalTeamQuota = -1;
              let teamStatus = [];
              if (slotData.opsTeam && slotData.opsTeam.length > 0) {
                totalTeamQuota = 0;
                teamStatus = [];
                slotData.opsTeam.forEach((te, index) => {
                  let teamQuota = parseInt(slotData.weekRangeSlot['OG' + j +'OT'+ index].balanceToBeAssigned);
                  totalTeamQuota += teamQuota;
                  // get count of staff win this lot for ops team
                  const winStaffOpsTeam = wonStaffList.filter((ax) => {
                    return ax.opsTeamId == te._id;
                  });
                  const winStaffOpsTeamUserId = [];
                  winStaffOpsTeam.forEach((wonTeamStaff) => {
                    winStaffOpsTeamUserId.push(wonTeamStaff.userId)
                  });
                  const resultFilterWon = resultFilter.filter((rmWon) => {
                    return !winStaffOpsTeamUserId.includes(rmWon.userId)
                  })
                  resultFilter = resultFilterWon;
                  const o = {
                    teamQuota: teamQuota - winStaffOpsTeam.length,
                    teamWin: winStaffOpsTeam.length,
                    teamId: te._id,
                    teamIndex: index,
                  };
                  teamStatus.push(o);
                });

                totalTeamQuota = Math.round(totalTeamQuota);
                let takeQuota = -1;
                if (opsGroupQuota < totalTeamQuota) {
                  takeQuota = opsGroupQuota;
                } else {
                  takeQuota = totalTeamQuota;
                }
                let slotRemain = takeQuota - wonStaffCount;
                totalslotRemain += slotRemain;
                const obj = {
                  weekNo: j,
                  slotRemain,
                  teamStatus,
                };
                //console.log("obj", obj);
                let slotWonStaff = [];
                if (slotRemain > 0) {
                  const minimum = 0;
                  const maximum = resultFilter.length - 1;
                  let howManyTimes = 0;
                  for (let p = 0; p < slotRemain; p++) {
                    // get team
                    const randomNumber = (Math.random() * (maximum - minimum + 1)) << 0;
                    //console.log(j, 'randmom', randomNumber);
                    const selectedStaff = resultFilter[randomNumber];
                    let selectedStaffTeam = teamStatus.filter((ts) => {
                      return ts.teamId == selectedStaff.opsT;
                    });
                    selectedStaffTeam = selectedStaffTeam[0];
                    if (selectedStaff.ballotLeaveBalance > 0 && selectedStaffTeam.teamQuota > 0) {
                      // console.log("obj", obj);
                      // return res.json({
                      //   obj,
                      //   selectedStaff,
                      //   parentBallotData,
                      //   j,
                      //   finalWonStaff,
                      // });

                      const isRestirct = await checkStaffRestrict(selectedStaff, parentBallotData, j, finalWonStaff, oldBallotStaffWon);
                      // console.log(j,'selectedStaffTeam.teamQuota', selectedStaffTeam.teamQuota);
                      if (!isRestirct) {
                        if (!slotWonStaff.includes(selectedStaff)) {
                          slotWonStaff.push(selectedStaff);
                          //code by Dipali just needed user name and staffIds
                          let st;
                          const userData = await User.findOne(
                            { _id: selectedStaff.userId },
                            {
                              _id: 0,
                              name: 1,
                              staffId: 1,
                            }
                          );
                          if (!userData) {
                            //console.log("staff may have deleted ");
                            st = {
                              userId: selectedStaff.userId,
                              leaveTypeId: selectedStaff.leaveTypeId,
                              leaveGroupId: selectedStaff.leaveGroupId,
                              weekNo: j,
                              buId: selectedStaff.parentBu,
                              opsGroupId: selectedStaff.opsG,
                              opsTeamId: selectedStaff.opsT,
                              isAutoAssign: true,
                            };
                          } else {
                            st = {
                              userId: selectedStaff.userId,
                              weekNo: j,

                              leaveTypeId: selectedStaff.leaveTypeId,
                              leaveGroupId: selectedStaff.leaveGroupId,
                              userData: userData,
                              buId: selectedStaff.parentBu,
                              opsGroupId: selectedStaff.opsG,
                              opsTeamId: selectedStaff.opsT,
                              isAutoAssign: true,
                            };
                          }
                          //till here
                          // let st = {
                          //     "userId": selectedStaff.userId,
                          //     "weekNo": j,
                          //     "buId": selectedStaff.parentBu,
                          //     "opsGroupId": selectedStaff.opsG,
                          //     "opsTeamId": selectedStaff.opsT,
                          //     isAutoAssign: true

                          // };
                          finalWonStaff.push(st);
                          resultFilter[randomNumber].ballotLeaveBalance = resultFilter[randomNumber].ballotLeaveBalance - 1;
                          teamStatus[selectedStaffTeam.teamIndex].teamQuota = teamStatus[selectedStaffTeam.teamIndex].teamQuota - 1;
                          howManyTimes = 0;
                        } else {
                          if (howManyTimes < checkSlot) {
                            p = p - 1;
                            howManyTimes++;
                          }
                        }
                      } else {
                        if (howManyTimes < checkSlot) {
                          p = p - 1;
                          howManyTimes++;
                        }
                      }
                    } else {
                      if (howManyTimes < checkSlot) {
                        p = p - 1;
                        howManyTimes++;
                      }
                    }
                  }
                }
                reaminSlot.push(obj);
              } else {
                let slotRemain = opsGroupQuota - wonStaffCount;
                const winStaffOpsTeamUserId = [];
                wonStaffList.forEach((wonTeamStaff) => {
                  winStaffOpsTeamUserId.push(wonTeamStaff.userId)
                });
                const resultFilterWon = resultFilter.filter((rmWon) => {
                  return !winStaffOpsTeamUserId.includes(rmWon.userId)
                })
                resultFilter = resultFilterWon;
                const obj = {
                  weekNo: j,
                  slotRemain,
                };
                reaminSlot.push(obj);
                let slotWonStaff = [];
                if (slotRemain > 0) {
                  const minimum = 0;
                  const maximum = resultFilter.length - 1;
                  let howManyTimes = 0;
                  for (let p = 0; p < slotRemain; p++) {
                    // get team
                    const randomNumber = (Math.random() * (maximum - minimum + 1)) << 0;
                    //console.log(j, 'randmom no team', randomNumber);
                    const selectedStaff = resultFilter[randomNumber];
                    if (selectedStaff.ballotLeaveBalance > 0 && opsGroupQuota > 0) {
                      const isRestirct = await checkStaffRestrict(selectedStaff, parentBallotData, j, finalWonStaff, oldBallotStaffWon);
                      if (!isRestirct) {
                        if (!slotWonStaff.includes(selectedStaff)) {
                          slotWonStaff.push(selectedStaff);
                          const userdata = await User.findOne({ _id: selectedStaff.userId }, { _id: 0, name: 1, staffId: 1 });
                          let st = {
                            userId: selectedStaff.userId,
                            weekNo: j,
                            leaveTypeId: selectedStaff.leaveTypeId,
                            leaveGroupId: selectedStaff.leaveGroupId,
                            buId: selectedStaff.parentBu,
                            opsGroupId: selectedStaff.opsG,
                            opsTeamId: selectedStaff.opsT,
                            isAutoAssign: true,
                            userData: userdata,
                          };
                          finalWonStaff.push(st);
                          resultFilter[randomNumber].ballotLeaveBalance = resultFilter[randomNumber].ballotLeaveBalance - 1;
                          opsGroupQuota = opsGroupQuota - 1;
                          howManyTimes = 0;
                        } else {
                          if (howManyTimes < checkSlot) {
                            p = p - 1;
                            howManyTimes++;
                          }
                        }
                      } else {
                        if (howManyTimes < checkSlot) {
                          p = p - 1;
                          howManyTimes++;
                        }
                      }
                    } else {
                      if (howManyTimes < checkSlot) {
                        p = p - 1;
                        howManyTimes++;
                      }
                    }
                  }
                }
              }
              {
                /*
                            // staff avaiable for auto assgin for this slot
                             // const staffAva = [];
                             // for(let k=0; k<resultFilter.length; k++){
                             //     const staff = resultFilter[k].data;
                             //     const opsGroupId = resultFilter[k].opsGroupId;
                             //     const opsTeamId =  resultFilter[k].opsTeamId;
                             //     // if team
                             //     if (slotData.opsTeam && slotData.opsTeam.length > 0) {
                             //         let teamIndex = -1;
                             //         slotData.opsTeam.forEach((te, index1) => {
                             //             if(opsTeamId === te._id){
                             //                 teamIndex = index1;
                             //             }
                             //         });
                             //         for(let m=0; m<staff.length; m++){
                             //             const staffObj = staff[m];
                             //             // check is staff avaiable
                             //             const staffSlot = staffObj.deepClone[''+j+teamIndex];
                             //             if(!staffSlot.isRestrict){
                             //                 const abc = {
                             //                     opsTeamId,
                             //                     opsGroupId,
                             //                     buId:"",
                             //                     weekNo: j,
                             //                     userId: staffObj.userId
                             //                 };
                             //                 staffAva.push(abc)
                             //             }
                             //         }
                             //     }else {
                             //
                             //     }
                             //
                             // }
                             // slotWiseStaff.push({weekNo:j, staffAva})
                             */
              }
            }
          }
        }
        //console.log("qq");

        const updateWin11 = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: { wonStaff: [], staffLeave: [] },
          }
        );
        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: { isConduct: true, isPublish: true },
            $push: {
              wonStaff: { $each: finalWonStaff },
            },
          }
        );

        const reduceLeave = JSON.parse(JSON.stringify(finalWonStaff));
        console.log('*****************************', reduceLeave.length)
        if (reduceLeave.length > 0) {
          let leave = 5;
          if (ballotData.leaveConfiguration === 2) {
            leave = 6;
          } else if (ballotData.leaveConfiguration === 3) {
            leave = 7;
          }
          if (ballotData.leaveType == 2) {
            leave = 1;
          }
          //console.log('leave', leave);
          // genereate leave
          this.insertStaffLeaveForBallotIn(reduceLeave, ballotData, leave);
          reduceLeave.forEach((item) => {
            //console.log("itemitem", item);
            const leaveTypeData = {
              leaveTypeId: item.leaveTypeId,
            };
            console.log('item.weekNo', item.weekNo, typeof item.weekNo)
            const startDate = ballotData.weekRange[item.weekNo].start;
            const startYear = new Date(startDate).getFullYear();
            const sapData = this.managePlanLeave(item.userId, -leave, leaveTypeData, startYear);
            //const sapData = StaffSapData.update({ staff_Id: item.userId }, { $inc: { ballotLeaveBalanced: -leave } }).then((result1) => {
            //console.log(result1)
            //});
            // //console.log('sapData', sapData)
          });
        }
        finalWonStaff = groupBy(finalWonStaff, "userId");

        function checkStaffRestrict(selectedStaffR, ballotDataR, slotNo, autoWonStaff, oldBallotStaffWon) {
          // staff restricted
          //  console.log('1')
          let isRestrictedR = false;
          const userIdR = selectedStaffR.userId.toString();
          const startDate = ballotDataR.slotCreation[0].arr[slotNo].startDate;
          let isWinStaff = [];
          //console.log(
          // "before ballotDataR.wonStaff",
          //  ballotDataR.wonStaff.length,
          //   "actual won ",
          //   parentBallotWon.length,
          //    "auto won ",
          //    autoWonStaff.length
          //   );
          if (parentBallotWon && parentBallotWon.length > 0) {
            ballotDataR.wonStaff = parentBallotWon.concat(autoWonStaff);
          } else {
            ballotDataR.wonStaff = autoWonStaff;
          }
          //  console.log(
          //     "after ballotDataR.wonStaff",
          //     ballotDataR.wonStaff.length
          //   );
          // start Already Won
          if (ballotDataR.wonStaff && ballotDataR.wonStaff.length > 0) {
            isWinStaff = ballotDataR.wonStaff.filter((win) => {
              return win.userId.toString() === userIdR && win.weekNo == slotNo;
            });
            if (isWinStaff.length > 0) {
              return true;
            }
          }

          // end Already Won

          // start Staff Restriction for a particular

          if (ballotDataR.staffRestriction && ballotDataR.staffRestriction.length > 0) {
            const staffRestrictionResultArr = ballotDataR.staffRestriction.filter((staffRestriction) => {
              return new Date(staffRestriction.startDate).getTime() === new Date(startDate).getTime();
            });
            if (staffRestrictionResultArr.length > 0) {
              const staffRestrictionResult = staffRestrictionResultArr[0];
              const userListArr = staffRestrictionResult.userList.filter((userList) => {
                return userList.id.toString() === userIdR;
              });
              if (userListArr.length > 0) {
                //   console.log('I am here')
                return true;
              }
            }
          }

          // end Staff Restriction for a particular

          // get slot win
          const slotWinData = ballotDataR.wonStaff.filter((win) => {
            return win.userId.toString() === userIdR;
          });
          let slotWinNo = [];
          slotWinData.forEach((item) => {
            slotWinNo.push(item.weekNo);
          });

          slotWinNo.push(slotNo);
          slotWinNo.sort(function (a, b) {
            return a - b;
          });
          console.log("slotWinNo", slotWinNo);
          // let slotNumbers = this.getSlot();
          // maxConsecutiveBallot start
          const maxConsecutiveBallot = ballotDataR.maxConsecutiveBallot;
          //console.log("maxConsecutiveBallot", maxConsecutiveBallot, slotWinNo);
          if (slotWinNo.length > 1 && maxConsecutiveBallot) {
            let checkMaxCons = 0;
            let ismaxConsecutiveBallot = false;
            for (let i = 0; i < slotWinNo.length; i++) {
              if (i !== 0) {
                let lastValue = slotWinNo[i - 1];
                let currentValue = slotWinNo[i];
                let diff = currentValue - lastValue;
                if (diff === 1) {
                  checkMaxCons = checkMaxCons + 1;
                  if (checkMaxCons >= maxConsecutiveBallot) {
                    ismaxConsecutiveBallot = true;
                    break;
                  }
                } else {
                  checkMaxCons = 0;
                }
              }
            }
            if (ismaxConsecutiveBallot) {
              console.log("is Consuctive");
              return true;
            } else {
              // console.log("noottt");
            }
            // if(maxConsecutiveBallot){
            //     const lastSlot = ballotDataR.weekRange.length-1;
            //     let prevSlot = slotNo - (maxConsecutiveBallot);
            //     let nextSlot = slotNo + (maxConsecutiveBallot-1);
            //     // if(prevSlot<0){
            //     //     prevSlot = 0;
            //     // }
            //     // if(nextSlot> lastSlot){
            //     //     nextSlot = lastSlot
            //     // }
            //     const slotCheckArr = [];
            //     for(let i=0; i<=maxConsecutiveBallot; i++){
            //         const slotArr = [];
            //         let isValid = true;
            //         for(let j=0; j<=maxConsecutiveBallot; j++){
            //             const slot = prevSlot+j+i;
            //             if(slot<=-1 || slot> lastSlot){
            //                 isValid = false;
            //                 break;
            //             }
            //             if(slotNo !== slot){
            //                 slotArr.push(slot)
            //             }
            //         }
            //         if(isValid) {
            //             slotCheckArr.push(slotArr)
            //         }
            //     }
            //     console.log(slotNo, 'slotCheckArr', slotCheckArr)
            //     let isMaxConsiactive = false;
            //     for(let i=0; i<slotCheckArr.length; i++){
            //         const checkSlot = slotCheckArr[i];
            //         let isPresent = true;
            //         for(let j=0; j< checkSlot.length; j++){
            //             const checkSlotNo = checkSlot[j];
            //             const slotPresent = ballotDataR.wonStaff.filter((w)=>{
            //                return w.userId.toString() === userIdR && w.weekNO === checkSlotNo;
            //             });
            //             if(slotPresent.length===0){
            //                 isPresent = false;
            //                 break;
            //             }
            //         }
            //         if(isPresent){
            //             isMaxConsiactive = true;
            //             break;
            //         }
            //     }
            //     if(isMaxConsiactive){
            //         return true;
            //     }

            // }
          }
          //  // maxConsecutiveBallot end

          //Segement restriction start;
          const maxSegement = ballotDataR.maxSegment;
          if (maxSegement && maxSegement.length > 0) {
            const segmentArr = maxSegement.filter((segement) => {
              return (
                new Date(segement.startDate).getTime() <= new Date(startDate).getTime() && new Date(segement.endDate).getTime() >= new Date(startDate).getTime()
              );
            });

            if (segmentArr.length > 0) {
              const segement = segmentArr[0];
              if (segement.maxBallot) {
                // const startSlot = ballotDataR.slotCreation[0].arr.findIndex((ss) => {
                //   return new Date(ss.startDate).getTime() === new Date(segement.startDate).getTime();
                // });
                // const endSlot = ballotDataR.slotCreation[0].arr.findIndex((ee) => {
                //   let endDate = new Date(ee.startDate);
                //   endDate = endDate.setDate(endDate.getDate() + 6);
                //   //console.log('endDate', new Date(endDate))
                //   return new Date(endDate).getTime() === new Date(segement.endDate).getTime();
                // });

                var segementStartDate = new Date(segement.startDate);
                var yearStartDate = new Date(segementStartDate.getFullYear(), 0, 1);
                var daysTillThen = Math.floor((segementStartDate - yearStartDate) / (24 * 60 * 60 * 1000));
                  
                var weekNumberForSegementStartDate = Math.ceil(daysTillThen / 7);
                console.log('weekNumberForSegementStartDate', weekNumberForSegementStartDate);

                var segementEndDate = new Date(segement.endDate);
                yearStartDate = new Date(segementEndDate.getFullYear(), 0, 1);
                daysTillThen = Math.floor((segementEndDate - yearStartDate) / (24 * 60 * 60 * 1000));
                  
                var weekNumberForSegementEndDate = Math.ceil(daysTillThen / 7);
                console.log('weekNumberForSegementEndDate', weekNumberForSegementEndDate);
                
                let slotWon = 0;
                // console.log("startSlot", slotNo, startSlot, endSlot);
                for (let i = weekNumberForSegementStartDate-1; i < weekNumberForSegementEndDate-1; i++) {
                  // for (let i = startSlot; i <= endSlot; i++) {
                  const slotWonArr = ballotDataR.wonStaff.filter((ww) => {
                    return ww.weekNo === i && ww.userId.toString() === userIdR;
                  });
                  //console.log('userIdR', userIdR, i, slotWonArr.length);
                  if (slotWonArr.length > 0) {
                    slotWon++;
                  }
                }
                //  console.log("slotWon", slotWon, segement.maxBallot);
                if (slotWon >= segement.maxBallot) {
                  return true;
                }

                // console.log(startSlot, endSlot);
              } else {
                return true;
              }
            }
          }
          //Segement restriction end;
          //console.log('last')

          // check old ballot data
          let oldStartDate = new Date(ballotDataR.weekRange[slotNo].start).getTime();
          let oldEndDate = new Date(ballotDataR.weekRange[slotNo].end).getTime();

          let isOldWin = false;
          for (let i = 0; i < oldBallotStaffWon.length; i++) {
            const oldStaffWonObj = oldBallotStaffWon[i];
            if ((oldStaffWonObj.userId == userIdR) && ((oldStartDate >= oldStaffWonObj.startDate && oldStartDate <= oldStaffWonObj.endDate)
              || (oldEndDate >= oldStaffWonObj.startDate && oldEndDate <= oldStaffWonObj.endDate))) {
              isOldWin = true;
              break;
            }

          }
          return isOldWin;
        }
        function groupBy(xs, key) {
          return xs.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
          }, {});
        }

        return res.json({
          message: "Successfully auto assign done",
          success: true,
          finalWonStaff,
        });
      } else {
        return res.json({ message: "Ballot Not found", success: false });
      }
    } else {
      // for BU
      return res.json({ message: "For BU not Implemented", success: false });
    }
  }
  async insertStaffLeaveForBallotIn(finalWinStaff, ballot, totalDeductable) {
    //userId, weekNo,
    // yyyy-mm-dd
    // userId: selectedStaff.userId,
    // leaveTypeId: selectedStaff.leaveTypeId,
    // leaveGroupId: selectedStaff.leaveGroupId,
    // weekNo: j,
    // buId: selectedStaff.parentBu,
    // opsGroupId: selectedStaff.opsG,
    // opsTeamId: selectedStaff.opsT,
    // isAutoAssign: true,
    const finalLeave = [];
    for (let i = 0; i < finalWinStaff.length; i++) {
      const staffWon = finalWinStaff[i];
      const userId = staffWon.userId;
      const leaveTypeData = await this.checkIsAnnualLeave(userId, ballot.companyId);
      if (leaveTypeData.status) {
        const slotWon = staffWon.weekNo;
        const slotArr = ballot.weekRange;
        const slotValue = slotArr[slotWon];
        let startDate = moment(slotValue.start); //.format('DD-MM-YYYY');
        console.log("startDate", startDate);
        let endDate = moment(slotValue.end);
        const diff = endDate.diff(startDate, "days") + 1;
        console.log("diff", diff);
        let leaveTypeId = leaveTypeData.leaveTypeData.leaveTypeId;
        let leaveGroupId = leaveTypeData.leaveGroupId;
        let parentBussinessUnitId = leaveTypeData.businessUnitId;
        const obj = {
          ballotId: ballot._id,
          userId,
          startDate,
          endDate,
          leaveTypeId: leaveTypeId,
          leaveGroupId: leaveGroupId,
          remark: "Won by Ballot(Auto Assign Conduct)",
          timeZone: ballot.timeZone,
          totalDay: diff,
          totalDeducated: totalDeductable,
          totalRestOff: diff - totalDeductable,
          businessUnitId: parentBussinessUnitId,
          status: 4,
          submittedFrom: 4,
        };
        finalLeave.push(obj);
        //finalLeave.push(obj);
        //const saveLeave = new LeaveApplied(obj).save();
      } else {
        // failed to won as anuual leave is not present
      }
    }
    const finalLeavePush = await Ballot.findOneAndUpdate({ _id: ballot._id }, { $set: { staffLeave: finalLeave } });
  }
  async getSlot(id) {
    let ballots = await Ballot.find({
      createdBy: id,
      isDeleted: false,
    })
      .populate([
        {
          path: "staffRestriction.userList.id",
          select: "name",
        },
        {
          path: "adminId",
          select: "_id name staffId",
        },
        {
          path: "opsGroupId",
          model: "OpsGroup",
          select: "_id opsGroupName",
        },
      ])
      .lean();

    return ballots;
  }

  async create(req, res) {
    try {
      // check required filed
      let requiredResult1 = await __.checkRequiredFields(req, [
        "ballotName",
        "openDate",
        "openTime",
        "closeDate",
        "closeTime",
        "ballotStartDate",
        "ballotEndDate",
        "leaveType",
        "resultRelease",
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
        //__.out(res, 400, requiredResult1.missingFields);
      }
      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
      }
      // console.log("REQ OBJ : ", req.body);
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;

      let parentLeaveTypeIdToOverrideChildsLeaveTypeId;

      if (data.parentBallot) {
        parentLeaveTypeIdToOverrideChildsLeaveTypeId = await Ballot.findById(data.parentBallot)
      }

      // return res.json({ status: true, parentLeaveTypeIdToOverrideChildsLeaveTypeId });

      data.applicationOpenDateTime = `${data.openDate} ${data.openTime}:00 ${data.timeZone}`
      data.applicationCloseDateTime = `${data.closeDate} ${data.closeTime}:00 ${data.timeZone}`

      console.log(" data.applicationOpenDateTime", data.applicationOpenDateTime);
      data.applicationOpenDateTime = moment(data.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      console.log(" data.applicationOpenDateTime", data.applicationOpenDateTime);
      data.ballotStartDate = moment(data.ballotStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotEndDate = moment(data.ballotEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.fixedBallotingLeaveType = req.body.fixedBallotingLeaveType

      //return res.json({data})
      if (data.resultRelease == "1") {
        data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`
        data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.maxSegment && data.maxSegment !== 0) {
        data.maxSegment.forEach(segment => {
          segment.startDate = moment.utc(segment.startDate).local().format();
          segment.endDate = moment.utc(segment.endDate).local().format();
        });
      }
      if (data.isAutoAssign) {
        console.log("INSIDE IF of isAutoAssign");
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = "Ballot successfully created";
            if (data.isDraft) {
              message = "Ballot saved as a draft";
            } else {
              //console.log('ressasss', ressss);
              // notification for publish ballot
              // this.sendNotification(ressss)
              // this.ballotEvent(ressss, 'createBallot', false)
            }

            if (data.parentBallot) {
              console.log("Parent Ballot is----:", data.parentBallot);
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }
            return res.json({ status: true, message });
          })
          .catch((err) => {
            console.log("aaaa", err);
          });
      } else {
        console.log("INSIDE ELSE HERE");
        if (data.LeaveTYPE) {
          console.log("--------XXXXXXX--------createCasual--------------xxxxxxxx------")
          this.createCasual();
        }
        const validationObj = this.validationOfDate(data);
        if (validationObj.status) {
          let isValidSegmentDate = { status: true, message: "" };
          if (isValidSegmentDate.status) {
            if (data.leaveType == 2) {
              data.leaveConfiguration = 4;
            }
            let insertLeaveType;
            if (req.body.fixedBallotingLeaveType || data.parentBallot) {
              let newLeaveName = "Fixed Balloting Leave Type";
              let found = await LeaveType.find({ name: { "$regex": newLeaveName, "$options": "i" }, companyId: req.user.companyId, isActive: true }).sort({ _id: -1 }).limit(1);

              if (found && found.length > 0) {
                let nameOfLeave = found[0].name.toString();
                let lastCountInTable = nameOfLeave.split(" ").splice(-1)[0];
                let lastCount = parseInt(lastCountInTable) + 1
                newLeaveName = `${newLeaveName} ${lastCount}`
              }

              if (data.parentBallot) {
                //Child
                data.fixedBallotingLeaveType = parentLeaveTypeIdToOverrideChildsLeaveTypeId.fixedBallotingLeaveType
                data.leaveTypeId = parentLeaveTypeIdToOverrideChildsLeaveTypeId.leaveTypeId
                data.totalQuota = parentLeaveTypeIdToOverrideChildsLeaveTypeId.totalQuota ? parentLeaveTypeIdToOverrideChildsLeaveTypeId.totalQuota : 0
              } else {
                //Parent
                let obj = {};
                obj.name = newLeaveName;
                obj.createdBy = req.user._id;
                obj.updatedBy = req.user._id;
                obj.companyId = req.user.companyId;
                insertLeaveType = await new LeaveType(obj).save();
                data.leaveTypeName = insertLeaveType.name
                data.leaveTypeId = insertLeaveType._id
                data.totalQuota = req.body.totalQuota ? req.body.totalQuota : 0

                if (req.body.fixedBallotingLeaveType || parentLeaveTypeIdToOverrideChildsLeaveTypeId.fixedBallotingLeaveType) {
                  let leaveDtlObj = {}
                  leaveDtlObj.year = new Date(req.body.ballotStartDate).getFullYear()
                  leaveDtlObj.leaveTypeId = data.parentBallot ? parentLeaveTypeIdToOverrideChildsLeaveTypeId.leaveTypeId : insertLeaveType._id
                  leaveDtlObj.quota = req.body.totalQuota ? req.body.totalQuota : 0
                  leaveDtlObj.planQuota = req.body.totalQuota ? req.body.totalQuota : 0
                  leaveDtlObj.total = req.body.totalQuota ? req.body.totalQuota : 0
                  leaveDtlObj.planDymanicQuota = 0
                  leaveDtlObj.taken = 0
                  leaveDtlObj.request = 0

                  await staffLeave.updateMany({}, { $push: { leaveDetails: leaveDtlObj } });
                }
              }

              if (!data.parentBallot) {
                await LeaveGroup.updateMany({ 'leaveType.leaveTypeId': insertLeaveType._id }, {
                  '$set': {
                    'leaveType.$.quota': req.body.totalQuota ? req.body.totalQuota : 0
                  }
                });
              }
            }
            // return res.json({ status: true, data });
            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = "Ballot successfully created";
                if (data.isDraft) {
                  message = "Ballot saved as a draft";
                } else {
                  this.ballotEvent(ressss, 'createBallot', false)
                }
                if (data.parentBallot) {
                  console.log("Parent Ballot is:", data.parentBallot);
                  this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
                }
                return res.json({ status: true, message });
              }).catch((err) => {
                console.log("aaaa", err);
              });
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }
    } catch (e) {
      console.log("inside create catch block ->", e);
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }
  async createCasual(req, res) {
    try {
      // check required filed
      let requiredResult1 = await __.checkRequiredFields(req, [
        "ballotName",
        "openDate",
        "openTime",
        "closeDate",
        "closeTime",
        "ballotStartDate",
        "ballotEndDate",
        "leaveType",
        "resultRelease",
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
        //__.out(res, 400, requiredResult1.missingFields);
      }
      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
      }
      console.log("REQ OBJ : ", req.body);
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;
      data.applicationOpenDateTime = `${data.openDate} ${data.openTime}:00 ${data.timeZone}`
      data.applicationCloseDateTime = `${data.closeDate} ${data.closeTime}:00 ${data.timeZone}`
      data.applicationOpenDateTime = moment(data.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotStartDate = moment(data.ballotStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotEndDate = moment(data.ballotEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      if (data.resultRelease == "1") {
        data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`
        data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.isAutoAssign) {
        console.log("INSIDE IF");
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = "Ballot successfully created";
            if (data.isDraft) {
              message = "Ballot saved as a draft";
            } else {
              this.ballotEvent(ressss, 'createBallot', false)
              //console.log('ressasss', ressss);
              // notification for publish ballot
              // this.sendNotification(ressss)
            }

            if (data.parentBallot) {
              console.log("Parent Ballot is:", data.parentBallot);
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }
            return res.json({ status: true, message });
          })
          .catch((err) => {
            console.log("aaaa", err);
          });
      } else {
        console.log("INSIDE ELSE HERE");

        const validationObj = this.validationOfDate(data);
        if (validationObj.status) {
          let isValidSegmentDate = { status: true, message: "" };
          if (isValidSegmentDate.status) {
            // let isValidstaffRestrictionDate = {status: true, message:''};
            //             if (data.staffRestriction && data.staffRestriction.length > 0) {
            //                 data.staffRestriction.forEach((item) => {
            //                     item.date = moment(item.date, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
            //                     if(item.date === 'Invalid date'){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction Date is not valid';
            //                     }
            //                     else if(new Date(data.ballotStartDate).getTime() > new Date(item.date) ||
            //                         new Date(data.ballotEndDate).getTime() < new Date(item.date)){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction date should be between ballot start and end date';
            //                     }
            //                 });
            //             }

            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = "Ballot successfully created";
                if (data.isDraft) {
                  this.ballotEvent(ressss, 'createBallot', false)
                  message = "Ballot saved as a draft";
                } else {
                  //console.log('ressasss', ressss);
                  // notification for publish ballot
                  // this.sendNotification(ressss)
                }

                if (data.parentBallot) {
                  console.log("Parent Ballot is:", data.parentBallot);
                  this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
                }
                return res.json({ status: true, message });
              })
              .catch((err) => {
                console.log("aaaa", err);
              });
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }


  /*  start here comment code with date time
   async create(req, res) {
    try {
      // check required filed
      let requiredResult1 = await __.checkRequiredFields(req, [
        "ballotName",
        "applicationOpenDateTime",
        "applicationCloseDateTime",
        "ballotStartDate",
        "ballotEndDate",
        "leaveType",
        "resultRelease",
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
        //__.out(res, 400, requiredResult1.missingFields);
      }
      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
      }
      console.log("REQ OBJ : ", req.body);
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;
      data.applicationOpenDateTime = moment(data.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotStartDate = moment(data.ballotStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotEndDate = moment(data.ballotEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      if (data.resultRelease == "1") {
        data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.isAutoAssign) {
        console.log("INSIDE IF");
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = "Ballot successfully created";
            if (data.isDraft) {
              message = "Ballot saved as a draft";
            } else {
              //console.log('ressasss', ressss);
              // notification for publish ballot
              // this.sendNotification(ressss)
            }

            if (data.parentBallot) {
              console.log("Parent Ballot is:", data.parentBallot);
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }
            return res.json({ status: true, message });
          })
          .catch((err) => {
            console.log("aaaa", err);
          });
      } else {
        console.log("INSIDE ELSE HERE");
        if (data.LeaveTYPE) {
          this.createCasual();
        }
        const validationObj = this.validationOfDate(data);
        if (validationObj.status) {
          let isValidSegmentDate = { status: true, message: "" };
          if (data.maxSegment && data.maxSegment.length > 0 && false) {
            data.maxSegment.forEach((item) => {
              item.startDate = moment(item.startDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
              item.endDate = moment(item.endDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
              if (item.startDate === "Invalid date" || item.endDate === "Invalid date") {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment Date is not valid";
              } else if (new Date(item.endDate).getTime() < new Date(item.startDate).getTime()) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment start date should be less then end date";
              } else if (
                new Date(data.ballotStartDate).getTime() > new Date(item.startDate).getTime() ||
                new Date(data.ballotEndDate).getTime() < new Date(item.startDate).getTime()
              ) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment start date should be between ballot start and end date";
              } else if (new Date(data.ballotStartDate).getTime() > new Date(item.endDate) || new Date(data.ballotEndDate).getTime() < new Date(item.endDate)) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment end date should be between ballot start and end date";
              }
            });
          }
          if (isValidSegmentDate.status) {
            //  let isValidstaffRestrictionDate = {status: true, message:''};
            //             if (data.staffRestriction && data.staffRestriction.length > 0) {
            //                 data.staffRestriction.forEach((item) => {
            //                     item.date = moment(item.date, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
            //                     if(item.date === 'Invalid date'){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction Date is not valid';
            //                     }
            //                     else if(new Date(data.ballotStartDate).getTime() > new Date(item.date) ||
            //                         new Date(data.ballotEndDate).getTime() < new Date(item.date)){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction date should be between ballot start and end date';
            //                     }
            //                 });
            //             }
            if (data.leaveType == 2) {
              data.leaveConfiguration = 4;
            }
            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = "Ballot successfully created";
                if (data.isDraft) {
                  message = "Ballot saved as a draft";
                } else {
                  //console.log('ressasss', ressss);
                  // notification for publish ballot
                  // this.sendNotification(ressss)
                }

                if (data.parentBallot) {
                  console.log("Parent Ballot is:", data.parentBallot);
                  this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
                }
                return res.json({ status: true, message });
              })
              .catch((err) => {
                console.log("aaaa", err);
              });
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }
  async createCasual(req, res) {
    try {
      // check required filed
      let requiredResult1 = await __.checkRequiredFields(req, [
        "ballotName",
        "applicationOpenDateTime",
        "applicationCloseDateTime",
        "ballotStartDate",
        "ballotEndDate",
        "leaveType",
        "resultRelease",
      ]);
      if (requiredResult1.status === false) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
        //__.out(res, 400, requiredResult1.missingFields);
      }
      if (
        !req.body.ballotName.trim() ||
        !req.body.applicationOpenDateTime.trim() ||
        !req.body.applicationCloseDateTime.trim() ||
        !req.body.ballotStartDate.trim() ||
        !req.body.ballotEndDate.trim()
      ) {
        return res.json({
          status: false,
          message: "Please fill the empty fields",
        });
      }
      console.log("REQ OBJ : ", req.body);
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;
      data.applicationOpenDateTime = moment(data.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotStartDate = moment(data.ballotStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      data.ballotEndDate = moment(data.ballotEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      if (data.resultRelease == "1") {
        data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.isAutoAssign) {
        console.log("INSIDE IF");
        new Ballot(data)
          .save()
          .then((ressss) => {
            let message = "Ballot successfully created";
            if (data.isDraft) {
              message = "Ballot saved as a draft";
            } else {
              //console.log('ressasss', ressss);
              // notification for publish ballot
              // this.sendNotification(ressss)
            }

            if (data.parentBallot) {
              console.log("Parent Ballot is:", data.parentBallot);
              this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
            }
            return res.json({ status: true, message });
          })
          .catch((err) => {
            console.log("aaaa", err);
          });
      } else {
        console.log("INSIDE ELSE HERE");

        const validationObj = this.validationOfDate(data);
        if (validationObj.status) {
          let isValidSegmentDate = { status: true, message: "" };
          if (data.maxSegment && data.maxSegment.length > 0 && false) {
            data.maxSegment.forEach((item) => {
              item.startDate = moment(item.startDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
              item.endDate = moment(item.endDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
              if (item.startDate === "Invalid date" || item.endDate === "Invalid date") {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment Date is not valid";
              } else if (new Date(item.endDate).getTime() < new Date(item.startDate).getTime()) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment start date should be less then end date";
              } else if (
                new Date(data.ballotStartDate).getTime() > new Date(item.startDate).getTime() ||
                new Date(data.ballotEndDate).getTime() < new Date(item.startDate).getTime()
              ) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment start date should be between ballot start and end date";
              } else if (new Date(data.ballotStartDate).getTime() > new Date(item.endDate) || new Date(data.ballotEndDate).getTime() < new Date(item.endDate)) {
                isValidSegmentDate.status = false;
                isValidSegmentDate.message = "Segment end date should be between ballot start and end date";
              }
            });
          }
          if (isValidSegmentDate.status) {
            //  let isValidstaffRestrictionDate = {status: true, message:''};
            //             if (data.staffRestriction && data.staffRestriction.length > 0) {
            //                 data.staffRestriction.forEach((item) => {
            //                     item.date = moment(item.date, 'MM-DD-YYYY HH:mm:ss Z').utc().format();
            //                     if(item.date === 'Invalid date'){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction Date is not valid';
            //                     }
            //                     else if(new Date(data.ballotStartDate).getTime() > new Date(item.date) ||
            //                         new Date(data.ballotEndDate).getTime() < new Date(item.date)){
            //                         isValidstaffRestrictionDate.status = false;
            //                         isValidstaffRestrictionDate.message = 'staff restriction date should be between ballot start and end date';
            //                     }
            //                 });
            //             }

            new Ballot(data)
              .save()
              .then((ressss) => {
                let message = "Ballot successfully created";
                if (data.isDraft) {
                  message = "Ballot saved as a draft";
                } else {
                  //console.log('ressasss', ressss);
                  // notification for publish ballot
                  // this.sendNotification(ressss)
                }

                if (data.parentBallot) {
                  console.log("Parent Ballot is:", data.parentBallot);
                  this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
                }
                return res.json({ status: true, message });
              })
              .catch((err) => {
                console.log("aaaa", err);
              });
          } else {
            return res.json({
              status: false,
              message: isValidSegmentDate.message,
            });
          }
        } else {
          return res.json({ status: false, message: validationObj.message });
        }
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }

  end here date and time
  */

  validationOfDate(data) {
    //console.logs("data.applicationOpenDateTime: ",data.applicationOpenDateTime);
    //console.logs("data.applicationCloseDateTime: ",data.applicationCloseDateTime);
    //console.logs("data.ballotStartDate: ",data.ballotStartDate);
    //console.logs("data.resultReleaseDateTime: ",data.resultReleaseDateTime);
    //console.logs("data.ballotEndDate: ",data.ballotEndDate)
    if (
      data.applicationOpenDateTime === "Invalid date" ||
      data.applicationCloseDateTime === "Invalid date" ||
      data.ballotStartDate === "Invalid date" ||
      data.resultReleaseDateTime === "Invalid date" ||
      data.ballotEndDate === "Invalid date"
    ) {
      return {
        status: false,
        message: "There are some date are not in valid format",
      };
    }
    if (data.resultRelease == 1 && new Date(data.applicationCloseDateTime).getTime() > new Date(data.resultReleaseDateTime).getTime()) {
      return {
        status: false,
        message: "Result release date should be greater then application close date",
      };
    }
    if (data.resultRelease == 1 && new Date(data.ballotStartDate).getTime() < new Date(data.resultReleaseDateTime).getTime()) {
      return {
        status: false,
        message: "Result release date should be less then ballot start date",
      };
    }
    if (new Date().getTime() > new Date(data.applicationOpenDateTime).getTime()) {
      return {
        status: false,
        message: "Application Open Date should be greater then today",
      };
    }
    if (new Date(data.applicationCloseDateTime).getTime() < new Date(data.applicationOpenDateTime).getTime()) {
      return {
        status: false,
        message: "Application Open Date should be less then close date",
      };
    }
    if (new Date().getTime() > new Date(data.ballotStartDate).getTime()) {
      return {
        status: false,
        message: "Ballot Start Date should be greater then today",
      };
    }
    if (new Date(data.ballotEndDate).getTime() < new Date(data.ballotStartDate).getTime()) {
      return {
        status: false,
        message: "Ballot Start Date should be less then end date",
      };
    }
    if (
      new Date(data.applicationOpenDateTime).getTime() > new Date(data.ballotStartDate).getTime() ||
      new Date(data.applicationOpenDateTime).getTime() > new Date(data.ballotEndDate).getTime()
    ) {
      return {
        status: false,
        message: "Application Open Date should be less then ballot start date or end Date",
      };
    }
    if (
      new Date(data.applicationCloseDateTime).getTime() > new Date(data.ballotStartDate).getTime() ||
      new Date(data.applicationCloseDateTime).getTime() > new Date(data.ballotEndDate).getTime()
    ) {
      return {
        status: false,
        message: "Application Close Date should be less then ballot start date or end Date",
      };
    }
    return { status: true };
  }

  async checkIfHasParentAndUpdate(ballotid, id) {
    let currentBallot = await Ballot.findOne({ _id: ballotid });
    if (!currentBallot) {
      //console.logs("NO ballot found");
    } else {
      //console.logs("in else of current data found");
      if (currentBallot.parentBallot) {
        //console.logs("in if of parent data",currentBallot.parentBallot);
        this.checkIfHasParentAndUpdate(currentBallot.parentBallot, id);
      } else {
        //console.logs("in checkIfHasParentAndUpdate update id is: ",id);
        let update = await Ballot.update({ _id: currentBallot._id }, { $push: { childBallots: id } });
      }
    }
  }

  async readBallots(req, res) {
    try {
      let id = req.user.id;
      console.log('req of readBallots', req.query)
      let limit = 10;
      let page = 1;
      if (req.query.page) {
        page = parseInt(req.query.page);
      }
      const opp = {
        page: page, limit: 10, lean: true, sort: { createdAt: -1 },
        populate: [
          {
            path: "staffRestriction.userList.id",
            select: "name",
          },
          {
            path: "adminId",
            select: "_id name staffId",
          },
          {
            path: "leaveTypeId",
            model: "LeaveType",
            select: "_id name",
          },
          {
            path: "opsGroupId",
            model: "OpsGroup",
            select: "_id opsGroupName",
          },
        ]

      }
      let ballots = await Ballot.paginate({
        $or: [
          {
            createdBy: id
          },
          { adminId: id },
        ],
        companyId: req.user.companyId,
        isDeleted: false,
      }, opp)
      const data = ballots.docs;
      return res.json({ status: true, data: data, total: ballots.total, pages: ballots.pages });
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: "Something went wrong",
      });
    }
  }

  async read(req, res) {
    try {
      const data = await Ballot.find({
        companyId: req.user.companyId,
        isDeleted: false,
      })
        .populate([
          {
            path: "staffRestriction.userList.id",
            select: "name",
          },
        ])
        .lean();

      return res.json({ status: true, data });
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: "Something went wrong",
      });
    }
  }
  async readBallotForStaff(req, res) {
    try {
      // get ballot for Ops group
      const opsGroupList = await OpsGroup.findOne({ userId: req.user._id, isDelete: false }, { _id: 1, opsTeamId: 1 });
      console.log('------------------- opsGroupList ----------------------- ', opsGroupList)
      const staffOpsTeam = await OpsTeam.findOne({
        userId: req.user._id,
        isDeleted: false,
        opsGroupId: opsGroupList._id,
      });
      let ballotListOps = [];
      ballotListOps = await Ballot.find({
        opsGroupId: opsGroupList._id,
        isPublish: true,
        $expr: { $eq: [{ $year: "$ballotStartDate" }, req.body.year] },
      });
      //console.logs("ballotListOps :",opsGroupList);
      // get ballot for BU
      let ballotListBu = await Ballot.find({
        businessUnitId: req.user.parentBussinessUnitId,
        isPublish: true,
        $expr: { $eq: [{ $year: "$ballotStartDate" }, req.body.year] },

      });
      //console.logs('ballotListBu', ballotListBu.length, ballotListOps.length);
      let ballotList = ballotListBu.concat(ballotListOps);
      this.generateBallotDataForStaff(ballotList, res, req, opsGroupList, staffOpsTeam);
    } catch (e) {
      console.log('|||||||||||||||||||||| error ||||||||||||||||| ', e)
      return res.status(500).json({
        success: false,
        data: e,
        message: "Something went wrong",
      });
      // return res.json({status: false, data: null, message: 'Something went wrong', e});
    }
  }
  async generateBallotDataForStaff(ballotList, res, req, opsGroupList, opsTeamList) {
    if (ballotList.length > 0) {
      ballotList = JSON.stringify(ballotList);
      ballotList = JSON.parse(ballotList);
      let userSlot = [];
      let userSlotOps = [];
      let userTierOps = [];
      for (let i = 0; i < ballotList.length; i++) {
        const item = ballotList[i];
        let staffStatus = "No Application";
        const toBeRemove = [];
        item.appliedStaff.forEach((appliedStaff, index) => {
          if (req.user._id.toString() === appliedStaff.userId.toString()) {
            // //console.logs('1')
            staffStatus = "Submitted";
            if (item.isResultRelease) {
              //staffStatus = "Unsuccessful";
              appliedStaff.resultStatus = "Failed";

              if (item.wonStaff && item.wonStaff.length > 0) {
                item.wonStaff.forEach((won) => {
                  if (req.user._id.toString() === won.userId.toString() && won.weekNo === appliedStaff.weekNo) {
                    // staffStatus = 'Successful';
                    appliedStaff.resultStatus = "Successful";
                  }
                });
              }
            }
          } else {
            // remove other staff
            toBeRemove.push(index);
            //item.appliedStaff.splice(index, 1);
          }
        });
        if (item.isResultRelease) {
          if (item.isAutoAssign) {
            if (item.wonStaff && item.wonStaff.length > 0) {
              item.wonStaff.forEach((won) => {
                if (req.user._id.toString() === won.userId.toString()) {
                  // staffStatus = 'Successful';
                  won.resultStatus = "Successful";
                }
                item.appliedStaff.push(won);
              });
            }
          }
        }
        delete item.wonStaff;
        for (let iii = toBeRemove.length - 1; iii >= 0; iii--) {
          item.appliedStaff.splice(toBeRemove[iii], 1);
        }
        ////console.logs('toBeRemove', toBeRemove)
        // if result release
        let ballotStatus = "Open";
        if (new Date().getTime() > new Date(item.applicationCloseDateTime).getTime()) {
          ballotStatus = "Closed";
        }
        if (item.isResultRelease) {
          ballotStatus = "Closed";
        }
        if (item.isCanceled) {
          ballotStatus = "Cancelled";
        }
        ballotList[i].staffStatus = staffStatus;
        ballotList[i].ballotStatus = ballotStatus;
        ballotList[i].monthRange = [];
        ////console.logs(JSON.stringify(item.weekRange), 'weekrange');
        ballotList[i].monthRange = JSON.stringify(item.weekRange);
        ballotList[i].monthRange = JSON.parse(ballotList[i].monthRange);

        // week range
        if (ballotList[i].userFrom === 2) {
          ////console.logs('aaaaa', req.user)
          ////console.logs('req.user.parentBussinessUnitId', req.user._id)
          userSlot = ballotList[i].slotCreation.filter((bu) => {
            // //console.logs('bu.buId', bu.buId)
            return bu.buId.toString() === req.user.parentBussinessUnitId.toString();
          });
          // //console.logs('userSlot', userSlot.length)
          userSlot = userSlot[0];
        } else {
          let slotRange = ballotList[i].slotCreation.filter((bu) => {
            // //console.logs('bu.buId', opsGroupList._id);
            return bu.opsGroup.opsId.toString() === opsGroupList._id.toString();
          });
          console.log("SLOTRANGE: ", slotRange);
          slotRange = slotRange[0];
          userSlotOps = [];
          userTierOps = [];
          if (opsGroupList && opsGroupList.opsTeamId.length > 0) {
            let teamIndex = slotRange.opsTeam.findIndex((tttt) =>  tttt && tttt._id && tttt._id.toString() === opsTeamList._id.toString());
            // //console.logs("TEAMINDEX: ",teamIndex);
            slotRange.arr.forEach((ii, indexArr) => {
              const key = 'OG' + indexArr + 'OT' + teamIndex;
              const key1 = "" + indexArr + "A";
              //console.logs("KAY IS:",slotRange.weekRangeSlot[key]);
              userTierOps.push(slotRange.weekRangeSlot[key1]);
              userSlotOps.push(slotRange.weekRangeSlot[key]);
            });
          } else {
            // no team
            slotRange.arr.forEach((ii, indexArr) => {
              const key = "" + indexArr + "A";
              userSlotOps.push(slotRange.weekRangeSlot[key]);
            });
          }
          delete ballotList[i].slotCreation;
          ballotList[i].slotCreation = [];
          ballotList[i].slotCreation.push(slotRange);
        }
        // //console.logs("USERLOT:",userSlotOps);
        console.log('hehehehehheheheh')
        ballotList[i].monthRange.forEach((dd, index) => {
          dd.month = moment(dd.start).format("MMMM-YY");
          dd.weekNO = index;
          console.log('ballotList[i].userFrom', ballotList[i].userFrom)
          if (ballotList[i].userFrom === 2) {
            if (userSlot) dd.quotaValue = userSlot.arr[index].value;
          } else {
            ////console.logs("userSlotOps[index].value: ",userSlotOps[index]);
            if (userTierOps.length > 0) {
              dd.tierQuota = userTierOps[index] ? userTierOps[index].value : 0;
            } else {
              dd.tierQuota = userSlotOps[index] ? userSlotOps[index].value : 0;
            }
            dd.quotaValue = userSlotOps[index] ? userSlotOps[index].value : 0;
          }
        });
        console.log('i am heehehhhe')
        ////console.logs(groupBy(ballotList[i].monthRange, 'month'));
        ballotList[i].monthRange = groupBy(ballotList[i].monthRange, "month");
        const MONTH = [];

        await Object.entries(ballotList[i].monthRange).forEach((entry) => {
          let key = entry[0];
          let value = entry[1];
          var objTo = {};
          objTo[key] = value;
          MONTH.push(objTo);
          //use key and value here
        });
        ballotList[i].monthRange = MONTH;
      }

      function groupBy(xs, key) {
        return xs.reduce(function (rv, x) {
          (rv[x[key]] = rv[x[key]] || []).push(x);
          return rv;
        }, {});
      }

      // sort by name
      ballotList.sort(function (a, b) {
        var nameA = a.ballotName.toUpperCase(); // ignore upper and lowercase
        var nameB = b.ballotName.toUpperCase(); // ignore upper and lowercase
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }

        // names must be equal
        return 0;
      });

      return res.status(201).json({
        success: true,
        data: ballotList,
      });
    } else {
      return res.status(400).json({
        success: false,
        data: [],
        message: "No Ballot found",
      });
    }
  }
  async readBallotForStaffApplied(req, res) {
    try {
      var opsfilteredOpen = [];
      var opsfilteredClosed = [];
      //console.logs('req.user._id', req.user._id)
      // const ballotList = await Ballot.find({'appliedStaff.userId': req.user._id, isPublish: true}, {slotCreation:0});
      const ballotList = await Ballot.find(
        {
          $or: [{ "appliedStaff.userId": req.user._id }, { "wonStaff.userId": req.user._id }],
          isPublish: true,
        },
        { slotCreation: 0 }
      );

      //finding ballots with new requirements saying

      const opsGroupOfUser = await OpsGroup.findOne({ userId: req.user._id, isDelete: false }, { _id: 1, opsTeamId: 1 });
      console.log("out opsGroup: ", opsGroupOfUser);
      if (opsGroupOfUser) {
        const ballotListOps = await Ballot.find({
          opsGroupId: opsGroupOfUser._id,
          isPublish: true,
          isDeleted: false,
        });
        console.log("ballotListOps ", ballotListOps.length);
        if (ballotListOps.length > 0) {
          //new Date().getTime() > new Date(item.applicationCloseDateTime).getTime()
          opsfilteredOpen = ballotListOps.filter((bl) => new Date(bl.applicationCloseDateTime).getTime() > new Date().getTime());
          opsfilteredClosed = ballotListOps.filter((b2) => new Date(b2.applicationCloseDateTime).getTime() < new Date().getTime());
          console.log("opsfilteredOpen: ", opsfilteredOpen.length);
          console.log("opsfilteredClosed: ", opsfilteredClosed.length);
        }
      }

      if (ballotList.length > 0) {
        this.generateBallotDataForStaffApplied(ballotList, opsfilteredOpen, opsfilteredClosed, res, req);
        //return res.json({success: true, ballotList});
        // return res.status(201).json({
        //     success:true,
        //     data:ballotList
        // });
      } else {
        return res.status(400).json({
          success: false,
          data: e,
          // error:e,
          message: "No Ballot applied",
        });
        // return res.json({success: false, message:'No Ballot applied'});
      }
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: "Something went wrong",
      });
      // return res.json({status: false, data: null, message: 'Something went wrong', e});
    }
  }
  async generateBallotDataForStaffApplied(ballotList, opsfilteredOpen, opsfilteredClosed, res, req) {
    let ballotForParent = [];
    //console.logs("ballot list is: ",ballotList);
    if (ballotList.length > 0) {
      ballotList = JSON.stringify(ballotList);
      ballotList = JSON.parse(ballotList);
      for (let i = 0; i < ballotList.length; i++) {
        //console.logs("BallotList of i: ",i);
        const item = ballotList[i];
        let staffStatus = "No Application";
        const toBeRemove = [];
        item.appliedStaff.forEach((appliedStaff, index) => {
          //console.logs("item.appliedStaff: ", index);
          if (req.user._id.toString() === appliedStaff.userId.toString()) {
            //console.logs("AOOLIED CHECK");
            const slotObj = item.weekRange[appliedStaff.weekNo];
            //console.logs('slotObj', slotObj);
            item.appliedStaff[index].slotObj = {};
            item.appliedStaff[index].slotObj = slotObj;
            staffStatus = "Submitted";
            if (item.isResultRelease) {
              staffStatus = "Successful";
              appliedStaff.resultStatus = "Failed";
              item.wonStaff.forEach((won) => {
                if (req.user._id.toString() === won.userId.toString() && won.weekNo === appliedStaff.weekNo) {
                  staffStatus = "Successful";
                  appliedStaff.resultStatus = "Successful";
                }
              });
            }
          } else {
            // remove other staff
            toBeRemove.push(index);
            //item.appliedStaff.splice(index, 1);
          }
        });
        if (item.isResultRelease) {
          if (item.isAutoAssign) {
            if (item.wonStaff && item.wonStaff.length > 0) {
              item.wonStaff.forEach((won) => {
                const slotObj = item.weekRange[won.weekNo];
                if (req.user._id.toString() === won.userId.toString()) {
                  won.slotObj = {};
                  won.slotObj = slotObj;
                  // staffStatus = 'Successful';
                  won.resultStatus = "Successful";
                }
                item.appliedStaff.push(won);
              });
            }
          }
        }
        delete item.wonStaff;

        for (let iii = toBeRemove.length - 1; iii >= 0; iii--) {
          item.appliedStaff.splice(toBeRemove[iii], 1);
        }
        // if result release
        let ballotStatus = "Open";
        if (new Date().getTime() > new Date(item.applicationCloseDateTime).getTime()) {
          ballotStatus = "Closed";
        }
        if (item.isResultRelease) {
          ballotStatus = "Closed";
        }
        ballotList[i].staffStatus = staffStatus;
        ballotList[i].ballotStatus = ballotStatus;
      }

      //code added to get won slots for all related ballots
      // for (let b = 0; b <= ballotList.length - 1; b++) {
      //   if (ballotList[b].childBallots && ballotList[b].childBallots.length > 0) {
      //     //console.logs("in child ballots list", ballotList[b].childBallots);
      //     for (let cb = 0; cb <= ballotList[b].childBallots.length - 1; cb++) {
      //       let child = ballotList.find(function (ele) {
      //         return ele._id === ballotList[b].childBallots[cb];
      //       });
      //       //console.logs("Child is: ", child);
      //       if (!child) {
      //         //console.logs("respetive ballot won may no be there");
      //         let BallotChild = await Ballot.findOne({
      //           _id: ballotList[b].childBallots[cb],
      //         });
      //         BallotChild = JSON.stringify(BallotChild);
      //         BallotChild = JSON.parse(BallotChild);
      //         if (!BallotChild) {
      //           //console.logs("NO ballot found so skip it");
      //         } else {
      //           let parentSuccess = ballotList[b].appliedStaff.filter(function (app) {
      //             return app.resultStatus === "Successful";
      //           });
      //           // ballotList[b].appliedStaff=  ballotList[b].appliedStaff.concat(successArray);
      //           //console.logs("parentSuccess BAllotchold: ", parentSuccess);
      //           BallotChild.appliedStaff = parentSuccess;
      //           //console.logs("BAllotchold: ", BallotChild.appliedStaff);
      //           ballotForParent.push(BallotChild);
      //         }
      //       } else {
      //         //console.logs("found child yep yep", child.appliedStaff);
      //         let parentSuccess = ballotList[b].appliedStaff.filter(function (app) {
      //           return app.resultStatus === "Successful";
      //         });
      //         let successArray = child.appliedStaff.filter(function (applied) {
      //           return applied.resultStatus === "Successful";
      //         });
      //         //console.logs("Successfula array is: ", successArray);
      //         ballotList[b].appliedStaff = ballotList[b].appliedStaff.concat(successArray);
      //         //console.logs(" ballotList[b].childBallots[cb]: ", child)
      //         child.appliedStaff = child.appliedStaff.concat(parentSuccess);
      //       }
      //     }
      //   } else {
      //     //console.logs("no child ballot found");
      //   }
      // }

      // ballotList = ballotList.concat(ballotForParent);

      if (opsfilteredOpen.length > 0) {
        for (let i = 0; i <= opsfilteredOpen.length - 1; i++) {
          let tempoopenBallot = JSON.stringify(opsfilteredOpen[i]);
          opsfilteredOpen[i] = JSON.parse(tempoopenBallot);
          //if already applied
          if (opsfilteredOpen[i].appliedStaff.length > 0) {
            let toBeRemove1 = [];
            for (let a = 0; a <= opsfilteredOpen[i].appliedStaff.length - 1; a++) {
              console.log("HERE in for loop me");
              let staffStatus = "No Application";
              if (req.user._id.toString() === opsfilteredOpen[i].appliedStaff[a].userId.toString()) {
                //console.logs("AOOLIED CHECK");
                const slotObj = opsfilteredOpen[i].weekRange[opsfilteredOpen[i].appliedStaff[a].weekNo];
                //console.logs('slotObj', slotObj);
                opsfilteredOpen[i].appliedStaff[a].slotObj = {};
                opsfilteredOpen[i].appliedStaff[a].slotObj = slotObj;
                console.log("HERE in for loop mefsdfsfsdf:", opsfilteredOpen[i].appliedStaff[a]);
                opsfilteredOpen[i].appliedStaff[a].staffStatus = "Submitted";
              } else {
                // remove other staff
                toBeRemove1.push(a);
                // opsfilteredOpen[i].appliedStaff.splice(a, 1);
              }
            }

            for (let iii = toBeRemove1.length - 1; iii >= 0; iii--) {
              opsfilteredOpen[i].appliedStaff.splice(toBeRemove1[iii], 1);
            }
          }

          let winners = [];
          if (opsfilteredClosed.length > 0) {
            for (let j = 0; j <= opsfilteredClosed.length - 1; j++) {
              let tempoclosedBallot = JSON.stringify(opsfilteredClosed[j]);
              opsfilteredClosed[j] = JSON.parse(tempoclosedBallot);
              let winss = opsfilteredClosed[j].wonStaff.filter((wn) => {
                var dat = [];
                if (wn.userId.toString() == req.user._id.toString()) {
                  wn.slotObj = {
                    start: opsfilteredClosed[j].weekRange[wn.weekNo].start,
                    end: opsfilteredClosed[j].weekRange[wn.weekNo].end,
                  };
                  wn.resultStatus = "Successful";
                  return dat.push(wn);
                }
              });
              console.log("here", winss.length);
              winners = winners.concat(winss);
            }
          }
          if (winners.length > 0) {
            for (let w = 0; w <= winners.length - 1; w++) {
              console.log("winners[w] ", winners[w].slotObj.start);
              console.log("winners[w] ", winners[w].slotObj.end);

              var indexHere = opsfilteredOpen[i].weekRange.findIndex((x) => x.start == winners[w].slotObj.start && x.end == winners[w].slotObj.end);
              console.log("Index here is: ", indexHere);
              if (indexHere !== -1) {
                //find and exchange indexes here...
                winners[w].weekNo = indexHere;
                opsfilteredOpen[i].appliedStaff.push(winners[w]);
              }
            }
          }
          // console.log("WInners sre: ", winners);
          var indexOfSameBallot = ballotList.findIndex((x) => x._id.toString() == opsfilteredOpen[i]._id.toString());
          if (indexOfSameBallot !== -1) {
            console.log("Thid is there already", indexOfSameBallot);
            ballotList.splice(indexOfSameBallot);
          } else {
            console.log("this is not tere already", indexOfSameBallot);
          }
        }

        ballotList = ballotList.concat(opsfilteredOpen);
      }
      console.log("coming out");
      return res.status(201).json({
        success: true,
        data: ballotList,
      });
    } else {
      return res.status(400).json({
        success: false,
        data: [],
        message: "No Ballot found",
      });
    }
  }

  async staffApplyForSlot(req, res) {
    try {
      //req.user._id = req.body.userId;
      //console.logs('req.user._id', req.user._id);
      const alreadyApplied = await Ballot.findOne({
        _id: req.body.ballotId,
        isPublish: true,
        appliedStaff: {
          $elemMatch: { weekNo: req.body.slotNumber, userId: req.user._id },
        },
      });
      ////console.logs('alreadyApplied',alreadyApplied);
      if (!alreadyApplied) {
        let obj = {};
        let checkLeave = await this.checkIsLeavePresent(req.user._id, req.body.leaveConfiguration);
        if (checkLeave) {
          if (req.body.userFrom === 1) {
            //console.logs('111');
            // //console.logs('111',alreadyApplied.userFrom);
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              }
            );
            //  return res.send(opsGroupList)
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              }
            );
            if (opsTeamList || (opsGroupList && opsGroupList.opsTeamId.length === 0)) {
              if (opsGroupList.opsTeamId.length === 0) {
                //console.logs('ygdyug')
                obj = {
                  userId: req.user._id,
                  weekNo: req.body.slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: req.body.slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              return res.status(400).json({
                success: false,
                message: "You can not apply for slot as your not in any OPS team",
              });
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: req.body.slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }
          //console.logs('obj', obj)
          const apply = await Ballot.findOneAndUpdate({ _id: req.body.ballotId }, { $push: { appliedStaff: obj } });
          let leaveDecrease = 5;
          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          }
          const sapData = await StaffSapData.findOneAndUpdate({ staff_Id: req.user._id }, { $inc: { ballotLeaveBalanced: -leaveDecrease } });
          return res.status(201).json({
            success: true,
            message: "Successfully Applied to slot",
            sapData,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "You do not have leave to apply for slot",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "You are already applied for same slot",
        });
      }
    } catch (e) {
      return res.status(500).json({
        status: false,
        data: null,
        message: "Something went wrong",
        e,
      });
    }
  }

  async staffApplyForSlotMulti(req, res) {
    //  try {

    //req.user._id = req.body.userId;
    //console.logs('req.user._id', req.user._id);
    const alreadyArr = [];
    const successArr = [];
    const failedArr = [];
    for (let i = 0; i < req.body.slotNumber.length; i++) {
      const slotNumber = req.body.slotNumber[i];
      const alreadyApplied = await Ballot.findOne({
        _id: req.body.ballotId,
        isPublish: true,
        appliedStaff: {
          $elemMatch: { weekNo: slotNumber, userId: req.user._id },
        },
      });
      ////console.logs('alreadyApplied',alreadyApplied);
      if (!alreadyApplied) {
        let obj = {};
        let checkLeave = await this.checkIsLeavePresent(req.user._id, req.body.leaveConfiguration);
        if (checkLeave) {
          if (req.body.userFrom === 1) {
            //console.logs('111');
            // //console.logs('111',alreadyApplied.userFrom);
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              }
            );
            //  return res.send(opsGroupList)
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              }
            );
            if (opsTeamList || (opsGroupList && opsGroupList.opsTeamId.length === 0)) {
              if (opsGroupList.opsTeamId.length === 0) {
                //console.logs('ygdyug')
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              failedArr.push(slotNumber);
              /* return res.status(400).json({
                                 success: false,
                                 message: 'You can not apply for slot as your not in any OPS team'
                             });*/
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }
          // //console.logs('obj', obj)
          const apply = await Ballot.findOneAndUpdate({ _id: req.body.ballotId }, { $push: { appliedStaff: obj } });
          let leaveDecrease = 5;
          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          }
          const sapData = await StaffSapData.findOneAndUpdate({ staff_Id: req.user._id }, { $inc: { ballotLeaveBalanced: -leaveDecrease } });
          successArr.push(slotNumber);
          /*return res.status(201).json({
                        success: true,
                        message: 'Successfully Applied to slot',
                        sapData
                    });*/
        } else {
          failedArr.push(slotNumber);
          // return res.status(400).json({
          //     success: false,
          //     successArr,
          //     alreadyArr,
          //     failedArr,
          //     message: 'You do not have leave to apply for slot'
          // });
          // break;
        }
      } else {
        alreadyArr.push(slotNumber);
        /*return res.status(400).json({
                    success: false,
                    message: 'You are already applied for same slot'
                });*/
      }
    }
    return res.status(201).json({
      success: true,
      message: "Successfully Applied to slot",
      successArr,
      alreadyArr,
      failedArr,
    });

    // }catch (e) {
    //     return res.status(500).json({status: false, data: null, message: 'Something went wrong', e});
    // }
  }
  async checkIsAnnualLeave(userId, companyId, year, isFixedBallotingLeaveType = false, leaveTypeId = null) {
    let annualLeave;
    if (isFixedBallotingLeaveType) {
      annualLeave = await leaveType.findOne({ _id: leaveTypeId, isActive: true, companyId });
    } else {
      annualLeave = await leaveType.findOne({ name: "Annual Leave", isActive: true, companyId });
    }

    console.log("annualLeaveannualLeaveannualLeaveleaveTypeIdleaveTypeId", annualLeave)

    if (annualLeave) {
      const staffLevaeData = await staffLeave.findOne({ userId: userId, "leaveDetails.leaveTypeId": annualLeave._id, });

      console.log("staffLevaeDatastaffLevaeDatastaffLevaeDatastaffLevaeData", staffLevaeData)

      if (staffLevaeData) {
        if (!year) {
          let leaveTypeData = staffLevaeData.leaveDetails.filter((leave) => {
            return leave.leaveTypeId.toString() == annualLeave._id.toString();
          })[0];
          return { leaveTypeData, status: true, leaveGroupId: staffLevaeData.leaveGroupId, businessUnitId: staffLevaeData.businessUnitId };
        } else {
          let leaveTypeData = staffLevaeData.leaveDetails.filter((leave) => {
            return leave.leaveTypeId.toString() == annualLeave._id.toString() && leave.year == year;
          });
          var status = true;
          if (leaveTypeData && leaveTypeData.length > 0) {
            leaveTypeData = leaveTypeData[0]
          } else {
            status = false;
            leaveTypeData = {}
            leaveTypeData.planQuota = 0;
          }
          return { leaveTypeData, status, leaveGroupId: staffLevaeData.leaveGroupId, businessUnitId: staffLevaeData.businessUnitId };
        }
      }
      return { status: false };
    }
    return { status: false };
  }
  async managePlanLeave(userId, leaveQuota, leaveTypeData, startYear = new Date().getFullYear()) {
    console.log('startYear^^^^^^^^^^^^^^--->>>>>', userId, leaveQuota, leaveTypeData, startYear)
    const updateStaffLeave = await staffLeave.findOneAndUpdate(
      { userId, leaveDetails: { "$elemMatch": { "year": startYear, leaveTypeId: leaveTypeData.leaveTypeId } } },
      { $inc: { "leaveDetails.$.planQuota": leaveQuota, "leaveDetails.$.request": leaveQuota } }
    );
    return updateStaffLeave;
  }
  async staffApplyForMultipleSlots(req, res) {
    let isAnnualLeavePresent;
    let data = req.body;
    const userId = req.user._id;
    //req.user._id = data.userId;
    let failedArr = [];
    let successArr = [];

    // const findFixedBallotingLeaveTypeObj = await Ballot.findOne({ _id: data.ballotId, 'staffLeave.userId': '5f93be79c2d91279357fcfcc', isPublish: true }, { staffLeave: 1 });
    const findFixedBallotingLeaveTypeObj = await Ballot.findOne({ _id: data.ballotId, isPublish: true });

    if (findFixedBallotingLeaveTypeObj !== null && findFixedBallotingLeaveTypeObj.fixedBallotingLeaveType) {
      isAnnualLeavePresent = await this.checkIsAnnualLeave(req.user._id, req.user.companyId, null, true, findFixedBallotingLeaveTypeObj.leaveTypeId);
    } else {
      isAnnualLeavePresent = await this.checkIsAnnualLeave(req.user._id, req.user.companyId, null, false);
    }

    if (isAnnualLeavePresent.status) {
      const alreadyApplied = await Ballot.findOne({
        _id: data.ballotId,
        isPublish: true,
      });
      if (alreadyApplied.isPublish && new Date().getTime() > new Date(alreadyApplied.applicationCloseDateTime).getTime()) {
        return res.status(201).json({
          success: false,
          message: "Balloting Exercise is closed, cannot submit now.",
        });
      }
      console.log("alreadyApplied.appliedStaff", alreadyApplied.appliedStaff);
      // //console.logs("Already apply are: ",alreadyApplied);
      //  req.user._id = "5a9973ae36ab4f444b42718b"
      for (var j = 0; j <= alreadyApplied.appliedStaff.length - 1; j++) {
        console.log("ahdygu");
        if (req.user._id.toString() === alreadyApplied.appliedStaff[j].userId.toString()) {
          let leaveIncrease = 5;
          if (alreadyApplied.leaveConfiguration === 2) {
            leaveIncrease = 6;
          } else if (alreadyApplied.leaveConfiguration === 3) {
            leaveIncrease = 7;
          } else if (alreadyApplied.leaveConfiguration === 4) {
            leaveIncrease = 1;
          }
          if (alreadyApplied.leaveType == 2) {
            leaveIncrease = 1;
          }
          const startDate = alreadyApplied.weekRange[alreadyApplied.appliedStaff[j].weekNo].start;
          const startYear = new Date(startDate).getFullYear();
          //const sapData = await StaffSapData.findOneAndUpdate({staff_Id: req.user._id}, {$inc: {ballotLeaveBalanced: leaveIncrease}});
          const sapData = await this.managePlanLeave(req.user._id, leaveIncrease, isAnnualLeavePresent.leaveTypeData, startYear);
        } else {
          //console.logs("Not similar one");
        }
      }
      const pullStaff = await Ballot.update({ _id: data.ballotId, "appliedStaff.userId": req.user._id }, { $pull: { appliedStaff: { userId: req.user._id } } });

      //console.logs("req.body.leaveConfiguration :", req.body.leaveConfiguration);
      console.log("hehehhe");
      for (let i = 0; i < req.body.slotNumber.length; i++) {
        let obj = {};
        const slotNumber = req.body.slotNumber[i];
        var startDate = alreadyApplied.weekRange[slotNumber].start;
        var startYear = new Date(startDate).getFullYear();
        let checkLeave = await this.checkIsLeavePresentMultiple(
          req.user._id,
          req.body.leaveConfiguration,
          alreadyApplied.leaveType,
          isAnnualLeavePresent.leaveTypeData,
          startYear
        );
        console.log("hehehhe");
        if (checkLeave) {
          if (req.body.userFrom === 1) {
            //console.logs('111');
            // //console.logs('111',alreadyApplied.userFrom);
            const opsGroupList = await OpsGroup.findOne(
              { userId: req.user._id, isDelete: false },
              {
                _id: 1,
                opsTeamId: 1,
              }
            );
            //  return res.send(opsGroupList)
            const opsTeamList = await OpsTeam.findOne(
              { userId: req.user._id, isDeleted: false },
              {
                _id: 1,
                opsGroupId: 1,
              }
            );
            if (opsTeamList || (opsGroupList && opsGroupList.opsTeamId.length === 0)) {
              if (opsGroupList.opsTeamId.length === 0) {
                //console.logs('ygdyug')
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsGroupList._id,
                };
              } else {
                obj = {
                  userId: req.user._id,
                  weekNo: slotNumber,
                  buId: req.user.parentBussinessUnitId,
                  opsGroupId: opsTeamList.opsGroupId,
                  opsTeamId: opsTeamList._id,
                };
              }
            } else {
              console.log("OPS AND OPS TEAM FAILED");
              failedArr.push(slotNumber);
              /* return res.status(400).json({
                             success: false,
                             message: 'You can not apply for slot as your not in any OPS team'
                         });*/
            }
          } else {
            obj = {
              userId: req.user._id,
              weekNo: slotNumber,
              buId: req.user.parentBussinessUnitId,
            };
          }
          // //console.logs('obj', obj)
          const apply = await Ballot.findOneAndUpdate({ _id: req.body.ballotId }, { $push: { appliedStaff: obj } });
          let leaveDecrease = 5;
          if (apply.leaveConfiguration === 2) {
            leaveDecrease = 6;
          } else if (apply.leaveConfiguration === 3) {
            leaveDecrease = 7;
          } else if (apply.leaveConfiguration === 4) {
            leaveDecrease = 1;
          }
          if (apply.leaveType == 2) {
            leaveDecrease = 1;
          }
          //const sapData = await StaffSapData.findOneAndUpdate({staff_Id: req.user._id}, {$inc: {ballotLeaveBalanced: -leaveDecrease}});
          // console.log("[][][][][------------------[][][][]][-----------[][][][][][][---------")
          // console.log(req.user._id)
          // console.log(isAnnualLeavePresent.leaveTypeData)
          // console.log(startYear)
          const sapData = await this.managePlanLeave(req.user._id, -1 * leaveDecrease, isAnnualLeavePresent.leaveTypeData, startYear);
          successArr.push(slotNumber);
          /*return res.status(201).json({
                    success: true,
                    message: 'Successfully Applied to slot',
                    sapData
                });*/
        } else {
          console.log("CHECK LEAVE FAILED");
          failedArr.push(slotNumber);
          // return res.status(400).json({
          //     success: false,
          //     successArr,
          //     alreadyArr,
          //     failedArr,
          //     message: 'You do not have leave to apply for slot'
          // });
          // break;
        }
      }
      return res.status(201).json({
        success: true,
        message: "Successfully Applied.",
        successArr,
        failedArr,
      });
    } else {
      return res.status(201).json({
        success: false,
        successArr,
        // alreadyArr,
        failedArr,
        message: "You do not have Annual Leave Type assigned",
      });
    }
  }

  async checkIsLeavePresentMultiple(userId, leave, type, leaveTypeData, startYear = new Date().getFullYear()) {
    //console.logs("LEAVE IN MUL:", leave);
    let howMany = 7;
    if (leave === 1) {
      howMany = 5;
    } else if (leave === 2) {
      howMany = 6;
    } else if (leave == 4) {
      howMany = 1;
    }

    if (type == 2) {
      howMany = 1;
    }

    // let staffLeave = await StaffSapData.findOne({staff_Id: id});
    //  //console.logs('staffLeave',staffLeave);
    const staffLevaeData = await staffLeave.findOne({
      userId: userId,
      leaveDetails: { "$elemMatch": { "year": startYear, leaveTypeId: leaveTypeData.leaveTypeId } }
    });
    if (staffLevaeData) {
      let leaveTypeDataNew = staffLevaeData.leaveDetails.filter((leave) => {
        return leave.leaveTypeId.toString() == leaveTypeData.leaveTypeId.toString() && leave.year == startYear;
      })[0];
      return (staffLevaeData && (howMany <= leaveTypeDataNew.planQuota));
    }
    return false;
  }

  async checkIsLeavePresent(id, leave) {
    let howMany = 7;
    if (leave === 1) {
      howMany = 5;
    } else if (leave === 2) {
      howMany = 6;
    }

    let staffLeave = await StaffSapData.findOne({ staff_Id: id });
    //console.logs('staffLeave', staffLeave);
    return staffLeave && howMany <= staffLeave.ballotLeaveBalanced;
  }

  async sapDataImport(req, res) {
    console.log('I am here')
    const bodyData = await this.getBodyData1(req);
    if (bodyData && bodyData.opsGroupDetails) {
      const userDataArr = bodyData.opsGroupDetails;
      const len = userDataArr.length;
      const finalData = [];
      const failedData = [];
      const successData = [];
      for (let i = 0; i < len; i++) {
        const user = userDataArr[i];
        const obj = {};
        const userData = await User.findOne({ staffId: user['Staff ID'].toLowerCase() }, { leaveGroupId: 1 }).populate([{
          path: "leaveGroupId",
          match: {
            isActive: true
          },
          select: "leaveType.leaveTypeId",
          populate: [{
            path: 'leaveType.leaveTypeId',
            match: {
              isActive: true,
              name: user['Leave Type']
            },
            select: 'name'
          }]
        }]);
        if (userData) {
          if (userData.leaveGroupId) {
            if (userData.leaveGroupId.leaveType && userData.leaveGroupId.leaveType.length > 0) {

              let leaveType = userData.leaveGroupId.leaveType.filter((leave) => {
                return leave && leave.leaveTypeId;// && leave.leaveTypeId.name == 'Annual Leave'
              });
              console.log('leaveType', leaveType)
              if (leaveType && leaveType.length > 0) {
                leaveType = leaveType[0];
                obj.userId = userData._id;
                obj.leaveGroupId = userData.leaveGroupId._id;
                obj.leaveTypeId = leaveType.leaveTypeId._id;
                obj.quota = parseInt(user.Value);
                obj.year = parseInt(user.Year);
                const staffLeaveData = await staffLeave.findOne({ userId: obj.userId });
                if (staffLeaveData) {
                  // const index = -1;
                  let index = staffLeaveData.leaveDetails.findIndex((le) => {
                    return le.leaveTypeId.toString() == obj.leaveTypeId && le.year == obj.year;
                  });
                  let leaveDetails = {};
                  if (index != -1) {
                    leaveDetails = staffLeaveData.leaveDetails[index];
                    //200-20 =  180
                    //20 -200 = -180
                    const inc = obj.quota - leaveDetails.total;
                    staffLeaveData.leaveDetails[index].total = obj.quota;
                    staffLeaveData.leaveDetails[index].request += inc;
                    staffLeaveData.leaveDetails[index].taken += inc;
                    staffLeaveData.leaveDetails[index].planDymanicQuota += inc;
                    staffLeaveData.leaveDetails[index].quota += inc;
                    staffLeaveData.leaveDetails[index].planQuota += inc;
                    const saveDD = await staffLeaveData.save()
                  } else {
                    leaveDetails = {
                      leaveTypeId: obj.leaveTypeId,
                      "request": 0,
                      "taken": 0,
                      "total": obj.quota,
                      "planDymanicQuota": obj.quota,
                      "planQuota": obj.quota,
                      "quota": obj.quota,
                      "year": obj.year
                    }
                    var newArray = staffLeaveData.leaveDetails.concat([leaveDetails])
                    staffLeaveData.leaveDetails = newArray
                    console.log('staffLeaveData.leaveDetails', staffLeaveData.leaveDetails.length)
                    //staffLeaveData.leaveDetails.push(leaveDetails)
                    const saveDD1 = await staffLeaveData.save()
                  }
                  successData.push(obj);
                } else {
                  user.message = 'Something went wrong';
                  failedData.push(user);
                }
              } else {
                user.message = 'Leave Type not found';
                failedData.push(user);
              }

            } else {
              user.message = 'Leave Group Does not have any leave type';
              failedData.push(user);
            }

          } else {
            user.message = 'Leave Group Not found';
            failedData.push(user);
          }

        } else {
          user.message = 'failed as no staff found for staff Id';
          failedData.push(user);
        }
        finalData.push(userData)
      }
      let msg = failedData.length > 0 ? 'Some staff Id Failed' : 'All Processed Successfully';
      return res.json({ message: msg, success: true, failedData: failedData, success: successData })
    } else {
      return res.json({ success: false, message: "Proper Data not found in file" })
    }

    /* let asyncIndex = 0;
     if(bodyData){
         await async.eachSeries(
             bodyData.opsGroupDetails, (item, next) => {
                 let opsData = item;
   
                 console.log("ITEM IS: ",opsData['Staff name']);
                 if(opsData['Ops Group Name']==""||opsData['Admin Name']==""){
                     console.log("no datato save");
                     next();
                 }
                 if(opsData['Ops Group Name']==undefined||opsData['Admin Name']==undefined){
                     console.log("no datato save");
                     next();
                 }
   
                 var parentBuArr = opsData['Staff Parent Bu'].split('>');
                 let parentBu = parentBuArr[3].trim();
                 console.log("parentBuArr: ",parentBu);
   
                 SubSection.findOne({name:parentBu}).then((Bu)=>{
                     console.log("BU is:");
                     User.findOne({name:opsData['Admin Name']}).then((user)=>{
                         console.log("user found",user.name);
   
                             console.log("USERID IS: ",user._id);
                             OpsGroupSystemAdmin.findOne({userId:user._id}).then((systemAdminData)=>{
                                 console.log("Syestem admin found",systemAdminData.buId,"and BUID is : ",Bu._id);
                                 let ifHas = checkIfHasId(systemAdminData.buId,Bu._id)
                                 console.log("IDHAS IS: ",ifHas);
                                 if(ifHas == true){
                                     console.log("FOUND IN systemAdminData");
                                     User.findOne({staffId:opsData['Staff Id']}).
                                     populate({path:'parentBussinessUnitId',select:'name'}).then((staff)=>{
                                         console.log("FOUND STAFF BY ID: ",staff._id);
                                         if(staff.name !== opsData['Staff name']){
                                           console.log("IN CHECK IF STAFF ID AND NAME DOES NOT MATCH");
                                             var logObj={message:"StaffId and Staff name does not match",
                                             adminName:opsData['Admin Name'],
                                             adminId:user._id,
                                             userName:opsData['Staff name'],
                                             opsGroupName:opsData['Ops Group Name'],
                                             opsTeamName:opsData['Ops Team Name']
                                           }
                                           var log = new opsLog(logObj);
                                           let lg= log.save();
                                           next();
                                         }else{
                                             OpsGroup.find({userId:staff._id}).then((ops)=>{
                                                 if(ops.length>0){
   
                                                     var logObj={
                                                     message:"This Staff is already exists in some other ops group",
                                                    adminName:opsData['Admin Name'],
                                                     adminId:user._id,
                                                     userName:opsData['Staff name'],
                                                     opsGroupName:opsData['Ops Group Name'],
                                                     opsTeamName:opsData['Ops Team Name']
                                                  }
                                                  var log = new opsLog(logObj);
                                                  let lg= log.save();
                                                  next();
                                                 }else{
                                                     console.log("IN ELSE OF IF OPS GROUP HAS THAT STAFF");
                                                     OpsGroup.findOne({opsGroupName:opsData['Ops Group Name']}).then(opsgroup=>{
                                                         if(opsData['Ops Team Name']!=="" && opsData['Ops Team Name']!==undefined){
                                                             console.log("IN IF OF FINDING SIMILAR OPS GROUP WITH ITS NAME:");
                                                             if(opsgroup.opsTeamId.length>0){
   
                                                                 OpsTeam.findOne({name:opsData['Ops Team Name']}).then(team=>{
                                                                     OpsGroup.update({"_id":opsgroup._id},{"$push":{"userId":staff._id}},function(err,updatedops){
                                                                         if(!err){
                                                                             OpsTeam.update({"_id":team._id},{"$push":{"userId":staff._id}},function(err,opsteam){
                                                                                 if (!err){
                                                                                     console.log("UPDATED",opsgroup,"And OPS TEAM IS: ",team);
                                                                                     next();
                                                                                 }else{
                                                                                     console.log("couldn't update in opsteam .")
                                                                                     next();
                                                                                 }
                                                                             });
                                                                         }else{
                                                                             console.log("couldn't update in ops group.")
                                                                             next();
                                                                         }
                                                                     });
   
   
                                                                 }).catch(err=>{
   
                                                                 var logObj={
                                                                 message:"Cannot find specified team.",
                                                                 adminName:opsData['Admin Name'],
                                                                 adminId:user._id,
                                                                 userName:opsData['Staff name'],
                                                                 opsGroupName:opsData['Ops Group Name'],
                                                                 opsTeamName:opsData['Ops Team Name']
                                                                }
                                                                var log = new opsLog(logObj);
                                                                 let lg= log.save();
                                                                 next();
                                                               })
   
   
                                                             }else{
                                                                 //This ops group dont have teams
                                                                 console.log("IN ELSE OF THERE IS NO TEAM IN OPS GROP ALSO UPDATING HERE");
                                                                 console.log("iF TEAM LENGTH IS GREATER THAN 0");
                                                                 var logObj={
                                                                 message:"This Ops Group does not contain any Team. Cannot add Staff to ops group.",
                                                                 adminName:opsData['Admin Name'],
                                                                 adminId:user._id,
                                                                 userName:opsData['Staff name'],
                                                                 opsGroupName:opsData['Ops Group Name'],
                                                                 opsTeamName:opsData['Ops Team Name']
                                                                }
                                                              var log = new opsLog(logObj);
                                                              let lg= log.save();
                                                              next();
                                                             }
                                                         }else{
   
                                                             // console.log("HERE IN UPDATION OF ELSE")
                                                             if(opsgroup.opsTeamId.length>0){
                                                              console.log("ELSE OF ELSE YEP YEP");
                                                                 var logObj={
                                                                 message:"Please specify Team To add this staff. This Ops group contains Teams",
                                                                 adminName:opsData['Admin Name'],
                                                                 adminId:user._id,
                                                                 userName:opsData['Staff name'],
                                                                 opsGroupName:opsData['Ops Group Name'],
                                                                 opsTeamName:opsData['Ops Team Name']
                                                              }
                                                              var log = new opsLog(logObj);
                                                              let lg= log.save();
                                                              next();
                                                             }else{
                                                                 console.log("FOUND MORE THAN 0 TEAMS SECOND ELSE ME AND UPDATING");
                                                                 var logObj={
                                                                     message:"Please specify Team To add this staff.",
                                                                     adminName:opsData['Admin Name'],
                                                                     adminId:user._id,
                                                                     userName:opsData['Staff name'],
                                                                     opsGroupName:opsData['Ops Group Name'],
                                                                     opsTeamName:opsData['Ops Team Name']
                                                                  }
                                                                  var log = new opsLog(logObj);
                                                                  let lg= log.save();
                                                                  next();
   
                                                           }
                                                         }
   
                                                     }).catch(err=>{
                                                         console.log("not able to find Opsgroup by its name");
                                                         next();
                                                     })
                                                 }
   
                                             }).catch((err)=>{
   
                                                  var logObj={
                                                   message:"Unable to find matching ops group",
                                                 adminName:opsData['Admin Name'],
                                                  adminId:user._id,
                                                  userName:opsData['Staff name'],
                                                  opsGroupName:opsData['Ops Group Name'],
                                                  opsTeamName:opsData['Ops Team Name']
                                               }
                                               var log = new opsLog(logObj);
                                               let lg= log.save();
                                               next();
                                             })
   
                                         }
                                     }).catch((err)=>{
   
                                         var logObj={
                                         message:"Couldent find mathing Staff, please check staffId",
                                         adminName:opsData['Admin Name'],
                                         adminId:user._id,
                                         userName:opsData['Staff name'],
                                         opsGroupName:opsData['Ops Group Name'],
                                         opsTeamName:opsData['Ops Team Name']
                                       }
                                       var log = new opsLog(logObj);
                                       let lg= log.save();
                                       next();
                                     })
   
                                 }else{
   
                                       var logObj={message:"This Admin can not add any user from requested BU id.",
                                       adminName:opsData['Admin Name'],
                                       adminId:user._id,
                                       userName:opsData['Staff name'],
                                       opsGroupName:opsData['Ops Group Name'],
                                       opsTeamName:opsData['Ops Team Name']
                                     }
                                     var log = new opsLog(logObj);
                                     let lg= log.save();
                                     next();
                                 }
   
   
                         }).catch((err)=>{
                             console.log("In system admin catch");
   
                             next();
                         })
   
   
                     }).catch((err)=>{
                         console.log("FOUND BU ELSE");
   
                         var logObj={message:"Admin not found.",opsGroupName:opsData['Ops Group Name'],
                         opsTeamName:opsData['Ops Team Name']};
                         var log = new opsLog(logObj);
                         let lg= log.save();
                         next();
   
                     })
                 }).catch((err)=>{
                     console.log("FOUND BU ELSE");
   
                     var logObj={message:"Business Unit not found.",opsGroupName:opsData['Ops Group Name'],
                     opsTeamName:opsData['Ops Team Name']};
                     var log = new opsLog(logObj);
                     let lg= log.save();
                     next();
                 });
   
   
         })
         res.json({status: true, code: 0, message:'Successfully Uploaded File'});
     }
     else{
         res.json({status: false, code: 1, message:'Something went wrong, Try to Reupload file.'});
     } */
  }
  async getBodyData1(req) {
    return new Promise((resolve, reject) => {
      var form = new multiparty.Form();

      form.parse(req, function (err, fields, files) {

        const pathCSV = files.ff[0].path;

        csv()
          .fromFile(pathCSV)
          .then((jsonObj) => {
            // console.log("jsonObj: ",jsonObj);
            const dataRequiredObj = {
              // opsGroupData: JSON.parse(fields.ops[0]),
              opsGroupDetails: jsonObj
            };

            resolve(dataRequiredObj);
          }).catch((err) => {
            reject(null);
          });
      });
    });
  }
  async sendResponse(data, res, failed, req) {
    try {
      //console.logs('data', data)
      const dataLength = data.length;
      for (let i = 0; i < dataLength; i++) {
        let item = data[i];
        //  //console.logs('i,i', item);
        if (item) {
          //  //console.logs('i', i)
          const result = await StaffSapData.findOne({
            staff_Id: item.staff_Id,
          });
          // //console.logs('result', result)
          if (!result) {
            //console.logs('not found')
            await new StaffSapData(item).save();
          } else {
            // //console.logs('i', i)
            const increaseLeave = result.leavesBalanced + parseInt(item.leavesBalanced);
            const ballotLeaveBalanced = result.ballotLeaveBalanced + parseInt(item.leavesBalanced);
            const newResult = await StaffSapData.findOneAndUpdate(
              { staff_Id: item.staff_Id },
              {
                $set: {
                  leavesAvailed: item.leavesAvailed,
                  // leavesBalanced: item.leavesBalanced,
                  leavesBalanced: increaseLeave,
                  leavesEntitled: item.leavesEntitled,
                  ballotLeaveBalanced: ballotLeaveBalanced,
                },
              }
            );
            ////console.logs(item);
          }
        }
      }
      //console.logs('i', 4);
      return res.json({ status: true, message: "Data Successfully imported" });
    } catch (e) {
      return res.json({
        status: false,
        message: "Data Not Successfully imported",
        e,
      });
    }
  }

  parseBodyData(req) {
    return new Promise((resolve, reject) => {
      var form = new multiparty.Form();
      form.parse(req, function (err, fields, files) {
        //console.logs("FILES:", files);
        const pathCSV = files.ff[0].path;
        csv()
          .fromFile(pathCSV)
          .then((jsonObj) => {
            const dataRequiredObj = {
              staffDetails: jsonObj,
            };
            resolve(dataRequiredObj);
          })
          .catch((err) => {
            reject(null);
          });
      });
    });
  }

  async staffCancelSlot(req, res) {
    try {
      const data = req.body;
      //console.logs('re', req.user._id);

      const leaveTypeData = await this.checkIsAnnualLeave(req.user._id, req.user.companyId);
      if (leaveTypeData.status) {
        const ballotData = await Ballot.findOne({
          _id: data.ballotId,
          "appliedStaff.userId": req.user._id,
          "appliedStaff.weekNo": data.slotNumber,
        });

        if (ballotData) {
          if (new Date(ballotData.applicationCloseDateTime).getTime() > new Date().getTime()) {
            const pullStaff = await Ballot.update(
              {
                _id: data.ballotId,
                "appliedStaff.userId": req.user._id,
                "appliedStaff.weekNo": data.slotNumber,
              },
              {
                $pull: {
                  appliedStaff: {
                    userId: req.user._id,
                    weekNo: data.slotNumber,
                  },
                },
              }
            );

            const pushStaff = await Ballot.update(
              { _id: data.ballotId },
              {
                $push: {
                  deletedStaff: {
                    userId: req.user._id,
                    weekNo: data.slotNumber,
                  },
                },
              }
            );
            if (pullStaff.nModified > 0) {
              let leave = 5;
              if (ballotData.leaveConfiguration === 2) {
                leave = 6;
              } else if (ballotData.leaveConfiguration === 3) {
                leave = 7;
              } else if (ballotData.leaveConfiguration === 4) {
                leave = 1;
              }

              if (ballotData.leaveType == 2) {
                leave = 1;
              }
              const startDate = ballotData.weekRange[data.slotNumber].start;
              const startYear = new Date(startDate).getFullYear();
              const sapData = await this.managePlanLeave(req.user._id, leave, leaveTypeData.leaveTypeData, startYear);
              //const updateLeave = await StaffSapData.update({staff_Id: req.user._id}, {$inc: {ballotLeaveBalanced: leave}});
            }

            return res.status(201).json({ success: true, message: "Successfully Canceled" });
          }
          return res.status(400).json({
            success: false,
            message: "Can not Cancel slot as ballot is closed",
          });
        } else {
          return res.status(400).json({ success: false, message: "Ballot Not found" });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Annual Leave Type is not present",
        });
      }
    } catch (e) {
      return res.status(500).json({ success: false, message: "Something went wrong" });
    }
  }

  async annualLeave(req, res) {
    try {
      console.log("I am gere", req.user._id);
      let year = req.body.year;
      if (!year) {
        year = new Date().getFullYear()
      }
      let leaveTypeData;

      const findFixedBallotingLeaveTypeObj = await Ballot.findOne({ _id: req.body.ballotId, isPublish: true });

      if (findFixedBallotingLeaveTypeObj !== null && findFixedBallotingLeaveTypeObj.fixedBallotingLeaveType) {
        leaveTypeData = await this.checkIsAnnualLeave(req.user._id, req.user.companyId, year, true, findFixedBallotingLeaveTypeObj.leaveTypeId);
      } else {
        leaveTypeData = await this.checkIsAnnualLeave(req.user._id, req.user.companyId, year, false);
      }

      if (leaveTypeData.status) {
        const leaveData = leaveTypeData.leaveTypeData;
        let data = {
          leavesBalanced: leaveData.total,
          ballotLeaveBalanced: leaveData.planQuota,
          leavesAvailed: leaveData.total - leaveData.planQuota,
        };
        return res.json({ success: true, data: data });
      } else {
        let data = {
          leavesBalanced: 0,
          ballotLeaveBalanced: 0,
          leavesAvailed: 0,
        };
        return res.json({ success: false, data: data });
      }

      //return res.json({status: true, data: annualData});
    } catch (e) {
      return res.status(400).json({
        success: false,
        data: e,
        // error:e,
        message: "Something went wrong",
      });
      //return res.json({status: false, data: null, message:'Something went wrong', e})
    }
  }

  async userList(req, res) {
    try {
      console.log('req.body', req.body);
      if (req.body.isOpsGroup) {
        if (req.body.opsGroupId && req.body.opsGroupId.length > 0) {
          let opsGroupInfo = await OpsGroup.find({
            _id: { $in: req.body.opsGroupId },
          })
            .select("opsTeamId userId buId opsGroupName")
            .populate([
              {
                path: "opsTeamId",
                select: "name userId buId",
              },
              {
                path: "userId",
                select: "_id parentBussinessUnitId name staffId contactNumber email profilePicture",
                populate: [{
                  path: "parentBussinessUnitId",
                  select: "orgName"
                }]
              },
            ])
            .lean();
          //console.logs('opsGroupInfo', opsGroupInfo)
          opsGroupInfo = JSON.stringify(opsGroupInfo);
          opsGroupInfo = JSON.parse(opsGroupInfo);
          const userInfo = [];
          for (let i = 0; i < opsGroupInfo.length; i++) {
            const opsItem = opsGroupInfo[i];
            opsItem.opsTeamId.forEach((teamItem) => {
              teamItem.userId.forEach((userItem) => {
                opsItem.userId.forEach((opsGroupUser, index) => {
                  //console.logs(opsGroupUser, userItem)
                  if (opsGroupUser._id == userItem) {
                    opsGroupInfo[i].userId[index].opsTeam = teamItem.name;
                    opsGroupInfo[i].userId[index].opsTeamId1 = teamItem._id;
                  }
                  opsGroupInfo[i].userId[index].opsGroupName = opsGroupInfo[i].opsGroupName;
                  opsGroupInfo[i].userId[index].opsGroupId = opsGroupInfo[i]._id;
                });
              });
            });

            opsItem.userId.forEach((opsGroupUser, index) => {
              opsGroupInfo[i].userId[index].opsGroupName = opsGroupInfo[i].opsGroupName;
              opsGroupInfo[i].userId[index].opsGroupId = opsGroupInfo[i]._id;
              userInfo.push(opsGroupInfo[i].userId[index]);
            });
          }
          return res.status(201).json({
            success: true,
            data: userInfo,
          });
          // return res.json({status: true, data: userInfo});
        } else {
          return res.status(400).json({
            success: false,
            data: e,
            message: "Please send Ops Group Id",
          });
          // return res.json({status: false, data: null, message: 'Please send Ops Group Id'});
        }
      } else {
        if (req.body.buId && req.body.buId.length > 0) {
          let userInfo = await User.find({
            parentBussinessUnitId: { $in: req.body.buId },
            status: 1,
          })
            .select("_id parentBussinessUnitId name staffId email contactNumber profilePicture")
            .populate([
              {
                path: "parentBussinessUnitId",
                select: "orgName"
              },
            ])
            .lean();
          userInfo = JSON.parse(JSON.stringify(userInfo))
          for (let i = 0; i < userInfo.length; i++) {
            const uid = userInfo[i]._id;
            let opsGroupInfo = await OpsGroup.findOne({
              userId: uid, isDelete: false
            }).select("opsGroupName opsTeamId").populate([
              {
                path: "opsTeamId",
                select: "name userId",
              }]);
            userInfo[i].opsGroupName = opsGroupInfo ? opsGroupInfo.opsGroupName : "";
            opsGroupInfo?.opsTeamId.forEach((element) => {
              if(element.userId.includes(uid)){
                userInfo[i].opsTeam = element.name;
              }
            })
          }
          return res.status(201).json({
            success: true,
            data: userInfo,
          });
          //return res.json({status: true, data: userInfo});
        } else {
          return res.status(400).json({
            success: false,
            data: e,
            message: "Please send BUId",
          });
          // return res.json({status: false, data: null, message: 'Please send BUId'});
        }
      }
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: "Something went wrong",
      });
      // return res.json({status: false, data: null, message:'Something went wrong', e})
    }
  }

  async run(req, res) {
    // find ballot
    // get userID weekwise applied
    //
  }

  async delete(req, res) {
    try {
      // const id = req.params.id;
      //const data = req.body;
      //  //console.logs('daataaaa', data)
      if (req.body.isDeleted) {
        const data = await Ballot.update({ _id: req.body.id }, { companyId: req.user.companyId, isDeleted: true });
        this.deleteEvent(req.body.id).then((re)=>{
          console.log('deleted ballot cron')
        })
        return res.json({
          success: true,
          message: "Ballot deleted successfully",
        });
      } else {
        const data = await Ballot.update({ _id: req.body.id }, { companyId: req.user.companyId, isCanceled: true });
        this.deleteEvent(req.body.id).then((re)=>{
          console.log('deleted ballot cron')
        })
        return res.json({
          success: true,
          message: "Ballot canceled successfully",
        });
      }
    } catch (e) {
      return res.json({ success: false, message: "Something went wrong" });
    }
  }
  /*
    async update(req, res) {
      try {
        //console.logs("in update");
        const id = req.body.id;
        delete req.body.id;
        //console.logs('req.body.id', req.body)
        if (req.body.leaveType == 2) {
          req.body.leaveConfiguration = 4;
        }
        req.body.applicationOpenDateTime = `${req.body.openDate} ${req.body.openTime} ${req.body.timeZone}`
        req.body.applicationCloseDateTime = `${req.body.closeDate} ${req.body.closeTime} ${req.body.timeZone}`
        console.log(" req.body.applicationOpenDateTime",  req.body.applicationOpenDateTime);
        req.body.applicationOpenDateTime = moment(req.body.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
        req.body.applicationCloseDateTime = moment(req.body.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
  
  
      if (req.body.resultRelease == "1") {
        req.body.resultReleaseDateTime = `${req.body.resultReleaseDate} ${req.body.resultReleaseTime} ${data.timeZone}`
        req.body.resultReleaseDateTime = moment(req.body.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
        }
        const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);
        sendBallotEditNotification(data);
        return res.json({
          success: true,
          message: "Ballot Updated successfully",
        });
      } catch (e) {
        return res.json({ success: false, message: "Something went wrong" });
      }
    }
    async updateCasual(req, res) {
      try {
        //console.logs("in update");
        const id = req.body.id;
        delete req.body.id;
        //console.logs('req.body.id', req.body)
        req.body.applicationOpenDateTime = `${req.body.openDate} ${req.body.openTime} ${req.body.timeZone}`
        req.body.applicationCloseDateTime = `${req.body.closeDate} ${req.body.closeTime} ${req.body.timeZone}`
        console.log(" req.body.applicationOpenDateTime",  req.body.applicationOpenDateTime);
        req.body.applicationOpenDateTime = moment(req.body.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
        req.body.applicationCloseDateTime = moment(req.body.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
  
  
      if (req.body.resultRelease == "1") {
        req.body.resultReleaseDateTime = `${req.body.resultReleaseDate} ${req.body.resultReleaseTime} ${data.timeZone}`
        req.body.resultReleaseDateTime = moment(req.body.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
        }
        const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);
        sendBallotEditNotification(data);
        return res.json({
          success: true,
          message: "Ballot Updated successfully",
        });
      } catch (e) {
        return res.json({ success: false, message: "Something went wrong" });
      }
    }
    remove till here
    */

  async update(req, res) {
    try {
      //console.logs("in update");
      const id = req.body.id;
      delete req.body.id;
      //console.logs('req.body.id', req.body)
      if (req.body.leaveType == 2) {
        req.body.leaveConfiguration = 4;
      }
      const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);
      if(!data.isDraft){
      this.ballotEvent(data, 'update', true);
      }
      sendBallotEditNotification(data);
      return res.json({
        success: true,
        message: "Ballot Updated successfully",
      });
    } catch (e) {
      return res.json({ success: false, message: "Something went wrong" });
    }
  }
  async updateCasual(req, res) {
    try {
      //console.logs("in update");
      const id = req.body.id;
      delete req.body.id;
      //console.logs('req.body.id', req.body)
      const data = await Ballot.findOneAndUpdate({ _id: id }, req.body);
      if(!data.isDraft){
        this.ballotEvent(data, 'update', true);
        }
      sendBallotEditNotification(data);
      return res.json({
        success: true,
        message: "Ballot Updated successfully",
      });
    } catch (e) {
      return res.json({ success: false, message: "Something went wrong" });
    }
  }
  async getballotAdmins(req, res) {
    try {
      let planBuObj = await User.findOne(
        { _id: req.user._id },
        {
          planBussinessUnitId: 1,
          _id: 0,
        }
      ).populate([
        {
          path: "planBussinessUnitId",
          select: "_id",
          match: {
            status: 1,
          },
        },
      ]);
      var plabBuArr = [];
      planBuObj.planBussinessUnitId.forEach((item) => {
        plabBuArr.push(item._id);
      });
      //return res.json({status: true, data: plabBuArr});
      if (plabBuArr && plabBuArr.length > 0) {
        var adminList = await User.find(
          { parentBussinessUnitId: { $in: plabBuArr } },
          {
            name: 1,
            status: 1,
          }
        );
        return res.json({ status: true, data: adminList });
      } else {
        return res.json({ status: false, data: "no admin found" });
      }
    } catch (e) {
      return res.json({
        status: false,
        data: null,
        message: "Something went wrong",
        e,
      });
    }
  }

  async leaveBallotSetting(req, res) {
    try {
      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select("opsGroup")
        .lean();

      if (!pageSettingData) {
      }

      return __.out(res, 201, pageSettingData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async winBallotForStaff(req, res) {
    try {
      const ballotId = req.params.id;
      //console.logs('ballotId', ballotId)
      let ballotResult = await Ballot.findOne({
        _id: ballotId,
        isPublish: true,
      });
      if (ballotResult) {
        // result for BU
        let totalDeducated = 5;
        if (ballotResult.leaveConfiguration === 2) {
          totalDeducated = 6;
        } else if (ballotResult.leaveConfiguration === 3) {
          totalDeducated = 7;
        }
        if (ballotResult.leaveType == 2) {
          totalDeducated = 1;
        }
        if (ballotResult.userFrom === 2) {
          ballotResult = JSON.stringify(ballotResult);
          ballotResult = JSON.parse(ballotResult);
          ////console.logs('ballotResult', ballotResult);
          let shuffle = [];
          shuffle = ballotResult.slotCreation;
          ballotResult.appliedStaff.forEach((appliedStaff) => {
            const indexOfBu = ballotResult.slotCreation.findIndex((x) => x.buId === appliedStaff.buId);
            if (shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
            } else {
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
              shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
            }
          });
          let finalWinStaff = [];
          shuffle.forEach((staffShuffle) => {
            staffShuffle.arr.forEach((slotWise) => {
              const howMuchWin = slotWise.value;

              if (slotWise.appliedStaff && slotWise.appliedStaff.length <= howMuchWin) {
                finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
              } else if (slotWise.appliedStaff) {
                const randomStaff = this.getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                randomStaff.forEach((randomSelectedStaff) => {
                  finalWinStaff.push(slotWise.appliedStaff[randomSelectedStaff]);
                });
                //console.logs('slotWise.appliedStaff.length', slotWise.appliedStaff.length, howMuchWin, randomStaff)
              }
            });
          });
          const updateWin = await Ballot.findOneAndUpdate(
            { _id: ballotId },
            {
              $set: {
                wonStaff: finalWinStaff,
                isResultRelease: true,
              },
            }
          );
          this.insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
          this.unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
          return res.status(200).json({
            success: true,
            message: "Result release successfully",
            finalWinStaff,
          });
        } else {
          // for ops group
          ballotResult = JSON.stringify(ballotResult);
          ballotResult = JSON.parse(ballotResult);
          ////console.logs('ballotResult', ballotResult);
          let shuffle = [];

          const opsGroupQuota = [];
          shuffle = ballotResult.slotCreation;
          let appliedStaffArray = [];
          for (let i = 0; i < ballotResult.slotCreation.length; i++) {
            const opsGroupSlot = ballotResult.slotCreation[i];
            // get quato for ops group
            // get quato for team
            let slotValue = {
              opsGroupId: opsGroupSlot.opsGroup.opsId,
              slotQuota: [],
            };
            opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
              ////console.logs('aaaaaaaa');
              let key = "" + arrIndex + "A";
              let slotNumber = arrIndex;
              let slotOpsGroupValue = parseInt(opsGroupSlot.weekRangeSlot[key].value);
              //opsGroupQuato.push({value:opsGroupSlot.weekRangeSlot[key].value, key});
              const teamValue = [];
              let totalTeamQuota = 0;
              opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
                ////console.logs('aaaaaaaa');
                let key = 'OG' + arrIndex +'OT' + teamIndex;
                totalTeamQuota = totalTeamQuota + parseInt(opsGroupSlot.weekRangeSlot[key].value);
                teamValue.push(parseInt(opsGroupSlot.weekRangeSlot[key].value));
              });
              const obj = {
                slot: slotNumber,
                opsGroupQuotaValue: slotOpsGroupValue,
                opsTeamQuotaValue: teamValue,
                totalTeamQuota,
              };
              slotValue.slotQuota.push(obj);
            });
            ////console.logs('aauued', slotValue)
            opsGroupQuota.push(slotValue);
            ////console.logs('yyegwb');
            ////console.logs('aaaa', groupBy(ballotResult.appliedStaff,'weekNo'));
            let appliedStaffObject = {};
            appliedStaffObject = groupBy(ballotResult.appliedStaff, "opsTeamId");
            ////console.logs('appliedStaffObject', appliedStaffObject)
            //return res.send(ballotResult.appliedStaff)
            /* for(let keyyy in appliedStaffObject){
                             const ayaya = groupBy(appliedStaffObject[keyyy],'weekNo');
                             appliedStaffArray.push(ayaya);
                         }*/
            const opsGroupSlotWithTeam = {
              opsGroupId: opsGroupSlot.opsGroup.opsId,
              opsTeamValue: [],
            };
            //console.logs('yyegwbaaa');
            if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
              opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
                if (appliedStaffObject[teamItem._id]) {
                  const ayaya = groupBy(appliedStaffObject[teamItem._id], "weekNo");
                  opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
                } else {
                  opsGroupSlotWithTeam.opsTeamValue.push({});
                }
              });
            } else {
              //console.logs('no temmmm');
              const ayaya = groupBy(appliedStaffObject["undefined"], "weekNo");
              opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
            }
            ////console.logs('hgfgetgt')
            appliedStaffArray.push(opsGroupSlotWithTeam);
            /*groupBy(ballotResult.appliedStaff, function(item)
                        {
                            return [item.weekNo, item.opsTeamId];
                        });*/
          }

          ////console.logs('aaaaaaaa');
          function groupBy(xs, key) {
            return xs.reduce(function (rv, x) {
              (rv[x[key]] = rv[x[key]] || []).push(x);
              return rv;
            }, {});
          }
          /* function groupBy( array , f )
                     {
                         var groups = {};
                         array.forEach( function( o )
                         {
                             var group = JSON.stringify( f(o) );
                             groups[group] = groups[group] || [];
                             groups[group].push( o );
                         });
                         return Object.keys(groups).map( function( group )
                         {
                             return groups[group];
                         })
                     }*/

          let limitQuota = [];
          let finalWinStaff = [];
          ////console.logs('aaaaaaaa');
          opsGroupQuota.forEach((item, topIndex) => {
            ////console.logs('aaa')
            let objA = {
              opsGroupId: item.opsGroupId,
            };
            item.slotQuota.forEach((slll) => {
              objA.slot = slll.slot;
              if (slll.opsTeamQuotaValue.length === 0) {
                objA.isTeamPresent = false;
                objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
                // //console.logs('callleddd');
                if (appliedStaffArray[topIndex].opsTeamValue[0] && appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]) {
                  if (slll.opsGroupQuotaValue >= appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length) {
                    finalWinStaff = finalWinStaff.concat(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]);
                  } else {
                    const randomStaff = this.getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length, slll.opsGroupQuotaValue);
                    randomStaff.forEach((ppp) => {
                      finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot][ppp]);
                    });
                  }
                }

                // const randomStaff = this.getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
              } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
                // all team quota should win
                slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                  if (
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                  ) {
                    //console.logs('bbb');
                    const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length;
                    //console.logs('len', len, slll.slot, p);
                    // p means no of win
                    // len means no of applied
                    if (len > p) {
                      const randomStaff = this.getRandomNumber(len, p);
                      //console.logs('randomStaff', randomStaff);
                      randomStaff.forEach((randomSelectedStaff) => {
                        finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][randomSelectedStaff]);
                      });
                    } else {
                      for (let x = 0; x < len; x++) {
                        finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][x]);
                      }
                    }
                  }
                  //const randomStaff = this.getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                });
              } else {
                // if ops group quota value is less then total team quota
                let allAppliedStaff = [];
                slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                  ////console.logs('topIndexppppppp', topIndex, opsTeamQuotaValueIndex);
                  if (
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                    appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                  ) {
                    //console.logs('aaaaeee');
                    if (p >= appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length) {
                      // //console.logs('hh', appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot])
                      allAppliedStaff = allAppliedStaff.concat(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]);
                    } else {
                      //console.logs('thiselseworkssss')
                      const randomStaff = this.getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length, p);
                      randomStaff.forEach((ppp) => {
                        allAppliedStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][ppp]);
                      });
                    }
                    /*       //console.logs('bbb');
                                        const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot].length;
                                        //console.logs('len', len, slll.slot, p);
                                        // p means no of win
                                        // len means no of applied
                                        if(len>p) {
                                            const randomStaff = this.getRandomNumber(len, p);
                                            //console.logs('randomStaff', randomStaff);
                                            randomStaff.forEach((randomSelectedStaff)=>{
                                                finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][randomSelectedStaff])
                                            });
                                        }else {
                                            for(let x=0; x<len; x++){
                                                finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][x]);
                                            }
                                        }*/
                  }

                  //const randomStaff = this.getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
                });
                if (allAppliedStaff.length > 0) {
                  //console.logs('ahugwgg')
                  const finalAppliedStaff = [];
                  const randomStaff = this.getRandomNumber(allAppliedStaff.length, allAppliedStaff.length);
                  //console.logs('randomStaff', randomStaff, allAppliedStaff.length);
                  randomStaff.forEach((ppp) => {
                    finalAppliedStaff.push(allAppliedStaff[ppp]);
                  });
                  const finalRandomStaff = this.getRandomNumber(allAppliedStaff.length, slll.opsGroupQuotaValue);
                  //console.logs('finalRandomStaff', finalRandomStaff)
                  //console.logs('sdhfys', allAppliedStaff.length, finalRandomStaff, slll.opsGroupQuotaValue);
                  finalRandomStaff.forEach((ppp) => {
                    finalWinStaff.push(finalAppliedStaff[ppp]);
                  });
                }
              }
            });
          });

          const updateWin = await Ballot.findOneAndUpdate(
            { _id: ballotId },
            {
              $set: {
                wonStaff: finalWinStaff,
                isResultRelease: true,
              },
            }
          );
          this.insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
          this.unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
          return res.status(200).json({
            success: true,
            message: "Result release successfully",
            finalWinStaff,
          });

          // return res.status(200).json({
          //     success:true,
          //     opsGroupQuota,
          //     appliedStaffArray,
          //     finalWinStaff
          // });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Ballot not found",
        });
      }
    } catch (e) {
      return res.status(500).json({
        status: false,
        data: null,
        message: "Something went wrong",
        e,
      });
    }
  }
  async insertStaffLeaveForBallot(finalWinStaff, ballot, totalDeducated) {
    //userId, weekNo,
    // yyyy-mm-dd
    const finalLeave = [];
    for (let i = 0; i < finalWinStaff.length; i++) {
      const staffWon = finalWinStaff[i];
      const userId = staffWon.userId;
      const leaveTypeData = await this.checkIsAnnualLeave(userId, ballot.companyId);
      if (leaveTypeData.status) {
        const slotWon = staffWon.weekNo;
        const slotArr = ballot.weekRange;
        const slotValue = slotArr[slotWon];
        let startDate = moment(slotValue.start); //.format('DD-MM-YYYY');
        console.log("startDate", startDate);
        let endDate = moment(slotValue.end);
        const diff = endDate.diff(startDate, "days") + 1;
        console.log("diff", diff);
        let leaveTypeId = leaveTypeData.leaveTypeData.leaveTypeId;
        let leaveGroupId = leaveTypeData.leaveGroupId;
        let parentBussinessUnitId = leaveTypeData.businessUnitId;
        const obj = {
          ballotId: ballot._id,
          userId,
          startDate,
          endDate,
          leaveTypeId: leaveTypeId,
          leaveGroupId: leaveGroupId,
          remark: "Won by Ballot(Result Release)",
          timeZone: ballot.timeZone,
          totalDay: diff,
          totalDeducated: totalDeducated,
          totalRestOff: diff - totalDeducated,
          businessUnitId: parentBussinessUnitId,
          status: 4,
          submittedFrom: 4,
        };
        finalLeave.push(obj);
        //const saveLeave = new LeaveApplied(obj).save();
      } else {
        // failed to won as anuual leave is not present
      }
    }
    const finalLeavePush = await Ballot.findOneAndUpdate({ _id: ballot._id }, { $set: { staffLeave: finalLeave } });
  }
  async unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId) {
    //console.logs('ballotId', ballotId)
    const ballotData = await Ballot.findOne({ _id: ballotId });
    let leave = 5;
    if (ballotData.leaveConfiguration === 2) {
      leave = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leave = 7;
    }
    if (ballotData.leaveType == 2) {
      leave = 1;
    }
    const appliedStaff = groupBy(ballotData.appliedStaff, "userId");
    const wonStaff = groupBy(ballotData.wonStaff, "userId");
    ////console.logs('ba', JSON.stringify(ballotData));
    // here currently implementing on first slot year which Got during processing 
    const updateLeaveBy = [];
    for (let key in appliedStaff) {
      const obj = {
        userId: key,
        value: 0,
        startYear: new Date().getFullYear()
      };
      const staffAppliedCount = appliedStaff[key].length;
      const slotNo = appliedStaff[key][0].weekNo;
      const startDate = ballotData.weekRange[slotNo].start;
      const startYearF = new Date(startDate).getFullYear();
      let staffWonCount = 0;
      if (wonStaff[key]) {
        staffWonCount = wonStaff[key].length;
      }
      obj.value = (staffAppliedCount - staffWonCount) * leave;
      obj.startYear = startYearF;
      updateLeaveBy.push(obj);
    }
    for (let i = 0; i < updateLeaveBy.length; i++) {
      const user = updateLeaveBy[i];
      const userId = user.userId;
      const startYear = user.startYear;

      let leaveTypeData;
      if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
        leaveTypeData = await this.checkIsAnnualLeave(userId, ballotData.companyId, null, true, ballotData.leaveTypeId);
      } else {
        leaveTypeData = await this.checkIsAnnualLeave(userId, ballotData.companyId, null, false);
      }

      // const leaveTypeData = await this.checkIsAnnualLeave(userId, ballotData.companyId);
      //console.logs('user', user)
      if (leaveTypeData.status) {
        let totalLeave = leaveTypeData.leaveTypeData.planQuota + user.value;
        const update = await this.managePlanLeave(userId, user.value, leaveTypeData.leaveTypeData, startYear);
        // const staffLevae = await StaffSapData.findOne({staff_Id: user.userId});
        // if (staffLevae) {
        //     let totalLeave = staffLevae.ballotLeaveBalanced + user.value;
        //     if (totalLeave > staffLevae.leavesBalanced) {
        //         totalLeave = staffLevae.leavesBalanced;
        //     }
        //     // //console.logs(staffLevae)
        //     const update = await StaffSapData.update({staff_Id: user.userId}, {$set: {ballotLeaveBalanced: totalLeave}});
        // }
      }
      //console.logs('user', user)
      // if (user.value > 0) {
      //     const staffLevae = await StaffSapData.findOne({staff_Id: user.userId});
      //     if (staffLevae) {
      //         let totalLeave = staffLevae.ballotLeaveBalanced + user.value;
      //         if (totalLeave > staffLevae.leavesBalanced) {
      //             totalLeave = staffLevae.leavesBalanced;
      //         }
      //         // //console.logs(staffLevae)
      //         const update = await StaffSapData.update({staff_Id: user.userId}, {$set: {ballotLeaveBalanced: totalLeave}});
      //     }
      // }
    }

    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
  }

  getRandomNumber(length, howMany) {
    //console.logs("aaaaa")
    if (howMany > length) {
      howMany = length;
    }
    const arr = [];
    for (let i = 0; i < howMany; i++) {
      const num = Math.floor(Math.random() * (length - 0)) + 0;
      if (arr.includes(num)) {
        i = i - 1;
      } else {
        arr.push(num);
      }
    }
    return arr;
  }

  async readRestrictionForStaffForBallot(req, res) {
    //try {
    const id = req.params.id;
    const ballot = await Ballot.findOne({ _id: id }); //{staffRestriction:1,maxSegment:1,maxConsecutiveBallot:1, isRestrict:1}
    const startYearA = new Date(ballot.ballotStartDate).getFullYear();
    const levaeTypeData = await this.checkIsAnnualLeave(req.user._id, req.user.companyId, startYearA);
    //return res.json({levaeTypeData})
    //const leave = await StaffSapData.findOne({staff_Id: req.user._id}, {ballotLeaveBalanced: 1});
    //return res.json({ballot})
    let ballotLeaveBalanced = 0;
    if (levaeTypeData.status) {
      ballotLeaveBalanced = levaeTypeData.leaveTypeData.planQuota;
    } else {
      return res.status(200).json({ success: false, data: {}, message: "falied No Quota Found" });
    }
    let leaveConfiguration = 5;
    if (ballot.leaveConfiguration === 2) {
      leaveConfiguration = 6;
    } else if (ballot.leaveConfiguration === 3) {
      leaveConfiguration = 7;
    }
    if (ballot.leaveType == 2) {
      leaveConfiguration = 1;
    }
    const howManySlotStaffCanApplied = Math.floor(ballotLeaveBalanced / leaveConfiguration);
    if (ballot.isRestrict) {
      const staffRestriction = [];
      ballot.staffRestriction.forEach((item) => {
        let isPresent = false;
        let staffRestrictionObj = {};
        isPresent = item.userList.some((user) => {
          if (user._id.toString() === req.user._id.toString()) {
            staffRestrictionObj = {
              slot: item.slot,
              startDate: item.startDate,
              endDate: ballot.leaveType == 1 ? new Date(new Date(item.endDate).setDate(new Date(item.endDate).getDate() + 6)) : item.endDate,
            };
            return true;
          }
        });
        console.log("isPresent", isPresent);
        if (isPresent) {
          let slot = this.getWeekIndex(item.startDate, ballot.weekRange, "start", ballot.leaveType);
          slot = -1;
          if (slot == -1) {
            // var slotStr = item.slot.split(" ")[0].substring(6);
            var slotStr = item.slot; 
            slot = parseInt(slotStr);
          }
          staffRestrictionObj.slotNo = slot;
          staffRestriction.push(staffRestrictionObj);
        }
      });
      const segmentRestriction = [];
      ballot.maxSegment.forEach((item, index) => {
        let startSlot = this.getWeekIndex(item.startDate, ballot.weekRange, "start", ballot.leaveType);
        //console.logs('item.endDate', item.endDate);
        let endSlot = this.getWeekIndex(item.endDate, ballot.weekRange, "end", ballot.leaveType);
        let slotRange = [];
        for (let i = startSlot; i <= endSlot; i++) {
          slotRange.push(i);
        }
        let segmentRestrictionObj = {
          startSlot,
          endSlot,
          slotRange,
          maxBallot: item.maxBallot,
        };
        segmentRestriction.push(segmentRestrictionObj);
      });
      var resTo = {
        segmentRestriction: segmentRestriction,
        leaveConfiguration: leaveConfiguration,
        howManySlotStaffCanApplied: howManySlotStaffCanApplied,
        isRestrict: true,
        ballotLeaveBalanced: ballotLeaveBalanced,
        staffRestriction: staffRestriction,
      };
      return res.status(201).json({
        success: true,
        data: resTo,
        message: "Successfull",
      });
      // return res.status(200).json({segmentRestriction, leaveConfiguration, howManySlotStaffCanApplied, success: true,  isRestrict: true, ballotLeaveBalanced, staffRestriction});
    } else {
      var resTo = {
        howManySlotStaffCanApplied: howManySlotStaffCanApplied,
        isRestrict: true,
        ballotLeaveBalanced: ballotLeaveBalanced,
      };
      return res.status(200).json({ success: true, data: resTo, message: "successful" });
    }
    // } catch (e) {
    //     return res.status(500).json({success: false, message: 'Something went wrong'});
    // }
  }

  async getBallotFilteredResults(req, res) {
    //console.logs("IN GET");
    let data = req.body;
    let flag = 0;
    if (data.opsTeams && data.opsTeams.length > 0) {
      flag = 1;
    }
    let ballot = await Ballot.findOne({ _id: data.BallotId });
    let UsersIds = [];
    let appliedCount = 0;
    let successfulCount = 0;
    if (data.opsGroups && data.opsGroups.length > 0) {
      for (var i = 0; i <= data.opsGroups.length - 1; i++) {
        var OpsG = await OpsGroup.findOne({ _id: data.opsGroups[i] });
        if (!OpsG) {
          return res.status(400).json({ success: false, message: "Selected ops group not found" });
        } else {
          if (flag == 0) {
            UsersIds = UsersIds.concat(OpsG.userId);
          } else {
            for (var a = 0; a <= OpsG.opsTeamId.length - 1; a++) {
              for (var b = 0; b <= data.opsTeams.length - 1; b++) {
                //console.logs("ID!: ", data.opsTeams[b], " ID@: ", OpsG.opsTeamId[a]);
                if (data.opsTeams[b].toString() === OpsG.opsTeamId[a].toString()) {
                  //console.logs("SAME FOUND");
                  //here me now
                  var OpsT = await OpsTeam.findOne({ _id: data.opsTeams[b] });
                  if (!OpsT) {
                    //console.logs("same team not found");
                  } else {
                    UsersIds = UsersIds.concat(OpsT.userId);
                  }
                  //UsersIds.push(data.opsTeams[b]);
                } else {
                  //console.logs("NOt same team Id found");
                }
              }
            }
          }
        }
      }

      if (ballot.appliedStaff.length > 0) {
        for (var i = 0; i <= ballot.appliedStaff.length - 1; i++) {
          for (var j = 0; j <= UsersIds.length - 1; j++) {
            if (ballot.appliedStaff[i].userId.toString() === UsersIds[j].toString()) {
              //same user found
              //console.logs("MATCH YEP YEP");
              appliedCount = appliedCount + 1;
              // let user = await User.findOne({_id:})
            } else {
              //console.logs("not equal applied staff");
            }
          }
        }
      }
      if (ballot.isResultRelease === true) {
        for (var i = 0; i <= ballot.wonStaff.length - 1; i++) {
          for (var j = 0; j <= UsersIds.length - 1; j++) {
            if (ballot.wonStaff[i].userId.toString() === UsersIds[j].toString()) {
              //same user found
              //console.logs("MATCH YEP YEP");
              successfulCount = successfulCount + 1;
              // let user = await User.findOne({_id:})
            } else {
              //console.logs("not equal applied staff");
            }
          }
        }
      } else {
        //console.logs("result not released.");
      }

      res.send({
        users: UsersIds,
        applied: appliedCount,
        success: successfulCount,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "please select at least one ops group",
      });
    }

    //console.logs("USerIds found: ", UsersIds);
  }

  getWeekIndex(date, weekRange, from, leaveType = 1) {
    console.log("leaveType", leaveType, from, date);
    if (leaveType == 1) {
      if (from === "end") {
        let weekDay = new Date(date).getDay();
        if (weekDay !== 0) {
          date = new Date(date);
          date.setDate(new Date(date).getDate() + 7 - weekDay);
        }
      } else {
        let weekDay = new Date(date).getDay();
        if (weekDay !== 1) {
          date = new Date(date);
          date.setDate(new Date(date).getDate() + 1 - weekDay);
        }
      }
      const yeterday = new Date(date);
      yeterday.setDate(new Date(date).getDate() - 1);
      const lastDate = moment(yeterday).format("YYYY-MM-DD");
      const currentDate = moment(date).format("YYYY-MM-DD");
      const tomorrow = new Date(date);
      tomorrow.setDate(new Date(date).getDate() + 1);
      const nextDate = moment(tomorrow).format("YYYY-MM-DD");
      // //console.logs('last', lastDate);
      //console.logs('currentDate', currentDate);
      // //console.logs('weekRange[i]', weekRange[0])
      //   //console.logs('nextDate', nextDate);
      let slot = -1;
      if (from === "start") {
        for (let i = 0; i < weekRange.length; i++) {
          const item = weekRange[i];
          if (new Date(item.start).getTime() === new Date(currentDate).getTime()) {
            slot = i;
            break;
          }
        }
      } else {
        for (let i = 0; i < weekRange.length; i++) {
          const item = weekRange[i];
          if (new Date(item.end).getTime() === new Date(currentDate).getTime()) {
            slot = i;
            break;
          }
        }
      }
      return slot;
    } else {
      //const date =
      //date, weekRange
      const currentDate = moment(date).format("YYYY-MM-DD");
      console.log("currentDate", currentDate);
      let slot = -1;
      if (from === "start") {
        for (let i = 0; i < weekRange.length; i++) {
          const item = weekRange[i];
          if (new Date(item.start).getTime() === new Date(currentDate).getTime()) {
            slot = i;
            slot = slot;
            break;
          }
        }
      } else {
        for (let i = 0; i < weekRange.length; i++) {
          const item = weekRange[i];
          if (new Date(item.end).getTime() === new Date(currentDate).getTime()) {
            slot = i;
            break;
          }
        }
      }
      return slot;
    }
  }

  async extendBallot(req, res) {
    let id = req.params.id;
    var data = req.body;
    let ballot = await Ballot.findOne({ _id: id });

    if (!ballot) {
      return res.status(500).json({ success: false, message: "Requested ballot not found" });
    } else {
      data.applicationCloseDateTime = `${data.applicationCloseDate} ${data.applicationCloseTime}:00 ${data.timeZone}`


      data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();

      let oldClosingDate = ballot.applicationCloseDateTime;
      console.log("DATA IS: ", data.applicationCloseDateTime);
      let date = data.applicationCloseDateTime;

      data.resultReleaseDateTime = `${data.resultReleaseDate} ${data.resultReleaseTime}:00 ${data.timeZone}`


      data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();

      let date1 = data.resultReleaseDateTime;
      //date = moment(date, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      console.log("data: ", date);
      const validationObj = this.validatieEndBallotDate(date);
      if (validationObj.status) {
        let updates = await Ballot.update(
          { _id: id },
          {
            $set: {
              applicationCloseDateTime: date,
              resultReleaseDateTime: date1,
              closeDate: data.applicationCloseDate,
              closeTime: data.applicationCloseTime
            },
            $push: { ballotExtendLogs: oldClosingDate },
          }
        );
        const ballotInfo = await Ballot.findOne({_id:id}).lean();
        await this.ballotEvent(ballotInfo, 'update', true)
        ballotExtendNotifications(ballot);
        //,{$push:{ballotExtendLogs:oldClosingDate}}
        return res.status(201).json({
          status: true,
          message: "Ballot extended successfully",
          data: updates,
        });
      } else {
        return res.json({
          status: false,
          message: "There are some date are not in valid format",
        });
      }
    }
  }

  validatieEndBallotDate(data) {
    if (data === "Invalid date") {
      return {
        status: false,
        message: "There are some date are not in valid format",
      };
    }
    return { status: true };
  }

  async cancelBallot(req, res) {
    let id = req.params.id;
    const ballotData = await Ballot.findOne({ _id: id });
    let leave = 5;
    if (ballotData.leaveConfiguration === 2) {
      leave = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leave = 7;
    }
    const appliedStaff = groupBy(ballotData.appliedStaff, "userId");
    const wonStaff = groupBy(ballotData.wonStaff, "userId");
    const updateLeaveBy = [];
    //console.logs("Applied is: ", appliedStaff);
    //console.logs("WONSTAFF IS: ", wonStaff);
    for (let key in appliedStaff) {
      const obj = {
        userId: key,
        value: 0,
      };
      const staffAppliedCount = appliedStaff[key].length;
      let staffWonCount = 0;
      if (wonStaff[key]) {
        staffWonCount = wonStaff[key].length;
      }
      obj.value = (staffAppliedCount - staffWonCount) * leave;
      updateLeaveBy.push(obj);
    }
    //console.logs("updateLeaveBy:", updateLeaveBy);
    for (let i = 0; i < updateLeaveBy.length; i++) {
      const user = updateLeaveBy[i];
      //console.logs('user', user)
      if (user.value > 0) {
        const staffLeavedata = await StaffSapData.findOne({
          staff_Id: user.userId,
        });
        if (staffLeavedata) {
          let totalLeave = staffLeavedata.ballotLeaveBalanced + user.value;
          if (totalLeave > staffLeavedata.leavesBalanced) {
            totalLeave = staffLeavedata.leavesBalanced;
          }
          //console.logs("staffLeavedata: ", staffLeavedata);
          const update = await StaffSapData.update({ staff_Id: user.userId }, { $set: { ballotLeaveBalanced: totalLeave } });
        }
      }
    }

    const ballotupdate = await Ballot.update({ _id: id }, { isCanceled: true });
    ballotCancelledNotifications(ballotData);
    return res.status(201).json({ status: true, message: "Ballot Cancelled successfully." });

    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
  }

  async reBallot(req, res) {
    let id = req.params.id;
    const ballot = await Ballot.findOne({ _id: id }).populate([
      {
        path: "adminId",
        select: "_id name staffId",
      },
      { path: "opsGroupId", model: "OpsGroup", select: "_id opsGroupName" },
    ]);

    if (!ballot) {
      return res.status(500).json({ success: false, message: "Requested ballot not found" });
    } else {
      let newballot = JSON.stringify(ballot);
      newballot = JSON.parse(newballot);
      newballot.parentBallot = ballot._id;
      newballot.applicationOpenDateTime = "";
      newballot.applicationCloseDateTime = "";
      // newballot.applicationOpenDateTime = new Date();
      // newballot.applicationCloseDateTime = moment(newballot.applicationOpenDateTime).add(10, 'd').toDate();
      // newballot.ballotStartDate = moment(newballot.applicationOpenDateTime ).add(20, 'd').toDate();
      // newballot.ballotEndDate =moment(newballot.applicationOpenDateTime ).add(45, 'd').toDate();
      newballot.ballotStartDate = moment(newballot.ballotStartDate).format('MM-DD-YYYY');
      newballot.ballotEndDate = moment(newballot.ballotEndDate).format('MM-DD-YYYY');

      newballot.resultReleaseDateTime = moment(newballot.applicationOpenDateTime).add(15, "d").toDate();

      //start with remainng quotas
      let slots = ballot.slotCreation;
      if (newballot.userFrom === 2) {
        //FOr BU's
        for (let i = 0; i <= slots.length - 1; i++) {
          // let users = [];
          //const users = await User.find({parentBussinessUnitId : slots[i].buId},{_id:1,name:1});
          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            var found = ballot.wonStaff.filter(function (element) {
              return element.buId.toString() === slots[i].buId.toString() && element.weekNo === j;
            });
            //console.logs("FOUND: ", found);
            slots[i].arr[j].value = slots[i].arr[j].value - found.length;
          }
          //res.send(users)
        }
      } else {
        //For Ops groups

        for (let i = 0; i <= slots.length - 1; i++) {
          let opsGrpid = slots[i].opsGroup.opsId;
          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            let currentweek = j + "A";
            var found = ballot.wonStaff.filter(function (element) {
              return element.opsGroupId.toString() === opsGrpid.toString() && element.weekNo === j;
            });

            slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;
            if (slots[i].opsTeam.length > 0) {
              slots[i].opsTeam.forEach((team, d) => {
                let currentweek = 'OG' + j + 'OT' + d.toString();
                //console.logs("Current week in Team: ", currentweek);
                var found = ballot.wonStaff.filter(function (element) {
                  if (element.opsTeamId) {
                    return element.opsTeamId.toString() === team._id.toString() && element.weekNo === j;
                  } else {
                    return element.opsGroupId === opsGrpid && !element.opsTeamId && element.weekNO === j;
                  }
                });
                //console.logs("FOUND: ", found);
                slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;
              });
            }
          }
        }
      }
      newballot.slotCreation = slots;
      newballot.appliedStaff = [];
      newballot.wonStaff = [];
      newballot.isPublish = false;
      newballot.isDraft = false;
      newballot.isResultRelease = false;

      return res.status(201).json({ status: true, data: newballot, message: "Received data." });
    }
  }

  async getBallotAppliedUsersList(req, res) {
    //console.logs("USER ID: ", req.params.id);
    try {
      let ballot = await Ballot.findById({ _id: req.params.id }).populate([
        { path: "appliedStaff.userId", select: "_id name" },
        { path: "wonStaff.userId", select: "_id name" },
      ]);
      //let Applied=[]; let WON=[];
      let weekRange = ballot.weekRange;
      weekRange.map((week) => {
        week.appliedUser = [];
        week.wonUser = [];
      });
      //console.logs("WEEKRANGE IS : ", weekRange);
      ballot = JSON.stringify(ballot);
      ballot = JSON.parse(ballot);
      if (ballot) {
        if (ballot.appliedStaff.length > 0) {
          for (var i = 0; i <= ballot.appliedStaff.length - 1; i++) {
            let SlotObject = ballot.appliedStaff[i];
            //   var slot = ballot.weekRange[SlotObject.weekNo];

            weekRange[SlotObject.weekNo].appliedUser.push(SlotObject.userId);
            ////console.logs("IN APPLIED :",weekRange[SlotObject.weekNO]);
            //  SlotObject.slot={};
            // SlotObject.slot= {start:slot.start,end:slot.end};
            // Applied.push(SlotObject);
          }
        }
        //console.logs("WIN STAFF ARE: ", ballot.wonStaff.length);
        if (ballot.wonStaff.length > 0) {
          for (var i = 0; i <= ballot.wonStaff.length - 1; i++) {
            let SlotObject = ballot.wonStaff[i];

            // var slot = ballot.weekRange[SlotObject.weekNo];
            weekRange[SlotObject.weekNo].wonUser.push(SlotObject.userId);
            // weekRange[SlotObject.weekNO].wonUser.push(SlotObject.userId);
            // SlotObject.slot={};
            //SlotObject.slot= {start:slot.start,end:slot.end};
            //WON.push(SlotObject);
          }
        }
        // //console.logs("DONE WITH SECOND");

        //console.logs("CALLING THIS THEN");
        let ballotingdata = { weeks: weekRange };
        res.status(200).json({
          status: true,
          data: ballotingdata,
          message: "data retrieved successfully",
        });
      } else {
        res.send("couldent found");
      }
    } catch (e) {
      return res.status(500).json({ status: false, data: e, message: "something went wrong", e });
    }
  }

  async getOpsTeamdropedown(req, res) {
    let id = req.params.id;
    let opsData = [];
    const ballot = await Ballot.findOne({ _id: id });
    const opsGroupId = ballot.opsGroupId;
    if (!ballot) {
      return res.status(500).json({ success: false, message: "Requested ballot not found" });
    } else {
      for (let i = 0; i <= opsGroupId.length - 1; i++) {
        let ops = {};
        let opsG = await OpsGroup.findOne({ _id: opsGroupId[i] }, { opsGroupName: 1, _id: 1, opsTeamId: 1 });
        if (!opsG) {
          return res.status(500).json({
            success: false,
            message: "Couldnt find respective ops group",
          });
        } else {
          ops.opsgroup = opsG;
          let teams = [];
          let Teams = opsG.opsTeamId;
          //console.logs("OPSGROUP IS: ", opsG);
          //console.logs("TEAMS : ", opsG.opsTeamId);
          if (Teams.length > 0) {
            for (let j = 0; j <= Teams.length - 1; j++) {
              let OpsT = await OpsTeam.findOne({ _id: Teams[j] }, { _id: 1, name: 1 });
              teams.push(OpsT);
            }
          }
          ops.Teams = teams;
        }
        opsData.push(ops);
      }
      //console.logs("data found is: ", opsData);
      return res.status(200).json({
        success: true,
        data: opsData,
        message: "Successfully received ops data for respectd ballot",
      });
    }
  }

  async getBallotInRounds(req, res) {
    //first check if ballot has parent ballot

    try {
      const ballot = await Ballot.findOne({ _id: req.params.id });

      if (!ballot) {
        return res.status(500).json({ success: false, message: "Requested ballot not found" });
      } else {
        if (ballot.parentBallot) {
          let parentBallotId = await this.checkBallots(ballot._id);
          //console.logs("parentballet", parentBallotId);
          const ballotparent = await Ballot.findOne(
            { _id: parentBallotId },
            {
              _id: 1,
              ballotName: 1,
              resultReleaseDateTime: 1,
              childBallots: 1,
              ballotRound: 1,
              isResultRelease: 1,
              applicationOpenDateTime: 1,
              applicationCloseDateTime: 1,
              isConduct: 1,
              resultRelease: 1,
              isAutoAssign: 1,
            }
          );
          //console.logs("ballotparent: ", ballotparent);
          this.sendManageBallotData(ballotparent, res);
        } else {
          //console.logs("In main else");
          this.sendManageBallotData(ballot, res);
        }
      }
    } catch (e) {
      return res.status(500).json({ success: false, message: "Something went wrong!" });
    }
  }

  async checkBallots(ballotid) {
    let newballot = await Ballot.findOne({ _id: ballotid });
    //console.logs("NewBallot: ", newballot);
    newballot = JSON.stringify(newballot);
    newballot = JSON.parse(newballot);
    if (newballot.parentBallot) {
      let id = newballot.parentBallot;

      return this.checkBallots(id);
    } else {
      // return ballot
      //console.logs("in else of check parent ballot: ", newballot._id);
      return newballot._id;
    }
  }

  async sendManageBallotData(ballot, res) {
    let BallotsList = [];
    let ballotStatus = "Open";
    if (new Date().getTime() > new Date(ballot.applicationCloseDateTime).getTime()) {
      ballotStatus = "Closed";
    }
    if (ballot.isResultRelease) {
      //console.logs("In check of result release yep");
      ballotStatus = "Closed";
    }
    //console.logs("Ballot status is:", ballotStatus);
    let roundOne = ballot.ballotRound + 1;
    let newbal = {
      ballotName: ballot.ballotName,
      _id: ballot._id,
      ballotStatus: ballotStatus,
      ballotRound: "Round " + roundOne,
      resultDate: ballot.resultReleaseDateTime,
      applicationOpenDateTime: ballot.applicationOpenDateTime,
      applicationCloseDateTime: ballot.applicationCloseDateTime,
      isResultRelease: ballot.isResultRelease,
      isConduct: ballot.isConduct,
      resultRelease: ballot.resultRelease,
      isAutoAssign: ballot.isAutoAssign,
    };
    BallotsList.push(newbal);
    let parentBallotMain = ballot._id;
    if (ballot.childBallots && ballot.childBallots.length > 0) {
      for (let b = 0; b <= ballot.childBallots.length - 1; b++) {
        let childBallot = await Ballot.findOne(
          { _id: ballot.childBallots[b] },
          {
            _id: 1,
            ballotName: 1,
            resultReleaseDateTime: 1,
            ballotRound: 1,
            isResultRelease: 1,
            applicationOpenDateTime: 1,
            applicationCloseDateTime: 1,
            isConduct: 1,
            resultRelease: 1,
            isAutoAssign: 1,
            assignRatio: 1,
          }
        );
        //  console.log("Child Ballots : ", childBallot._id,'=>',childBallot.isAutoAssign);
        if (childBallot) {
          let Status = "Open";
          if (new Date().getTime() > new Date(childBallot.applicationCloseDateTime).getTime()) {
            Status = "Closed";
          }
          if (childBallot.isResultRelease) {
            //console.logs("In check of result release yep of child ballot");
            Status = "Closed";
          }

          let roundChild = childBallot.ballotRound + 1;
          let newbal1 = {
            ballotName: childBallot.ballotName,
            _id: childBallot._id,
            ballotStatus: Status,
            ballotRound: "Round " + roundChild,
            resultDate: childBallot.resultReleaseDateTime,
            applicationOpenDateTime: childBallot.applicationOpenDateTime,
            applicationCloseDateTime: childBallot.applicationCloseDateTime,
            isResultRelease: childBallot.isResultRelease,
            isConduct: childBallot.isConduct,
            resultRelease: childBallot.resultRelease,
            isAutoAssign: childBallot.isAutoAssign,
          };
          if (!childBallot.assignRatio) {
            childBallot.isAssignRatio = false;
          } else {
            childBallot.isAssignRatio = true;
            childBallot.assignRatio = childBallot.assignRatio;
          }
          BallotsList.push(newbal1);
        } else {
          return res.status(500).json({
            success: false,
            message: "Problem while finding child ballots, Please try again later",
          });
        }

        //console.logs("BallotsList :", BallotsList);
      }
    } else {
      //console.logs("There is no child ballot yet");
    }
    BallotsList.reverse();
    let ballotData = { parent: parentBallotMain, BallotList: BallotsList };
    return res.status(200).json({
      success: true,
      data: ballotData,
      message: "Successfully got data.",
    });
  }
  async resultRelase(req, res) {
    let currentYear = new Date().getFullYear();
    const selectedBallotId = req.body.selectedBallotId;
    const annualLeaveId = await leaveType.findOne({ name: "Annual Leave", isActive: true, companyId: req.user.companyId }, { _id: 1 });
    const getLeavetypeId = await Ballot.find({ _id: selectedBallotId, isPublish: true, isDeleted: false }, { _id: 0, leaveTypeId: 1, wonStaff: 1, fixedBallotingLeaveType: 1, ballotRound: 1 });


    let user = await Ballot.findOneAndUpdate({ _id: selectedBallotId }, { $set: { isResultRelease: true, resultReleaseDateTime: new Date() } });
    if (user && user.isResultRelease) {
      return res.json({ success: false, message: 'Result is already released' })
    }

    let uniqueUserIdsObj = getLeavetypeId[0].wonStaff.slice().reverse().filter((v, i, a) => a.findIndex(t => (JSON.stringify(t.userId) == JSON.stringify(v.userId))) === i).reverse()
    let uniqueIds = [...new Set(uniqueUserIdsObj.map(item => item.userId))]

    for (let i = 0; i < getLeavetypeId[0].wonStaff.length; i++) {
      let findLeaveTpeInStaffLeave = await staffLeave.findOne({
        userId: uniqueIds[i], 'leaveDetails.year': currentYear,
        'leaveDetails.leaveTypeId': getLeavetypeId[0].fixedBallotingLeaveType ? getLeavetypeId[0].leaveTypeId : annualLeaveId._id
      }, { leaveDetails: 1, _id: 0 });

      let leaveObj = [];
      let annualLeavePlanQuotaObj;
      let calculatedValue;

      // console.log("findLeaveTpeInStaffLeavefindLeaveTpeInStaffLeavefindLeaveTpeInStaffLeave", findLeaveTpeInStaffLeave)
      if (findLeaveTpeInStaffLeave !== null) {
        //New-Leavetype 
        leaveObj = _.filter(findLeaveTpeInStaffLeave.leaveDetails, (e) => JSON.stringify(e.leaveTypeId) == JSON.stringify(getLeavetypeId[0].leaveTypeId) && e.year === currentYear)
        if (leaveObj && leaveObj.length !== 0) {
          //Annual-Leavetype
          annualLeavePlanQuotaObj = _.filter(findLeaveTpeInStaffLeave.leaveDetails, (e) => JSON.stringify(e.leaveTypeId) == JSON.stringify(annualLeaveId._id) && e.year === currentYear)
          // Total and PlanQuota will come from New-Leave type not from Annual Leave.
          calculatedValue = parseInt(leaveObj[0].total) - parseInt(leaveObj[0].planQuota)
        }
      }

      if (getLeavetypeId[0].fixedBallotingLeaveType) {
        if (getLeavetypeId[0].ballotRound === 0) {
          if (uniqueIds[i] !== undefined) {
            await staffLeave.findOneAndUpdate(
              { userId: uniqueIds[i], leaveDetails: { "$elemMatch": { "year": currentYear, leaveTypeId: annualLeaveId._id } } },
              { "leaveDetails.$.planQuota": (annualLeavePlanQuotaObj[0].planQuota - calculatedValue) }
            )
          }
        } else {
          console.log("inside else")
          let findLeaveTpeInStaffLeavee = await staffLeave.findOne({
            userId: getLeavetypeId[0].wonStaff[i].userId, 'leaveDetails.year': currentYear,
            'leaveDetails.leaveTypeId': getLeavetypeId[0].fixedBallotingLeaveType ? getLeavetypeId[0].leaveTypeId : annualLeaveId._id
          }, { leaveDetails: 1, _id: 0 });

          let annualLeavePlanQuotaObjn = _.filter(findLeaveTpeInStaffLeavee.leaveDetails, (e) => JSON.stringify(e.leaveTypeId) == JSON.stringify(annualLeaveId._id) && e.year === currentYear)
          await staffLeave.findOneAndUpdate(
            { userId: getLeavetypeId[0].wonStaff[i].userId, leaveDetails: { "$elemMatch": { "year": currentYear, leaveTypeId: annualLeaveId._id } } },
            { "leaveDetails.$.planQuota": (annualLeavePlanQuotaObjn[0].planQuota) - 1 }
          )
        }
      }
    }

    this.sendResultReleaseNotification(user)
    const updateLeave = await this.pushLeaveToLeaveApplied(user);

    if (updateLeave && updateLeave.length) {
      return res.json({ success: true, message: "Result Released Successfully" });

    } else {
      return res.json({ success: false, message: "Staff Leave not updated." });

    }
    // this.saveWonsAllAsLeave(user.wonStaff, user.weekRange, user.ballotRound, user._id);
  }
  async sendResultReleaseNotification(item) {
    const currentTime = new Date();

    if (item.userFrom === 1) {
      const userIDArr = await OpsGroup.find({ _id: { $in: item.opsGroupId }, isDelete: false }, { userId: 1, _id: 0 });
      //console.logs("userIDARR : ",userIDArr);
      let userId = [];
      userIDArr.forEach((item) => {
        userId = userId.concat(item.userId);
      });
      //console.logs('userId', userId)
      const unAssignUser = await User.find({ _id: { $in: userId } })
        .select("deviceToken")
        .lean();
      ////console.logs('user11', JSON.stringify(unAssignUser));
      const usersDeviceTokens = [];
      unAssignUser.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      //console.logs('usersDeviceTokens', usersDeviceTokens);
      if (usersDeviceTokens.length > 0) {
        //Balloting Exercise (Ballot Name) results are released, please check the results
        const pushData = {
          title: "Balloting Excercise results are released.",
          body: 'Balloting Excercise "' + item.ballotName + '" results are released,  please check the results.',
          bodyText: 'Balloting Excercise "' + item.ballotName + '" results are released, please check the results.',
          bodyTime: currentTime,
          bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
        },
          collapseKey = item._id; /*unique id for this particular ballot */
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
      const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
    } else {
      // user from bu
      const userList = await User.find({ parentBussinessUnitId: { $in: item.businessUnitId } }, { _id: 0, deviceToken: 1 });
      const usersDeviceTokens = [];
      userList.forEach((token) => {
        if (token.deviceToken) {
          usersDeviceTokens.push(token.deviceToken);
        }
      });
      if (usersDeviceTokens.length > 0) {
        const pushData = {
          title: "Balloting Excercise results are released.",
          body: 'Balloting Excercise "' + item.ballotName + '" results are released,  please check the results.',
          bodyText: 'Balloting Excercise "' + item.ballotName + '" results are released, please check the results.',
          bodyTime: currentTime,
          bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
        },
          collapseKey = item._id; /*unique id for this particular ballot */
        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
      const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
    }
  }
  async pushLeaveToLeaveApplied(ballotData) {
    if (ballotData.staffLeave && ballotData.staffLeave.length) {
      let leaveData = []
      for (let i = 0; i < ballotData.staffLeave.length; i++) {
        leaveData.push(ballotData.staffLeave[i])
      }
      const result = await LeaveApplied.insertMany(leaveData, { ordered: true });
      return result
    }
  }
  async ballotDetail(req, res) {
    // try{
    const selectedBallotId = req.body.selectedBallotId;
    const ballotData = await Ballot.findOne({ _id: selectedBallotId });
    // for BU
    if (ballotData.userFrom === 2) {
      const wonStaffData = [];
      const wonStaffByBu = this.groupByPro(ballotData.wonStaff, "buId");
      for (let buId in wonStaffByBu) {
        const wonStaffByBu_Week = this.groupByPro(wonStaffByBu[buId], "weekNo");
        wonStaffData.push({ buId, wonStaffByBu_Week });
      }
      const appliedStaffData = [];
      const appliedStaffDataByBu = this.groupByPro(ballotData.appliedStaff, "buId");
      for (let buId in appliedStaffDataByBu) {
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByBu[buId], "weekNo");
        appliedStaffData.push({ buId1: buId, appliedStaffDataByBu_Week });
      }
      const actualSlotValueByBuArr = [];
      const ballotRoundResult = {
        quota: 0,
        applied: 0,
        successful: 0,
      };
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slot = ballotData.slotCreation[i];
        // //console.logs('slot', slot);
        const wonBuStaffArr = wonStaffData.filter((bu) => {
          return bu.buId == slot.buId;
        });
        const appliedBuStaffArr = appliedStaffData.filter((bu) => {
          return bu.buId1 == slot.buId;
        });
        let appliedBuStaff = null;
        let wonBuStaff = null;
        if (appliedBuStaffArr.length > 0) {
          appliedBuStaff = appliedBuStaffArr[0];
        }
        if (wonBuStaffArr.length > 0) {
          wonBuStaff = wonBuStaffArr[0];
        }
        const actualSlotValueByBu = {
          buId: slot.buId,
          weekValue: [],
          ballotRoundResultBuWise: {
            quota: 0,
            applied: 0,
            successful: 0,
          },
        };
        slot.arr.forEach((item, index) => {
          const slotValue = item.value;
          ballotRoundResult.quota = ballotRoundResult.quota + slotValue;
          actualSlotValueByBu.ballotRoundResultBuWise.quota = actualSlotValueByBu.ballotRoundResultBuWise.quota + slotValue;
          let appliedValue = 0;
          if (appliedBuStaff && appliedBuStaff.appliedStaffDataByBu_Week["" + index]) {
            appliedValue = appliedBuStaff.appliedStaffDataByBu_Week["" + index].length;
            ballotRoundResult.applied = ballotRoundResult.applied + appliedValue;
            actualSlotValueByBu.ballotRoundResultBuWise.applied = actualSlotValueByBu.ballotRoundResultBuWise.applied + appliedValue;
          }

          let wonValue = 0;
          if (wonBuStaff && wonBuStaff.wonStaffByBu_Week["" + index]) {
            wonValue = wonBuStaff.wonStaffByBu_Week["" + index].length;
            ballotRoundResult.successful = ballotRoundResult.successful + wonValue;
            actualSlotValueByBu.ballotRoundResultBuWise.successful = actualSlotValueByBu.ballotRoundResultBuWise.successful + wonValue;
          }

          actualSlotValueByBu.weekValue.push(`${slotValue}/${appliedValue}/${wonValue}`);
        });
        actualSlotValueByBuArr.push(actualSlotValueByBu);
      }
      res.send({ actualSlotValueByBuArr, ballotRoundResult });
    } else {
      const wonStaffDataOpsGroup = [];
      const wonStaffByOpsGroup = this.groupByPro(ballotData.wonStaff, "opsGroupId");
      for (let opsGroupId in wonStaffByOpsGroup) {
        const wonStaffByBu_Week = this.groupByPro(wonStaffByOpsGroup[opsGroupId], "weekNo");
        wonStaffDataOpsGroup.push({ opsGroupId, wonStaffByBu_Week });
      }
      //console.logs('wonStaffDataOpsGroup', JSON.stringify(wonStaffDataOpsGroup));
      const wonStaffDataOpsTeam = [];
      const wonStaffByOpsTeam = this.groupByPro(ballotData.wonStaff, "opsTeamId");
      for (let opsTeamId in wonStaffByOpsTeam) {
        const opsGroupId = wonStaffByOpsTeam[opsTeamId][0].opsGroupId;
        const wonStaffByBu_Week = this.groupByPro(wonStaffByOpsTeam[opsTeamId], "weekNo");
        wonStaffDataOpsTeam.push({ opsTeamId, opsGroupId, wonStaffByBu_Week });
      }

      const appliedStaffDataOpsGroup = [];
      const appliedStaffDataByOpsGroup = this.groupByPro(ballotData.appliedStaff, "opsGroupId");
      //console.logs('*******');
      // //console.logs('appliedStaffDataByOpsGroup', JSON.stringify(appliedStaffDataByOpsGroup));
      //console.logs('*******');
      for (let opsGroupId in appliedStaffDataByOpsGroup) {
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByOpsGroup[opsGroupId], "weekNo");
        appliedStaffDataOpsGroup.push({
          opsGroupId: opsGroupId,
          appliedStaffDataByBu_Week,
        });
      }
      //console.logs('appliedStaffDataOpsGroup', JSON.stringify(appliedStaffDataOpsGroup));
      //console.logs('*******');
      const appliedStaffDataOpsTeam = [];
      const appliedStaffDataByOpsTeam = this.groupByPro(ballotData.appliedStaff, "opsTeamId");
      for (let opsTeamId in appliedStaffDataByOpsTeam) {
        const opsGroupId = appliedStaffDataByOpsTeam[opsTeamId][0].opsGroupId;
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByOpsTeam[opsTeamId], "weekNo");
        appliedStaffDataOpsTeam.push({
          opsTeamId: opsTeamId,
          opsGroupId,
          appliedStaffDataByBu_Week,
        });
      }
      //return res.json({appliedStaffDataOpsTeam,wonStaffDataOpsTeam, wonStaffDataOpsGroup, appliedStaffDataOpsGroup, ballotData});
      let finalValue = [];
      let finalValueTeam = [];
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slotObj = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotObj.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
        if (slotObj.opsTeam.length > 0) {
          // //console.logs('appliedStaffDataOpsTeam', appliedStaffDataOpsTeam);
          const appliedStaffOpsTeamArr = [];
          appliedStaffDataOpsTeam.forEach((item) => {
            for (let i = 0; i < slotObj.opsTeam.length; i++) {
              if (slotObj.opsTeam[i]._id == item.opsTeamId) {
                appliedStaffOpsTeamArr.push(item);
              }
            }
          });

          const wonStaffOpsTeamArr = [];
          wonStaffDataOpsTeam.forEach((item) => {
            ////console.logs('itemitem', item);
            for (let i = 0; i < slotObj.opsTeam.length; i++) {
              // //console.logs('i', i);
              //console.logs('slotObj.opsTeam[i]', slotObj.opsTeam[i]._id, item.opsTeamId);
              if (slotObj.opsTeam[i]._id == item.opsTeamId) {
                //console.logs('hchchchchhc')
                wonStaffOpsTeamArr.push(item);
              }
            }
          });
          // //console.logs('wonStaffOpsTeamArr', wonStaffOpsTeamArr.length);
          const tire1Quota = [];
          finalValueTeam = [];
          slotObj.opsTeam.forEach((team, index) => {
            const teamWiseQuota = {
              teamQuota: 0,
              applied: 0,
              success: 0,
            };
            const appliedStaffTeamObj = appliedStaffOpsTeamArr.filter((appliedTeam) => {
              return appliedTeam.opsTeamId == team._id;
            });

            const wonStaffTeamObj = wonStaffOpsTeamArr.filter((wonTeam) => {
              return wonTeam.opsTeamId == team._id;
            });
            ////console.logs('wonStaffTeamObj', wonStaffTeamObj);
            let teamSlotArr = [];
            for (let j = 0; j < ballotData.weekRange.length; j++) {
              if (index === 0) {
                tire1Quota.push(parseInt(slotObj.weekRangeSlot["" + j + "A"].value));
              }

              const week = ballotData.weekRange[j];
              const teamQuota = checkIndexFormat ? parseInt(slotObj.weekRangeSlot['OG' + j +'OT'+ index].value) : parseInt(slotObj.weekRangeSlot['' + j + index].value);
              let appliedStaffQuota = 0;
              let successStaffQuota = 0;

              if (appliedStaffTeamObj.length > 0 && appliedStaffTeamObj[0].appliedStaffDataByBu_Week["" + j]) {
                ////console.logs('aa')
                appliedStaffQuota = appliedStaffTeamObj[0].appliedStaffDataByBu_Week["" + j].length;
              }
              if (wonStaffTeamObj.length > 0 && wonStaffTeamObj[0].wonStaffByBu_Week["" + j]) {
                // //console.logs('aa')
                successStaffQuota = wonStaffTeamObj[0].wonStaffByBu_Week["" + j].length;
              }
              //console.logs('before push', teamQuota, typeof teamQuota)
              teamSlotArr.push({
                teamQuota,
                appliedStaffQuota,
                weekNo: j,
                successStaffQuota,
              });
            }
            //tire1Quota
            let obj = {
              teamId: team._id,
              opsGroupId: slotObj.opsGroup.opsId,
              value: teamSlotArr,
            };

            /*   obj[''+team._id] = [];
                       obj[''+team._id] = teamSlotArr;
                       obj.tire1Quota = tire1Quota;*/
            finalValueTeam.push(obj);

            teamSlotArr = [];
            if (index === slotObj.opsTeam.length - 1) {
              for (let k = 0; k < ballotData.weekRange.length; k++) {
                let totalTeamQuota = 0;
                let totalTeamSuccess = 0;
                let totalTeamApplied = 0;
                slotObj.opsTeam.forEach((insideTeam, indexIndex) => {
                  //totalTeamQuota = totalTeamQuota + finalValueTeam[indexIndex].value[k].teamQuota;
                  totalTeamSuccess = totalTeamSuccess + finalValueTeam[indexIndex].value[k].successStaffQuota;
                  totalTeamApplied = totalTeamApplied + finalValueTeam[indexIndex].value[k].appliedStaffQuota;
                });
                //totalTeamQuota = totalTeamQuota + finalValueTeam[indexIndex].value[k].teamQuota;
                teamSlotArr.push({
                  teamQuota: tire1Quota[k],
                  appliedStaffQuota: totalTeamApplied,
                  weekNo: k,
                  successStaffQuota: totalTeamSuccess,
                });
              }
              obj = {
                teamId: "Tier 1",
                opsGroupId: slotObj.opsGroup.opsId,
                value: teamSlotArr,
              };
              finalValueTeam.push(obj);
            }
          });

          finalValue.push(finalValueTeam);
        } else {
          // no team detail
          finalValueTeam = [];
          const noOpsTeamAppliedDataArr = appliedStaffDataOpsGroup.filter((item) => {
            return item.opsGroupId == slotObj.opsGroup.opsId;
          });
          const noOpsTeamWonDataArr = wonStaffDataOpsGroup.filter((item) => {
            return item.opsGroupId == slotObj.opsGroup.opsId;
          });
          let obj = {
            teamId: null,
            opsGroupId: slotObj.opsGroup.opsId,
            value: [],
          };
          let teamSlotArr = [];
          for (let i = 0; i < ballotData.weekRange.length; i++) {
            let teamQuota = parseInt(slotObj.weekRangeSlot["" + i + "A"].value);
            let appliedStaffQuota = 0;
            if (
              noOpsTeamAppliedDataArr &&
              noOpsTeamAppliedDataArr.length > 0 &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i] &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i].length > 0
            ) {
              appliedStaffQuota = noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i].length;
              //console.logs("HERE AT QUOTA: ",appliedStaffQuota);
            }
            let successStaffQuota = 0;
            if (
              noOpsTeamWonDataArr &&
              noOpsTeamWonDataArr.length &&
              noOpsTeamWonDataArr[0].wonStaffByBu_Week[i] &&
              noOpsTeamWonDataArr[0].wonStaffByBu_Week[i].length > 0
            ) {
              successStaffQuota = noOpsTeamWonDataArr[0].wonStaffByBu_Week[i].length;
            }
            //console.logs('before push', teamQuota, typeof teamQuota)
            teamSlotArr.push({
              teamQuota,
              appliedStaffQuota,
              weekNo: i,
              successStaffQuota,
            });
          }
          obj.value = teamSlotArr;
          finalValueTeam.push(obj);
          finalValue.push(finalValueTeam);
        }
      }
      //return res.json({finalValue})
      console.log("Final value is: ", finalValue);
      const newFinalData = [];
      let finalTotalApplied = 0;
      let finalTotalQuota = 0;
      let totalTeamQuota = 0;
      let finalTotalSuccessful = 0;
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slotData = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotData.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
        const opsGroupData = finalValue[i];
        let totalBalanceTeamQuota = 0;
        slotData.opsGroup.balanceQuota = 0;
        slotData.opsGroup.applied = 0;
        slotData.opsGroup.quota = 0;
        slotData.opsGroup.successful = 0;

        for (let j = 0; j < opsGroupData.length; j++) {
          if (opsGroupData.length - 1 !== j) {
            slotData.opsTeam[j].balanceQuota = 0;
            slotData.opsTeam[j].applied = 0;
            slotData.opsTeam[j].quota = 0;
            slotData.opsTeam[j].successful = 0;
          }
        }
        for (let k = 0; k < ballotData.weekRange.length; k++) {
          let teamQuota = 0;
          let teamBallanceReaming = 0;
          for (let j = 0; j < opsGroupData.length; j++) {
            if (opsGroupData.length - 1 === j) {
              // for tire 1
              //slotData.opsTeam[j].isShow = true;
              if (opsGroupData.length === 1) {
                slotData.opsGroup.applied += opsGroupData[j].value[k].appliedStaffQuota;
                // slotData.opsGroup.quota +=  opsGroupData[j].value[k].teamQuota;
                slotData.opsGroup.successful += opsGroupData[j].value[k].successStaffQuota;
              }
              slotData.weekRangeSlot["" + k + "A"].value = opsGroupData[j].value[k];
              ////console.logs('opsGroupData[j].value[k]', opsGroupData[j].value[k]);
              finalTotalApplied += opsGroupData[j].value[k].appliedStaffQuota;
              finalTotalSuccessful += opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.balanceQuota += opsGroupData[j].value[k].teamQuota - opsGroupData[j].value[k].successStaffQuota;
              //console.logs('teamBallanceReamingteamBallanceReaming', teamBallanceReaming, slotData.opsGroup.balanceQuota)
              if (teamBallanceReaming < slotData.opsGroup.balanceQuota && opsGroupData.length !== 1) {
                slotData.opsGroup.balanceQuota = teamBallanceReaming;
              }
              //console.logs('finalTotalQuotafinalTotalQuota', finalTotalQuota, teamQuota, opsGroupData[j].value[k].teamQuota)
              if (teamQuota < opsGroupData[j].value[k].teamQuota && opsGroupData.length > 1) {
                finalTotalQuota += parseInt(teamQuota);
                slotData.opsGroup.quota += parseInt(teamQuota);
              } else {
                finalTotalQuota += parseInt(opsGroupData[j].value[k].teamQuota);
                slotData.opsGroup.quota += parseInt(opsGroupData[j].value[k].teamQuota);
              }
            } else {
              slotData.opsTeam[j].isShow = true;
              if(checkIndexFormat){
                slotData.weekRangeSlot['OG' + k +'OT' + j].value = opsGroupData[j].value[k];
              } else {
                slotData.weekRangeSlot['' + k + j].value = opsGroupData[j].value[k];
              }
              
              slotData.opsTeam[j].balanceQuota += opsGroupData[j].value[k].teamQuota - opsGroupData[j].value[k].successStaffQuota;
              slotData.opsTeam[j].applied += opsGroupData[j].value[k].appliedStaffQuota;
              slotData.opsTeam[j].quota += opsGroupData[j].value[k].teamQuota;
              //console.logs('opsGroupData[j].value[k].teamQuota', typeof opsGroupData[j].value[k].teamQuota)
              teamQuota += parseInt(opsGroupData[j].value[k].teamQuota);
              totalTeamQuota += slotData.opsTeam[j].quota;
              slotData.opsTeam[j].successful += opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.applied += opsGroupData[j].value[k].appliedStaffQuota;
              //slotData.opsGroup.quota +=  opsGroupData[j].value[k].teamQuota;
              slotData.opsGroup.successful += opsGroupData[j].value[k].successStaffQuota;
            }
            if (opsGroupData.length - 1 !== j) {
              totalBalanceTeamQuota += slotData.opsTeam[j].balanceQuota;
              teamBallanceReaming += slotData.opsTeam[j].balanceQuota;
            }
          }
        }
        // remove code for changing balance quota
        if (totalBalanceTeamQuota < slotData.opsGroup.balanceQuota && opsGroupData.length !== 1) {
          slotData.opsGroup.balanceQuota = totalBalanceTeamQuota;
        }
        newFinalData.push(slotData);
      }
      newFinalData.forEach((ite) => {
        ite.opsGroup.balanceQuota = ite.opsGroup.quota - ite.opsGroup.successful;
      });
      let leaveFormat = 5;
      if (ballotData.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballotData.leaveConfiguration === 3) {
        leaveFormat = 7;
      }

      if (ballotData.leaveType == 2) {
        leaveFormat = 1;
      }
      console.log('ballot.ballotStartDate', ballotData.ballotStartDate)
      var startYear = new Date(ballotData.ballotStartDate).getFullYear()
      let totalTeamUnassign = 0;
      for (let i = 0; i < newFinalData.length; i++) {
        const opsGroupData = newFinalData[i];
        newFinalData[i].opsGroup.unassignBalanace = 0;

        if (opsGroupData.opsTeam.length > 0) {
          for (let j = 0; j < opsGroupData.opsTeam.length; j++) {
            const opsTeamData = opsGroupData.opsTeam[j];
            const opsTeamUser = await OpsTeam.findOne({ _id: opsTeamData._id }, { userId: 1, _id: 0 }).lean();
            //const leaveBallanceData = await StaffSapData.find({ staff_Id: { $in: opsTeamUser.userId } }, { ballotLeaveBalanced: 1, _id: 0 }).lean();
            // const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear);

            let leaveBallanceData;
            if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
              leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, true, ballotData.leaveTypeId);
            } else {
              leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, false);
            }

            // res.json({
            //   success: true,
            //   data: ballotData
            // });

            let teamUnassign = 0;
            console.log('leaveBallanceDataleaveBallanceData', leaveBallanceData)
            leaveBallanceData.staffArr.forEach((item) => {
              teamUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
            });
            // to get all unassign before result release
            if (!ballotData.isResultRelease && !ballotData.isConduct) {
              teamUnassign += newFinalData[i].opsTeam[j].applied;
            }
            newFinalData[i].opsTeam[j].unassignBalanace = teamUnassign;
            totalTeamUnassign += teamUnassign;
            newFinalData[i].opsGroup.unassignBalanace += teamUnassign;
          }
        } else {
          // no team
          const opsTeamUser = await OpsGroup.findOne({ _id: opsGroupData.opsGroup.opsId }, { userId: 1, _id: 0 }).lean();
          // const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear);

          let leaveBallanceData;
          if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, true, ballotData.leaveTypeId);
          } else {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, false);
          }

          let teamUnassign = 0;
          leaveBallanceData.staffArr.forEach((item) => {
            teamUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
            console.log("teamAnassignes: ", opsGroupData.opsGroup.opsId, "-", teamUnassign);
          });
          newFinalData[i].opsGroup.unassignBalanace = teamUnassign;
          console.log("tnewFinalData[i].opsGroup.unassignBalanace s: ", opsGroupData.opsGroup.opsId, "-", newFinalData[i].opsGroup.unassignBalanace);
          totalTeamUnassign += teamUnassign;
        }
      }
      // if(!ballotData.isResultRelease && !ballotData.isConduct){
      //     totalTeamUnassign+=finalTotalApplied;
      // }
      res.json({
        success: true,
        data: newFinalData,
        finalTotalQuota,
        finalTotalApplied,
        finalTotalSuccessful,
        totalTeamUnassign,
      });
    }

    // }catch (e) {

    //}
  }

  async getBallotDetail(Id, isLast) {
    // try{
    const selectedBallotId = Id;
    const ballotData = await Ballot.findOne({ _id: selectedBallotId });
    // for BU
    if (ballotData.userFrom === 2) {
      const wonStaffData = [];
      const wonStaffByBu = this.groupByPro(ballotData.wonStaff, "buId");
      for (let buId in wonStaffByBu) {
        const wonStaffByBu_Week = this.groupByPro(wonStaffByBu[buId], "weekNo");
        wonStaffData.push({ buId, wonStaffByBu_Week });
      }
      const appliedStaffData = [];
      const appliedStaffDataByBu = this.groupByPro(ballotData.appliedStaff, "buId");
      for (let buId in appliedStaffDataByBu) {
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByBu[buId], "weekNo");
        appliedStaffData.push({ buId1: buId, appliedStaffDataByBu_Week });
      }
      const actualSlotValueByBuArr = [];
      const ballotRoundResult = {
        quota: 0,
        applied: 0,
        successful: 0,
      };
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slot = ballotData.slotCreation[i];
        // //console.logs('slot', slot);
        const wonBuStaffArr = wonStaffData.filter((bu) => {
          return bu.buId == slot.buId;
        });
        const appliedBuStaffArr = appliedStaffData.filter((bu) => {
          return bu.buId1 == slot.buId;
        });
        let appliedBuStaff = null;
        let wonBuStaff = null;
        if (appliedBuStaffArr.length > 0) {
          appliedBuStaff = appliedBuStaffArr[0];
        }
        if (wonBuStaffArr.length > 0) {
          wonBuStaff = wonBuStaffArr[0];
        }
        const actualSlotValueByBu = {
          buId: slot.buId,
          weekValue: [],
          ballotRoundResultBuWise: {
            quota: 0,
            applied: 0,
            successful: 0,
          },
        };
        slot.arr.forEach((item, index) => {
          const slotValue = item.value;
          ballotRoundResult.quota = ballotRoundResult.quota + slotValue;
          actualSlotValueByBu.ballotRoundResultBuWise.quota = actualSlotValueByBu.ballotRoundResultBuWise.quota + slotValue;
          let appliedValue = 0;
          if (appliedBuStaff && appliedBuStaff.appliedStaffDataByBu_Week["" + index]) {
            appliedValue = appliedBuStaff.appliedStaffDataByBu_Week["" + index].length;
            ballotRoundResult.applied = ballotRoundResult.applied + appliedValue;
            actualSlotValueByBu.ballotRoundResultBuWise.applied = actualSlotValueByBu.ballotRoundResultBuWise.applied + appliedValue;
          }

          let wonValue = 0;
          if (wonBuStaff && wonBuStaff.wonStaffByBu_Week["" + index]) {
            wonValue = wonBuStaff.wonStaffByBu_Week["" + index].length;
            ballotRoundResult.successful = ballotRoundResult.successful + wonValue;
            actualSlotValueByBu.ballotRoundResultBuWise.successful = actualSlotValueByBu.ballotRoundResultBuWise.successful + wonValue;
          }

          actualSlotValueByBu.weekValue.push(`${slotValue}/${appliedValue}/${wonValue}`);
        });
        actualSlotValueByBuArr.push(actualSlotValueByBu);
      }
      res.send({ actualSlotValueByBuArr, ballotRoundResult });
    } else {
      const wonStaffDataOpsGroup = [];
      const wonStaffByOpsGroup = this.groupByPro(ballotData.wonStaff, "opsGroupId");
      for (let opsGroupId in wonStaffByOpsGroup) {
        const wonStaffByBu_Week = this.groupByPro(wonStaffByOpsGroup[opsGroupId], "weekNo");
        wonStaffDataOpsGroup.push({ opsGroupId, wonStaffByBu_Week });
      }
      //console.logs('wonStaffDataOpsGroup', JSON.stringify(wonStaffDataOpsGroup));
      const wonStaffDataOpsTeam = [];
      const wonStaffByOpsTeam = this.groupByPro(ballotData.wonStaff, "opsTeamId");
      for (let opsTeamId in wonStaffByOpsTeam) {
        const opsGroupId = wonStaffByOpsTeam[opsTeamId][0].opsGroupId;
        const wonStaffByBu_Week = this.groupByPro(wonStaffByOpsTeam[opsTeamId], "weekNo");
        wonStaffDataOpsTeam.push({ opsTeamId, opsGroupId, wonStaffByBu_Week });
      }

      const appliedStaffDataOpsGroup = [];
      const appliedStaffDataByOpsGroup = this.groupByPro(ballotData.appliedStaff, "opsGroupId");
      //console.logs('*******');
      // //console.logs('appliedStaffDataByOpsGroup', JSON.stringify(appliedStaffDataByOpsGroup));
      //console.logs('*******');
      for (let opsGroupId in appliedStaffDataByOpsGroup) {
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByOpsGroup[opsGroupId], "weekNo");
        appliedStaffDataOpsGroup.push({
          opsGroupId: opsGroupId,
          appliedStaffDataByBu_Week,
        });
      }
      //console.logs('appliedStaffDataOpsGroup', JSON.stringify(appliedStaffDataOpsGroup));
      //console.logs('*******');
      const appliedStaffDataOpsTeam = [];
      const appliedStaffDataByOpsTeam = this.groupByPro(ballotData.appliedStaff, "opsTeamId");
      for (let opsTeamId in appliedStaffDataByOpsTeam) {
        const opsGroupId = appliedStaffDataByOpsTeam[opsTeamId][0].opsGroupId;
        const appliedStaffDataByBu_Week = this.groupByPro(appliedStaffDataByOpsTeam[opsTeamId], "weekNo");
        appliedStaffDataOpsTeam.push({
          opsTeamId: opsTeamId,
          opsGroupId,
          appliedStaffDataByBu_Week,
        });
      }
      //return res.json({appliedStaffDataOpsTeam,wonStaffDataOpsTeam, wonStaffDataOpsGroup, appliedStaffDataOpsGroup, ballotData});
      let finalValue = [];
      let finalValueTeam = [];
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slotObj = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotObj.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
        if (slotObj.opsTeam.length > 0) {
          // //console.logs('appliedStaffDataOpsTeam', appliedStaffDataOpsTeam);
          const appliedStaffOpsTeamArr = [];
          appliedStaffDataOpsTeam.forEach((item) => {
            for (let i = 0; i < slotObj.opsTeam.length; i++) {
              if (slotObj.opsTeam[i]._id == item.opsTeamId) {
                appliedStaffOpsTeamArr.push(item);
              }
            }
          });
          const wonStaffOpsTeamArr = [];
          wonStaffDataOpsTeam.forEach((item) => {
            ////console.logs('itemitem', item);
            for (let i = 0; i < slotObj.opsTeam.length; i++) {
              // //console.logs('i', i);
              //console.logs('slotObj.opsTeam[i]', slotObj.opsTeam[i]._id, item.opsTeamId);
              if (slotObj.opsTeam[i]._id == item.opsTeamId) {
                //console.logs('hchchchchhc')
                wonStaffOpsTeamArr.push(item);
              }
            }
          });
          // //console.logs('wonStaffOpsTeamArr', wonStaffOpsTeamArr.length);
          const tire1Quota = [];
          finalValueTeam = [];
          slotObj.opsTeam.forEach((team, index) => {
            const teamWiseQuota = {
              teamQuota: 0,
              applied: 0,
              success: 0,
            };
            const appliedStaffTeamObj = appliedStaffOpsTeamArr.filter((appliedTeam) => {
              return appliedTeam.opsTeamId == team._id;
            });

            const wonStaffTeamObj = wonStaffOpsTeamArr.filter((wonTeam) => {
              return wonTeam.opsTeamId == team._id;
            });
            ////console.logs('wonStaffTeamObj', wonStaffTeamObj);
            let teamSlotArr = [];
            for (let j = 0; j < ballotData.weekRange.length; j++) {
              if (index === 0) {
                tire1Quota.push(parseInt(slotObj.weekRangeSlot["" + j + "A"].value));
              }

              const week = ballotData.weekRange[j];
              //console.logs('slotObj.weekRangeSlot[\'\' + j + index].value', slotObj.weekRangeSlot['' + j + index].value);

              const teamQuota = checkIndexFormat ? parseInt(slotObj.weekRangeSlot['OG' + j + 'OT' + index].value) : parseInt(slotObj.weekRangeSlot['' + j + index].value)
              let appliedStaffQuota = 0;
              let successStaffQuota = 0;
              if (appliedStaffTeamObj.length > 0 && appliedStaffTeamObj[0].appliedStaffDataByBu_Week["" + j]) {
                ////console.logs('aa')
                appliedStaffQuota = appliedStaffTeamObj[0].appliedStaffDataByBu_Week["" + j].length;
              }
              if (wonStaffTeamObj.length > 0 && wonStaffTeamObj[0].wonStaffByBu_Week["" + j]) {
                // //console.logs('aa')
                successStaffQuota = wonStaffTeamObj[0].wonStaffByBu_Week["" + j].length;
              }
              teamSlotArr.push({
                teamQuota,
                appliedStaffQuota,
                weekNo: j,
                successStaffQuota,
              });
            }
            //tire1Quota
            let obj = {
              teamId: team._id,
              opsGroupId: slotObj.opsGroup.opsId,
              value: teamSlotArr,
            };
            /*   obj[''+team._id] = [];
                           obj[''+team._id] = teamSlotArr;
                           obj.tire1Quota = tire1Quota;*/
            finalValueTeam.push(obj);
            teamSlotArr = [];
            if (index === slotObj.opsTeam.length - 1) {
              for (let k = 0; k < ballotData.weekRange.length; k++) {
                let totalTeamQuota = 0;
                let totalTeamSuccess = 0;
                let totalTeamApplied = 0;
                slotObj.opsTeam.forEach((insideTeam, indexIndex) => {
                  //totalTeamQuota = totalTeamQuota + finalValueTeam[indexIndex].value[k].teamQuota;
                  totalTeamSuccess = totalTeamSuccess + finalValueTeam[indexIndex].value[k].successStaffQuota;
                  totalTeamApplied = totalTeamApplied + finalValueTeam[indexIndex].value[k].appliedStaffQuota;
                });
                //totalTeamQuota = totalTeamQuota + finalValueTeam[indexIndex].value[k].teamQuota;
                teamSlotArr.push({
                  teamQuota: tire1Quota[k],
                  appliedStaffQuota: totalTeamApplied,
                  weekNo: k,
                  successStaffQuota: totalTeamSuccess,
                });
              }
              obj = {
                teamId: "Tier 1",
                opsGroupId: slotObj.opsGroup.opsId,
                value: teamSlotArr,
              };
              finalValueTeam.push(obj);
            }
          });

          finalValue.push(finalValueTeam);
        } else {
          console.log("call");
          finalValueTeam = [];
          const noOpsTeamAppliedDataArr = appliedStaffDataOpsGroup.filter((item) => {
            return item.opsGroupId == slotObj.opsGroup.opsId;
          });
          const noOpsTeamWonDataArr = wonStaffDataOpsGroup.filter((item) => {
            return item.opsGroupId == slotObj.opsGroup.opsId;
          });
          let obj = {
            teamId: null,
            opsGroupId: slotObj.opsGroup.opsId,
            value: [],
          };
          let teamSlotArr = [];
          for (let i = 0; i < ballotData.weekRange.length; i++) {
            let teamQuota = parseInt(slotObj.weekRangeSlot["" + i + "A"].value);

            let appliedStaffQuota = 0;
            if (
              noOpsTeamAppliedDataArr &&
              noOpsTeamAppliedDataArr.length > 0 &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i] &&
              noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i].length > 0
            ) {
              appliedStaffQuota = noOpsTeamAppliedDataArr[0].appliedStaffDataByBu_Week[i].length;
            }
            let successStaffQuota = 0;
            if (
              noOpsTeamWonDataArr &&
              noOpsTeamWonDataArr.length &&
              noOpsTeamWonDataArr[0].wonStaffByBu_Week[i] &&
              noOpsTeamWonDataArr[0].wonStaffByBu_Week[i].length > 0
            ) {
              successStaffQuota = noOpsTeamWonDataArr[0].wonStaffByBu_Week[i].length;
            }
            teamSlotArr.push({
              teamQuota,
              appliedStaffQuota,
              weekNo: i,
              successStaffQuota,
            });
          }
          obj.value = teamSlotArr;

          finalValueTeam.push(obj);
          finalValue.push(finalValueTeam);
        }
      }
      //return res.json({finalValue})

      const newFinalData = [];
      let finalTotalApplied = 0;
      let finalTotalQuota = 0;
      let totalTeamQuota = 0;
      let finalTotalSuccessful = 0;
      for (let i = 0; i < ballotData.slotCreation.length; i++) {
        const slotData = ballotData.slotCreation[i];
        const weekRangeSlotList = Object.keys(slotData.weekRangeSlot);
        const checkIndexFormat = weekRangeSlotList.includes('OG0OT0');
        const opsGroupData = finalValue[i];
        let totalBalanceTeamQuota = 0;
        slotData.opsGroup.balanceQuota = 0;
        slotData.opsGroup.applied = 0;
        slotData.opsGroup.quota = 0;
        slotData.opsGroup.successful = 0;

        for (let j = 0; j < opsGroupData.length; j++) {
          if (opsGroupData.length - 1 !== j) {
            slotData.opsTeam[j].balanceQuota = 0;
            slotData.opsTeam[j].applied = 0;
            slotData.opsTeam[j].quota = 0;
            slotData.opsTeam[j].successful = 0;
          }
        }
        for (let k = 0; k < ballotData.weekRange.length; k++) {
          let teamQuota = 0;
          let teamBallanceReaming = 0;
          for (let j = 0; j < opsGroupData.length; j++) {
            if (opsGroupData.length - 1 === j) {
              // for tire 1
              //slotData.opsTeam[j].isShow = true;
              if (opsGroupData.length === 1) {
                slotData.opsGroup.applied += opsGroupData[j].value[k].appliedStaffQuota;
                // slotData.opsGroup.quota +=  opsGroupData[j].value[k].teamQuota;
                slotData.opsGroup.successful += opsGroupData[j].value[k].successStaffQuota;
              }
              slotData.weekRangeSlot["" + k + "A"].value = opsGroupData[j].value[k];
              //console.logs('opsGroupData[j].value[k]', opsGroupData[j].value[k]);
              finalTotalApplied += opsGroupData[j].value[k].appliedStaffQuota;
              finalTotalSuccessful += opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.balanceQuota += opsGroupData[j].value[k].teamQuota - opsGroupData[j].value[k].successStaffQuota;
              if (teamBallanceReaming < slotData.opsGroup.balanceQuota && opsGroupData.length !== 1) {
                slotData.opsGroup.balanceQuota = teamBallanceReaming;
              }
              //console.logs('finalTotalQuotafinalTotalQuota', finalTotalQuota, teamQuota, opsGroupData[j].value[k].teamQuota)
              if (teamQuota < opsGroupData[j].value[k].teamQuota && opsGroupData.length > 1) {
                //console.logs("TEAMQUOTA IS: ",teamQuota);
                finalTotalQuota += teamQuota;
                slotData.opsGroup.quota += teamQuota;
              } else {
                finalTotalQuota += opsGroupData[j].value[k].teamQuota;
                slotData.opsGroup.quota += opsGroupData[j].value[k].teamQuota;
              }
            } else {
              slotData.opsTeam[j].isShow = true;
              if(checkIndexFormat){
                slotData.weekRangeSlot['OG' + k +'OT'+ j].value = opsGroupData[j].value[k];
              } else {
                slotData.weekRangeSlot['' + k + j].value = opsGroupData[j].value[k];
              }
              slotData.opsTeam[j].balanceQuota += opsGroupData[j].value[k].teamQuota - opsGroupData[j].value[k].successStaffQuota;
              slotData.opsTeam[j].applied += opsGroupData[j].value[k].appliedStaffQuota;
              slotData.opsTeam[j].quota += opsGroupData[j].value[k].teamQuota;
              teamQuota += opsGroupData[j].value[k].teamQuota;
              totalTeamQuota += slotData.opsTeam[j].quota;
              slotData.opsTeam[j].successful += opsGroupData[j].value[k].successStaffQuota;
              slotData.opsGroup.applied += opsGroupData[j].value[k].appliedStaffQuota;
              //slotData.opsGroup.quota +=  opsGroupData[j].value[k].teamQuota;
              slotData.opsGroup.successful += opsGroupData[j].value[k].successStaffQuota;
            }
            if (opsGroupData.length - 1 !== j) {
              totalBalanceTeamQuota += slotData.opsTeam[j].balanceQuota;
              teamBallanceReaming += slotData.opsTeam[j].balanceQuota;
            }
          }
        }
        // remove code for changing balance quota
        /*  if(totalBalanceTeamQuota< slotData.opsGroup.balanceQuota && opsGroupData.length !== 1){
                      slotData.opsGroup.balanceQuota = totalBalanceTeamQuota;
                  }*/
        newFinalData.push(slotData);
      }
      let leaveFormat = 5;
      if (ballotData.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballotData.leaveConfiguration === 3) {
        leaveFormat = 7;
      }
      let totalTeamUnassign = 0;
      for (let i = 0; i < newFinalData.length; i++) {
        const opsGroupData = newFinalData[i];
        newFinalData[i].opsGroup.unassignBalanace = 0;

        if (opsGroupData.opsTeam.length > 0) {
          for (let j = 0; j < opsGroupData.opsTeam.length; j++) {
            const opsTeamData = opsGroupData.opsTeam[j];
            const opsTeamUser = await OpsTeam.findOne({ _id: opsTeamData._id }, { userId: 1, _id: 0 }).lean();
            const leaveBallanceData = await StaffSapData.find({ staff_Id: { $in: opsTeamUser.userId } }, { ballotLeaveBalanced: 1, _id: 0 }).lean();
            let teamUnassign = 0;
            leaveBallanceData.forEach((item) => {
              teamUnassign += Math.floor(item.ballotLeaveBalanced / leaveFormat);
            });
            // remove comment
            if (!ballotData.isResultRelease && !ballotData.isConduct) {
              teamUnassign += newFinalData[i].opsTeam[j].applied;
            }
            newFinalData[i].opsTeam[j].unassignBalanace = teamUnassign;
            totalTeamUnassign += teamUnassign;
            newFinalData[i].opsGroup.unassignBalanace += teamUnassign;
          }
        } else {
          // no team
          const opsTeamUser = await OpsGroup.findOne({ _id: opsGroupData.opsGroup.opsId }, { userId: 1, _id: 0 }).lean();
          const leaveBallanceData = await StaffSapData.find({ staff_Id: { $in: opsTeamUser.userId } }, { ballotLeaveBalanced: 1, _id: 0 }).lean();
          let teamUnassign = 0;
          leaveBallanceData.forEach((item) => {
            teamUnassign += Math.floor(item.ballotLeaveBalanced / leaveFormat);
          });
          newFinalData[i].opsGroup.unassignBalanace = teamUnassign;
          totalTeamUnassign += teamUnassign;
        }
      }
      // if(!ballotData.isResultRelease && !ballotData.isConduct){
      //     totalTeamUnassign+=finalTotalApplied;
      // }
      return {
        success: true,
        data: newFinalData,
        finalTotalQuota,
        finalTotalApplied,
        finalTotalSuccessful,
        totalTeamUnassign,
      };
    }

    // }catch (e) {

    //}
  }
  async ballotDetailAll(req, res) {
    // last round come first
    const ballotId = req.body.selectedBallotId;
    let allData = [];
    let quotaCal = [];
    const len = ballotId.length - 1;
    let finalTotalQuota = 0,
      finalTotalApplied = 0,
      finalTotalSuccessful = 0,
      totalTeamUnassign = 0;
    for (let i = 0; i < ballotId.length; i++) {
      if (0 === i) {
        const data = await this.getBallotDetail(ballotId[i], true);
        totalTeamUnassign = data.totalTeamUnassign;

        finalTotalQuota = data.finalTotalQuota;
        finalTotalApplied = data.finalTotalApplied;
        finalTotalSuccessful = data.finalTotalSuccessful;
        quotaCal.push({
          finalTotalQuota,
          finalTotalSuccessful,
          finalTotalApplied,
        });
        allData.push(data.data);
      } else {
        const data = await this.getBallotDetail(ballotId[i], false);
        quotaCal.push({
          finalTotalQuota: data.finalTotalQuota,
          finalTotalSuccessful: data.finalTotalSuccessful,
          finalTotalApplied: data.finalTotalApplied,
        });
        finalTotalQuota += data.finalTotalQuota;
        finalTotalApplied += data.finalTotalApplied;
        finalTotalSuccessful += data.finalTotalSuccessful;
        allData.push(data.data);
      }
    }
    let actualData = {};
    for (let i = 0; i < allData.length; i++) {
      const dataObj = allData[i];
      if (i === 0) {
        actualData = dataObj;
      } else {
        for (let j = 0; j < dataObj.length; j++) {
          const obj = dataObj[j];
          const weekObj = obj.weekRangeSlot;
          for (let key in weekObj) {
            if (weekObj.hasOwnProperty(key)) {
              //console.logs(key, weekObj[key].value.teamQuota, actualData[j].weekRangeSlot[key].value.teamQuota);
              actualData[j].weekRangeSlot[key].value.teamQuota = weekObj[key].value.teamQuota;
              //actualData[j].weekRangeSlot[key].value.teamQuota += weekObj[key].value.teamQuota;
              actualData[j].weekRangeSlot[key].value.appliedStaffQuota += weekObj[key].value.appliedStaffQuota;
              actualData[j].weekRangeSlot[key].value.successStaffQuota += weekObj[key].value.successStaffQuota;
            }
          }
        }
      }
    }
    quotaCal = quotaCal.reverse();
    let finalQuota = 0;
    let preQuota = 0;
    let preSuccess = 0;
    quotaCal.forEach((item, index) => {
      if (index === 0) {
        finalQuota = item.finalTotalQuota;
        preQuota = item.finalTotalQuota;
        preSuccess = item.finalTotalSuccessful;
      } else {
        //finalQuota = finalQuota+(item.finalTotalQuota -preQuota-preSuccess);
        preQuota = item.finalTotalQuota;
        preSuccess = item.finalTotalSuccessful;
      }
    });
    return res.json({
      success: true,
      data: actualData,
      finalTotalQuota: finalQuota,   
      finalTotalApplied,
      finalTotalSuccessful,
      totalTeamUnassign,
    });
  }
  async ballotConsolidatedResult(req, res) {
    // last round come first
    const ballotId = req.body.selectedBallotId;
    let allData = [];
    let quotaCal = [];
    const len = ballotId.length - 1;
    let finalTotalQuota = 0,
      finalTotalApplied = 0,
      finalTotalSuccessful = 0,
      totalTeamUnassign = 0;
    for (let i = 0; i < ballotId.length; i++) {
      if (0 === i) {
        const data = await this.getBallotDetail(ballotId[i], true);
        totalTeamUnassign = data.totalTeamUnassign;

        finalTotalQuota = data.finalTotalQuota;
        finalTotalApplied = data.finalTotalApplied;
        finalTotalSuccessful = data.finalTotalSuccessful;
        //console.logs('xxxxxxxxxxxxxxxxxx',finalTotalQuota, finalTotalSuccessful);
        quotaCal.push({
          finalTotalQuota,
          finalTotalSuccessful,
          finalTotalApplied,
        });
        allData.push(data.data);
      } else {
        const data = await this.getBallotDetail(ballotId[i], false);
        quotaCal.push({
          finalTotalQuota: data.finalTotalQuota,
          finalTotalSuccessful: data.finalTotalSuccessful,
          finalTotalApplied: data.finalTotalApplied,
        });
        finalTotalQuota += data.finalTotalQuota;
        finalTotalApplied += data.finalTotalApplied;
        finalTotalSuccessful += data.finalTotalSuccessful;
        allData.push(data.data);
      }
    }
    quotaCal = quotaCal.reverse();
    //return res.json({quotaCal})
    let finalQuota = 0;
    let preQuota = 0;
    let preSuccess = 0;
    quotaCal.forEach((item, index) => {
      if (index === 0) {
        finalQuota = item.finalTotalQuota;
        preQuota = item.finalTotalQuota;
        preSuccess = item.finalTotalSuccessful;
      } else {
        //console.logs('finalQuota', finalQuota, item.finalTotalQuota);
        finalQuota = finalQuota + (item.finalTotalQuota - (preQuota - preSuccess));
        preQuota = item.finalTotalQuota;
        preSuccess = preSuccess + item.finalTotalSuccessful;
      }
    });
    return res.json({
      success: true,
      finalTotalQuota: finalQuota,
      finalTotalSuccess: preSuccess,
    });
  }
  groupByPro(xs, key) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }

  async ballotDetailsByUsers(req, res) {
    try {
      let ballotId = req.params.id;

      const parentBallot = await Ballot.findOne({ _id: ballotId });

      let userList = [];
      if (!parentBallot) {
        return res.json({
          status: false,
          message: "Coulden't find requested ballot ",
        });
      } else {
        var applied = groupByA(parentBallot.appliedStaff, function (item) {
          return [item.userId, item.opsGroupId, item.opsTeamId];
        });
        // var won = groupByA(parentBallot.wonStaff, function(item)
        // {
        //     return [item.userId, item.opsGroupId,item.opsTeamId];
        // });

        var won = groupByAuto(parentBallot.wonStaff, function (item) {
          return [item.userId, item.opsGroupId, item.opsTeamId, item.isAutoAssign];
        });
        console.log("autoassignedwon: ", won);

        for (var key of applied) {
          let user = {};
          user.user = await User.findOne({ _id: key.userId }, { _id: 1, name: 1, staffId: 1 });
          user.Ops = await OpsGroup.findOne({ _id: key.opsId }, { _id: 1, opsGroupName: 1 });
          if (key.teamId !== null || key.teamId !== undefined) {
            user.Team = await OpsTeam.findOne({ _id: key.teamId }, { _id: 1, name: 1 });
          } else {
            user.Team = {};
            user.Team.name = " ";
          }
          user.userId = key.userId;
          user.opsId = key.opsId;
          user.teamId = key.teamId;
          user.applied = key.data.length;
          user.ballotId = parentBallot._id;
          user.ballotRound = 1;
          user.wonCount = 0;

          userList.push(user);
        }

        for (var ulist of userList) {
          for (var wins = 0; wins <= won.length - 1; wins++) {
            if (ulist.userId == won[wins].userId && ulist.opsId == won[wins].opsId && ulist.teamId == won[wins].teamId && !won[wins].isAuto) {
              ulist.wonCount = won[wins].data.length;
            } else {
              //console.logs("not same data here");
            }
          }
        }

        if (parentBallot.childBallots && parentBallot.childBallots.length > 0) {
          for (let child = 0; child <= parentBallot.childBallots.length - 1; child++) {
            const childBallot = await Ballot.findOne({
              _id: parentBallot.childBallots[child],
            });
            if (!childBallot) {
              return res.json({
                status: false,
                message: "Coulden't find requested ballot ",
              });
            } else {
              if (childBallot.isAutoAssign) {
                var won = groupByAuto(childBallot.wonStaff, function (item) {
                  return [item.userId, item.opsGroupId, item.opsTeamId, item.isAutoAssign];
                });

                for (var key of won) {
                  let user = {};
                  user.user = await User.findOne({ _id: key.userId }, { _id: 1, name: 1, staffId: 1 });
                  user.Ops = await OpsGroup.findOne({ _id: key.opsId }, { _id: 1, opsGroupName: 1 });
                  if (key.teamId !== null || key.teamId !== undefined) {
                    user.Team = await OpsTeam.findOne({ _id: key.teamId }, { _id: 1, name: 1 });
                  } else {
                    user.Team = {};
                    user.Team.name = " ";
                  }
                  user.userId = key.userId;
                  user.opsId = key.opsId;
                  user.teamId = key.teamId;
                  user.applied = 0;
                  user.ballotId = childBallot._id;
                  user.ballotRound = childBallot.ballotRound + 1;
                  user.wonCount = key.data.length;
                  userList.push(user);
                }
              } else {
                var applied = groupByA(childBallot.appliedStaff, function (item) {
                  return [item.userId, item.opsGroupId, item.opsTeamId];
                });
                var won = groupByAuto(childBallot.wonStaff, function (item) {
                  return [item.userId, item.opsGroupId, item.opsTeamId, item.isAutoAssign];
                });

                for (var key of applied) {
                  let user = {};
                  user.user = await User.findOne({ _id: key.userId }, { _id: 1, name: 1, staffId: 1 });
                  user.Ops = await OpsGroup.findOne({ _id: key.opsId }, { _id: 1, opsGroupName: 1 });
                  if (key.teamId !== null || key.teamId !== undefined) {
                    user.Team = await OpsTeam.findOne({ _id: key.teamId }, { _id: 1, name: 1 });
                  } else {
                    user.Team = {};
                    user.Team.name = " ";
                  }
                  user.userId = key.userId;
                  user.opsId = key.opsId;
                  user.teamId = key.teamId;
                  user.applied = key.data.length;
                  user.ballotId = childBallot._id;
                  user.ballotRound = childBallot.ballotRound + 1;
                  user.wonCount = 0;
                  userList.push(user);
                }

                for (var ulist of userList) {
                  for (var wins = 0; wins <= won.length - 1; wins++) {
                    if (ulist.userId == won[wins].userId && ulist.opsId == won[wins].opsId && ulist.teamId == won[wins].teamId && !won[wins].isAuto) {
                      ulist.wonCount = won[wins].data.length;
                    } else {
                      //console.logs("not same data here");
                    }
                  }
                }
                //console.logs("child yep");
              }
            }
          }

          //console.logs("child yep here nw");
          res.send({ userlist: userList });
        } else {
          res.send({ userlist: userList });
        }
        //console.logs("sending all at once");
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong", e });
    }

    function groupByA(array, f) {
      var groups = {};
      array.forEach(function (o) {
        var group = JSON.stringify(f(o));

        groups[group] = groups[group] || [];

        groups[group].push(o);
      });

      return Object.keys(groups).map(function (group) {
        var array = JSON.parse("[" + group + "]");
        return {
          userId: array[0][0],
          opsId: array[0][1],
          teamId: array[0][2],
          data: groups[group],
        };
      });
    }

    function groupByAuto(array, f) {
      var groups = {};
      array.forEach(function (o) {
        var group = JSON.stringify(f(o));

        groups[group] = groups[group] || [];

        groups[group].push(o);
      });

      return Object.keys(groups).map(function (group) {
        var array = JSON.parse("[" + group + "]");
        return {
          userId: array[0][0],
          opsId: array[0][1],
          teamId: array[0][2],
          isAuto: array[0][3],
          data: groups[group],
        };
      });
    }
  }

  async addAsBallotAdmin(req, res) {
    try {
      let users = req.body.userIds;
      let user1 = await User.updateMany({ isBallotAdmin: true }, { $set: { isBallotAdmin: false } });
      for (let u = 0; u <= users.length - 1; u++) {
        let id = users[u].toString();
        //console.logs("USERis: ",id);
        //let user = await User.find({_id: id});

        let user = await User.findOneAndUpdate({ _id: id }, { $set: { isBallotAdmin: true } });
        //console.logs("USers: ",user);
      }
      return res.json({ status: true, message: "Saved Successfully." });
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong", e });
    }
  }

  async getballotAdmins1(req, res) {
    try {
      let Users = await User.find({ isBallotAdmin: true }, { _id: 1, name: 1, staffId: 1 });
      return res.json({
        status: true,
        data: Users,
        message: "Users retrieved successfully.",
      });
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong", e });
    }
  }

  async getBallotPerStaffData(req, res) {
    let body = req.body;
    //console.logs("UESR ID HERE IS: ",body.userId);
    let ballot = await Ballot.findOne({ _id: body.id });

    if (!ballot) {
      return res.json({
        status: false,
        message: "requested ballot for this user could not found",
        e,
      });
    } else {
      let resObj = {};
      resObj.ballotStartDate = ballot.ballotStartDate;
      resObj.ballotEndDate = ballot.ballotEndDate;

      resObj.leaveType = ballot.leaveType;
      resObj.maxConsecutiveBallot = ballot.maxConsecutiveBallot;
      resObj.applicationCloseDateTime = ballot.applicationCloseDateTime;
      resObj.opsGroup = body.opsGroup;

      let applied = ballot.appliedStaff.filter((x) => x.userId.toString() === body.userId.toString());
      let won = ballot.wonStaff.filter((x) => x.userId.toString() === body.userId.toString());
      let winSlots = [];
      if (applied.length > 0 && won.length > 0) {
        for (var a = 0; a <= applied.length - 1; a++) {
          let slot = applied[a].weekNo;
          let oneSlot = {};
          oneSlot.start = ballot.weekRange[slot].start;
          oneSlot.end = ballot.weekRange[slot].end;
          oneSlot.weekNo = slot;
          oneSlot.staffStatus = "";
          if (ballot.isConduct) {
            //console.logs("INIF");
            oneSlot.staffStatus = "Unsuccessful";
          }

          for (var w = 0; w <= won.length - 1; w++) {
            if (applied[a].userId.toString() === won[w].userId.toString() && applied[a].weekNo === won[w].weekNo) {
              oneSlot.staffStatus = "Successful";
            }
          }
          winSlots.push(oneSlot);
        }
      }
      if (ballot.isAutoAssign === true) {
        const result = won.filter((staff) => staff.isAutoAssign === true);
        if (result.length > 0) {
          for (let r = 0; r <= result.length - 1; r++) {
            let slot = result[r].weekNo;
            let oneSlot = {};
            oneSlot.start = ballot.weekRange[slot].start;
            oneSlot.end = ballot.weekRange[slot].end;
            oneSlot.weekNo = slot;
            oneSlot.staffStatus = "autoAssigned";
            winSlots.push(oneSlot);
          }
        }
      }
      if (applied.length > 0 && !won.length > 0) {
        for (var a = 0; a <= applied.length - 1; a++) {
          let slot = applied[a].weekNo;
          let oneSlot = {};
          oneSlot.start = ballot.weekRange[slot].start;
          oneSlot.end = ballot.weekRange[slot].end;
          oneSlot.weekNo = slot;
          oneSlot.staffStatus = "";
          if (ballot.isResultRelease) {
            //console.logs("INIF");
            oneSlot.staffStatus = "Unsuccessful";
          }
          winSlots.push(oneSlot);
        }
      }
      //  if(won.length>0){
      //      for(var w=0;w<=won.length-1;w++){
      //          let slot= won[w].weekNo;
      //          let oneSlot ={};
      //          oneSlot.start = ballot.weekRange[slot].start;
      //          oneSlot.end = ballot.weekRange[slot].end;
      //          oneSlot.weekNo = slot;
      //          winSlots.push(oneSlot);
      //      }
      //  }
      resObj.won = winSlots;
      return res.json({
        status: true,
        data: resObj,
        message: "successfully retrived ballot data",
      });
    }
  }
  async cancelBallotAll(req, res) {
    let id = req.params.id;
    //return res.json({id})
    const updateLeaveBy = [];
    const ballot = await Ballot.findOne(
      { _id: id },
      {
        ballotName: 1,
        wonStaff: 1,
        leaveConfiguration: 1,
        childBallots: 1,
        opsGroupId: 1,
        userFrom: 1,
        appliedStaff: 1,
        isConduct: 1,
        ballotStartDate: 1
      }
    );
    let leaveFormat = 5;
    if (ballot.leaveConfiguration === 2) {
      leaveFormat = 6;
    } else if (ballot.leaveConfiguration === 3) {
      leaveFormat = 7;
    }
    if (ballot.leaveType == 2) {
      leaveFormat = 1;
    }
    if (!ballot) {
      return res.json({
        status: false,
        message: "Problem receiving ballot id",
      });
    }
    let wonStaff;
    if (ballot.isConduct) {
      wonStaff = groupBy(ballot.wonStaff, "userId");
      if (ballot.isResultRelease) {
        await LeaveApplied.deleteMany({ ballotId: ballot._id });
      }
    } else {
      wonStaff = groupBy(ballot.appliedStaff, "userId");
    }
    for (var key in wonStaff) {
      //console.logs(key, wonStaff[key]);
      let keyP = key;

      let keyV = wonStaff[key].length;
      let valueOfKey = leaveFormat * keyV;
      updateLeaveBy.push({ key: keyP, leave: valueOfKey, data: wonStaff[key] });
    }

    if (ballot.childBallots && ballot.childBallots.length > 0) {
      //console.logs("IN IF");

      for (var i = 0; i <= ballot.childBallots.length - 1; i++) {
        //console.logs(ballot.childBallots[i])
        let cid = ballot.childBallots[i];
        const cBallot = await Ballot.findOne({ _id: cid }, { appliedStaff: 1, wonStaff: 1, leaveConfiguration: 1, isConduct: 1 });
        let cWOn;
        if (cBallot.isConduct) {
          cWOn = groupBy(cBallot.wonStaff, "userId");
          if (cBallot.isResultRelease) {
            await LeaveApplied.deleteMany({ ballotId: cBallot._id });
          }
        } else {
          cWOn = groupBy(cBallot.appliedStaff, "userId");
        }

        for (var keyc in cWOn) {
          //console.logs(keyc, cWOn[keyc]);
          let keyPP = keyc;
          let keyVP = cWOn[keyc].length;
          let valueOfKeyP = leaveFormat * keyVP;
          updateLeaveBy.push({ key: keyPP, leave: valueOfKeyP, data: keyVP });
        }
      }
    }
    const annL = await leaveType.findOne({ companyId: req.user.companyId, isActive: true });
    const fYear = new Date(ballot.ballotStartDate).getFullYear();
    //return res.json({updateLeaveBy})
    for (let i = 0; i < updateLeaveBy.length; i++) {
      const user = updateLeaveBy[i];
      //console.logs('user', user)
      const uuu = await this.managePlanLeaveCancel(user.key, user.leave, annL._id, fYear);
      // if (user.leave > 0) {
      //   const staffLeavedata = await StaffSapData.findOne({
      //     staff_Id: user.key,
      //   });
      //   if (staffLeavedata) {
      //     let totalLeave = staffLeavedata.ballotLeaveBalanced + user.leave;
      //     if (totalLeave > staffLeavedata.leavesBalanced) {
      //       totalLeave = staffLeavedata.leavesBalanced;
      //     }
      //     //console.logs("staffLeavedata: ", staffLeavedata);
      //     const update = await StaffSapData.update({ staff_Id: user.key }, { $set: { ballotLeaveBalanced: totalLeave } });
      //   }
      // }
    }

    const ballotupdate = await Ballot.update({ _id: id }, { isCanceled: true });
    this.deleteEvent(id).then((re)=>{
      console.log('deleted ballot cron')
    })
    for (var i = 0; i <= ballot.childBallots.length - 1; i++) {
      this.deleteEvent(ballot.childBallots[i]).then((re)=>{
        console.log('deleted ballot cron')
      })
      const ballotupdate1 = await Ballot.update({ _id: ballot.childBallots[i] }, { isCanceled: true });
    }
    ballotCancelledNotifications(ballot);
    return res.status(201).json({ status: true, message: "Ballot Cancelled successfully." });

    // return res.json(updateLeaveBy);

    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
  }
  async managePlanLeaveCancel(userId, leaveQuota, leaveTypeId, startYear = new Date().getFullYear()) {
    console.log("leave aa", leaveQuota, userId, leaveTypeId, startYear);
    const updateStaffLeave = await staffLeave.findOneAndUpdate(
      { userId, leaveDetails: { "$elemMatch": { "year": startYear, leaveTypeId: leaveTypeId } } },
      { $inc: { "leaveDetails.$.planQuota": leaveQuota, "leaveDetails.$.request": leaveQuota } }
    );
    return updateStaffLeave;
  }
  async checkIfHasParent(ballotid) {
    let currentBallot = await Ballot.findOne({ _id: ballotid }, { parentBallot: 1, childBallots: 1 });
    if (!currentBallot) {
      //console.logs("NO ballot found");
    } else {
      //console.logs("in else of current data found");
      if (currentBallot.parentBallot) {
        //console.logs("in if of parent data",currentBallot.parentBallot);
        return this.checkIfHasParent(currentBallot.parentBallot);
      }
      if (currentBallot.childBallots && currentBallot.childBallots.length > 0) {
        let list = [];
        list.push(currentBallot._id.toString());
        for (let i = 0; i <= currentBallot.childBallots.length - 1; i++) {
          list.push(currentBallot.childBallots[i].toString());
        }
        // list=list.concat(currentBallot.childBallots);
        console.log("list s: ", list);

        return list;
      }
    }
  }

  async getUserLeavePlans(req, res) {
    try {
      let user = req.user._id;
      user = "5f5fdde0f126bb068ad3a570";
      console.log("User:", user);
      let todayIs = new Date();

      // const ballotList = await Ballot.find({$or:[{'wonStaff.userId': user}], isPublish: true,isDeleted:false,isResultRelease:true}, {_id:1,ballotName:1,leaveType:1,weekRange:1,wonStaff:1,isCanceled:1,ballotRound:1,isAutoAssign:1,parentBallot:1,childBallots:1});

      const allocatedLeaves = await userLeaves.find({
        userId: user,
        type: { $in: [1, 2, 3] },
        status: { $in: ["Allocated", "Balloted"] },
      });
      console.log("allocatedLeaves: ", allocatedLeaves);
      const thsUser = await User.findOne({ _id: user }, { isLeaveSwapAllowed: 1, name: 1 });

      let weeksToApply = 1;
      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .select("opsGroup")
        .lean();
      if (pageSettingData.opsGroup.minWeeksBeforeSwop) {
        weeksToApply = pageSettingData.opsGroup.minWeeksBeforeSwop;
      }
      let totaldays = weeksToApply * 7;
      // ballotList = JSON.stringify(ballotList);
      //ballotList = JSON.parse(ballotList);
      let ballots = [];
      const swopingsFrom = await swopRequests.find({ userFrom: req.user._id, requestStatus: 1 }, { requestStatus: 1, userFrom: 1, leaveFrom: 1, leaveTo: 1 });
      const swopingsTo = await swopRequests.find({ userTo: req.user._id, requestStatus: 1 }, { userTo: 1, requestStatus: 1, leaveFrom: 1, leaveTo: 1 });
      console.log(" const swopingsTo : ", swopingsTo);
      const opsGrp = await OpsGroup.findOne({ userId: user, isDelete: false }, { swopSetup: 1 });

      if (allocatedLeaves.length > 0) {
        for (let a = 0; a <= allocatedLeaves.length - 1; a++) {
          console.log("CAME AGAIN :.....................");
          let leave = {};
          let from = allocatedLeaves[a].fromdate.split("-");
          let startdd = new Date(allocatedLeaves[a].fromdate);
          from = from[2] + "-" + from[1] + "-" + from[0];
          let to = allocatedLeaves[a].todate.split("-");
          let enddd = new Date(allocatedLeaves[a].todate);
          to = to[2] + "-" + to[1] + "-" + to[0];

          var days = Math.floor((enddd - startdd) / (1000 * 60 * 60 * 24));
          leave.days = days + 1;
          leave.ballotStartDate = allocatedLeaves[a].fromdate;
          leave.ballotEndDate = allocatedLeaves[a].todate;
          leave.leaveId = allocatedLeaves[a]._id;
          if (allocatedLeaves[a].type == 1) {
            leave.leaveType = 5;
          } else {
            leave.leaveType = allocatedLeaves[a].type;
          }

          leave.startdate = startdd;
          if (opsGrp && opsGrp.swopSetup) {
            leave.swapRequest = parseInt(opsGrp.swopSetup);
            if (leave.swapRequest == 1 || leave.swapRequest == 2) {
              if (thsUser.isLeaveSwapAllowed == true) {
                leave.swapRequest = 0;
              }
            }
          }

          var daysleft = Math.floor((startdd - todayIs) / (1000 * 60 * 60 * 24));

          daysleft = daysleft + 1;

          if (daysleft < 0 || daysleft < totaldays) {
            leave.swapRequest = 0;
          }

          if (swopingsFrom.length > 0) {
            //SwoppingFrom means - I have sent this swap request for this slot.
            let swopping = swopingsFrom.filter((qw) => {
              if (qw.leaveFrom) {
                return qw.leaveFrom.toString() == allocatedLeaves[a]._id.toString();
              } else {
                console.log("OUT");
              }
            });

            if (swopping.length > 0) {
              leave.swoppingFrom = true;
            }
          }

          if (swopingsTo.length > 0) {
            //SwoppingFrom means - I have sent this swap request for this slot.
            let swopping = swopingsTo.filter((qw) => {
              if (qw.leaveTo) {
                return qw.leaveTo.toString() == allocatedLeaves[a]._id.toString();
              } else {
                console.log("OUT");
              }
            });

            if (swopping.length > 0) {
              leave.swoppingTo = true;
              leave.swoppingToCount = swopping.length;
            }
          }

          let leaveAppliedFor = await leaveApplications.find({
            leaveId: allocatedLeaves[a]._id,
            userId: req.user._id,
          });

          if (leaveAppliedFor.length > 0) {
            leave.isLeaveApplied = true;
          } else {
            leave.isLeaveApplied = false;
          }

          ballots.push(leave);
        }
      }

      const BB = ballots.sort((a, b) => b.startdate - a.startdate);
      BB == BB.reverse();
      return res.status(201).json({
        success: true,
        data: BB,
      });
    } catch (e) {
      return res.status(500).json({
        success: false,
        data: e,
        message: "Something went wrong",
      });
    }
  }




  async exportBallotByUser(req, res) {
    let ballotId = req.params.id;
    //console.log("BallotId is: ",ballotId);
    var maxSuccess = 0;
    var weekRangeArr = [];
    try {
      const parentBallot = await Ballot.findOne({ _id: ballotId }).populate([{
        path: "opsGroupId",
        select: "opsGroupName opsTeamId userId",
        populate: [{
          path: "opsTeamId",
          select: "name userId"
        }, {
          path: "userId",
          select: "staffId name parentBussinessUnitId",
          populate: [{
            path: "parentBussinessUnitId",
            select: "name",
            populate: {
              path: "sectionId",
              select: "name",
              populate: {
                path: "departmentId",
                select: "name",
                populate: {
                  path: "companyId",
                  select: "name",
                },
              },
            }
          }]
        }]
      }]);


      //return res.json({ parentBallot })
      //console.log("parent Ballot is: ",parentBallot);

      let userList = [];
      if (!parentBallot) {
        return res.json({
          status: false,
          message: "Coulden't find requested ballot ",
        });
      } else {
        let totalUserList = [];
        for (let opIndexU = 0; opIndexU < parentBallot.opsGroupId.length; opIndexU++) {
          let opUsers = JSON.parse(JSON.stringify(parentBallot.opsGroupId[opIndexU].userId));

          for (let ij = 0; ij < opUsers.length; ij++) {
            opUsers[ij].Ops = {
              _id: parentBallot.opsGroupId[opIndexU]._id,
              opsGroupName: parentBallot.opsGroupId[opIndexU].opsGroupName
            }

            let uuId = opUsers[ij]._id;
            const oTeam = {}
            parentBallot.opsGroupId[opIndexU].opsTeamId.forEach((item) => {
              const isFound = item.userId.filter((u) => {
                return u == uuId;
              })
              if (isFound && isFound.length > 0) {
                oTeam._id = item._id;
                oTeam.name = item.name
              }
            });
            opUsers[ij].Team = oTeam;
          }

          totalUserList = [...totalUserList, ...opUsers]

        }
        //return res.json({ hi: totalUserList })
        weekRangeArr = parentBallot.weekRange;
        let ballotStart = moment(parentBallot.ballotStartDate).format("DD-MM-YYYY");
        let ballotEnd = moment(parentBallot.ballotEndDate).format("DD-MM-YYYY");
        var applied = groupByA(parentBallot.appliedStaff, function (item) {
          return [item.userId, item.opsGroupId, item.opsTeamId, parentBallot.ballotRound];
        });

        var won = groupByA(parentBallot.wonStaff, function (item) {
          return [item.userId, item.opsGroupId, item.opsTeamId, parentBallot.ballotRound];
        });
        if (parentBallot.childBallots && parentBallot.childBallots.length > 0) {
          for (let child = 0; child <= parentBallot.childBallots.length - 1; child++) {
            const childBallot = await Ballot.findOne({
              _id: parentBallot.childBallots[child],
            });
            let childUserList = []
            if (!childBallot) {
              return res.json({
                status: false,
                message: "Coulden't find requested ballot ",
              });
            } else {
              var appliedC = groupByA(childBallot.appliedStaff, function (item) {
                return [item.userId, item.opsGroupId, item.opsTeamId, childBallot.ballotRound];
              });
              applied = applied.concat(appliedC);
              var wonC = groupByA(childBallot.wonStaff, function (item) {
                return [item.userId, item.opsGroupId, item.opsTeamId, childBallot.ballotRound];
              });
              won = won.concat(wonC)
            }
          }

          // this.sendDetailsDataExport(userList, res, maxSuccess);
        }
        const appliedData = groupBy(applied);
        const appliedKeys = Object.keys(appliedData);
        const appliedKeysTemp = Object.keys(appliedData);
        //return res.json({ appliedKeysTemp, appliedData })
        const wonData = groupBy(won);
        const wonKeys = Object.keys(wonData);
        console.log('wonKeys', wonKeys)
        const finalData = {};
        if (wonKeys && wonKeys.length > 0) {
          for (let i = 0; i < wonKeys.length; i++) {
            const uId = wonKeys[i];
            if (appliedData[uId]) {
              console.log('uid', uId)
              var index = appliedKeysTemp.indexOf(uId);
              if (index !== -1) {
                appliedKeysTemp.splice(index, 1);
              }
              finalData[uId] = {};
              for (let j = 0; j < appliedData[uId].length; j++) {
                if (j == 0) {
                  finalData[uId] = appliedData[uId][j]
                } else {
                  finalData[uId].data = finalData[uId].data.concat(appliedData[uId][j].data);
                }
              }

              for (let j = 0; j < wonData[uId].length; j++) {
                if (j == 0) {
                  finalData[uId].wonData = wonData[uId][j].data;
                } else {
                  finalData[uId].wonData = finalData[uId].wonData.concat(wonData[uId][j].data);
                }
              }
              //appliedData[uId].wonData = wonData[uId].data;
            } else {
              finalData[uId] = {};
              finalData[uId].data = [];
              for (let j = 0; j < wonData[uId].length; j++) {
                if (j == 0) {
                  finalData[uId].wonData = wonData[uId][j].data;
                } else {
                  finalData[uId].wonData = finalData[uId].wonData.concat(wonData[uId][j].data);
                }
              }
            }
          }
        } else {
          for (let i = 0; i < appliedKeys.length; i++) {
            const uId = appliedKeys[i];
            if (appliedData[uId]) {
              console.log('uid', uId)
              var index = appliedKeysTemp.indexOf(uId);
              if (index !== -1) {
                appliedKeysTemp.splice(index, 1);
              }
              finalData[uId] = {};
              for (let j = 0; j < appliedData[uId].length; j++) {
                if (j == 0) {
                  finalData[uId] = appliedData[uId][j]
                } else {
                  finalData[uId].data = finalData[uId].data.concat(appliedData[uId][j].data);
                }
              }
            }
          }
        }

        console.log('appliedKeysTempappliedKeysTemp', appliedKeysTemp)
        if (appliedKeysTemp.length > 0) {
          for (let i = 0; i < appliedKeysTemp.length; i++) {
            const uId = appliedKeysTemp[i];
            if (appliedData[uId]) {
//              var index = appliedKeysTemp.indexOf(uId);
//              if (index !== -1) {
//                appliedKeysTemp.splice(index, 1);
//              }
              finalData[uId] = {};
              for (let j = 0; j < appliedData[uId].length; j++) {
                if (j == 0) {
                  finalData[uId] = appliedData[uId][j]
                } else {
                  finalData[uId].data = finalData[uId].data.concat(appliedData[uId][j].data);
                }
              }
            }
          }
        }
        //const appliedKeysTemp = Object.keys(appliedData);
        let maxWin = 0;
        let maxApplied = 0;
        // return res.json({ totalUserList })
        for (let uIndex = 0; uIndex < totalUserList.length; uIndex++) {
          const currentOpsUser = totalUserList[uIndex];
          if (finalData[currentOpsUser._id]) {
            finalData[currentOpsUser._id].user = {
              _id: currentOpsUser._id,
              parentBussinessUnitId: currentOpsUser.parentBussinessUnitId,
              staffId: currentOpsUser.staffId,
              name: currentOpsUser.name

            };
            finalData[currentOpsUser._id].Ops = currentOpsUser.Ops;
            finalData[currentOpsUser._id].Team = currentOpsUser.Team;

          } else {
            finalData[currentOpsUser._id] = {}
            finalData[currentOpsUser._id].user = {
              _id: currentOpsUser._id,
              parentBussinessUnitId: currentOpsUser.parentBussinessUnitId,
              staffId: currentOpsUser.staffId,
              name: currentOpsUser.name

            };
            finalData[currentOpsUser._id].Ops = currentOpsUser.Ops;
            finalData[currentOpsUser._id].Team = currentOpsUser.Team;
            finalData[currentOpsUser._id].data = [];
            finalData[currentOpsUser._id].wonData = [];
          }
        }
        for (var key in finalData) {
          let user = {};
          // user.user = await User.findOne({ _id: key }, { _id: 1, name: 1, staffId: 1, parentBussinessUnitId: 1 }).populate([
          //   {
          //     path: "parentBussinessUnitId",
          //     select: "name status",
          //     match: {
          //       status: 1,
          //     },
          //     populate: {
          //       path: "sectionId",
          //       select: "name status",
          //       match: {
          //         status: 1,
          //       },
          //       populate: {
          //         path: "departmentId",
          //         select: "name status",
          //         match: {
          //           status: 1,
          //         },
          //         populate: {
          //           path: "companyId",
          //           select: "name status",
          //           match: {
          //             status: 1,
          //           },
          //         },
          //       },
          //     },
          //   },
          // ]);
          // user.Ops = await OpsGroup.findOne({ _id: finalData[key].opsId }, { _id: 1, opsGroupName: 1 });
          // if (finalData[key].teamId === "null" || finalData[key].teamId === null || finalData[key].teamId === undefined) {
          //   user.Team = {};
          //   user.Team.name = " ";
          // } else {
          //   console.log("in team check if");
          //   user.Team = await OpsTeam.findOne({ _id: finalData[key].teamId }, { _id: 1, name: 1 });
          //   user.teamId = finalData[key].teamId;
          // }
          // user.userId = key;
          // user.opsId = finalData[key].opsId;
          //user.teamId = key.teamId;
          user.appliedData = finalData[key].data;
          user.Ops = finalData[key].Ops;
          user.Team = finalData[key].Team;
          user.user = finalData[key].user;
          if (maxApplied < user.appliedData.length) {
            maxApplied = user.appliedData.length;
          }
          user.wonData = finalData[key].wonData;
          if (user.wonData && maxWin < user.wonData.length) {
            maxWin = user.wonData.length;
          }
          user.ballotPeriod = ballotStart + " to " + ballotEnd;
          userList.push(user);
        }

        const dataObj = await this.getStaffLeave(userList, req.user.companyId);
        userList = dataObj.userList;
        const leaveTypeArr = dataObj.leaveTypeArrFinal;
        // return res.json({ userList })
        this.sendDetailsDataExport(userList, res, maxWin, maxApplied, parentBallot.weekRange, leaveTypeArr);


        function groupByA(array, f) {
          var groups = {};
          array.forEach(function (o) {
            var group = JSON.stringify(f(o));

            groups[group] = groups[group] || [];
            //o.ballotRound = array[0][3]
            groups[group].push(o);
          });
          //console.log('group', groups)
          return Object.keys(groups).map(function (group) {
            var array = JSON.parse("[" + group + "]");
            groups[group] = JSON.parse(JSON.stringify(groups[group]))
            groups[group].forEach((ite, ind) => {
              // console.log('ittt', ite)
              groups[group][ind].ballotRound = array[0][3] + 1;
            });
            return {
              userId: array[0][0],
              opsId: array[0][1],
              teamId: array[0][2],
              ballotRound: array[0][3] + 1,
              data: groups[group],
            };
          });
        }
        function groupBy(data) {
          const grouped = _.mapValues(_.groupBy(data, 'userId'),
            fileList => fileList.map(file => _.omit(file, 'userId')));
          return grouped;
        }
      }
    } catch (e) {
      console.log('ée', e)
      return res.status(500).json({
        success: false,
        data: e,
        message: "Something went wrong",
      });
    }
  }
  async getStaffLeave(userList, companyId) {
    const annualLeave = await leaveType.findOne({
      name: "Annual Leave",
      isActive: true,
      companyId
    });
    if (!annualLeave) {
      return { userList, leaveTypeArrFinal: [] };
    }

    const annualLeaveId = annualLeave._id;
    console.log('hehehe', annualLeaveId)
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const prevYear = currentYear - 1;
    const yearArr = [prevYear, currentYear, nextYear];
    let leaveTypeArr = [];
    for (let i = 0; i < userList.length; i++) {
      const user = userList[i].user;
      if (user && user._id) {
        const staffLeaveData = await staffLeave.findOne({ userId: user._id, isActive: true }).populate([{
          path: "leaveDetails.leaveTypeId",
          select: "name"
        }]).sort({ "leaveDetails.leaveTypeId.name": 1, "leaveDetails.year": 1 });
        // userList[i].leaveTypeData = staffLeaveData;
        if (staffLeaveData) {
          for (let j = 0; j < staffLeaveData.leaveDetails.length; j++) {
            const leaveDetails = staffLeaveData.leaveDetails[j];
            //console.log('I am', leaveDetails.leaveTypeId)
            if (annualLeaveId.toString() == leaveDetails.leaveTypeId._id.toString()) {
              console.log('hehe')
              const leaveName = leaveDetails.leaveTypeId.name;
              const year = leaveDetails.year;
              const planQuota = leaveDetails.planQuota;
              const quota = leaveDetails.quota;
              if (yearArr.includes(year)) {
                if (!leaveTypeArr.includes(leaveName)) {
                  leaveTypeArr.push(leaveName);
                }
                // userList[i][`${leaveName} Plan Quota(${year})`] = quota;
                userList[i][`${leaveName} Plan Quota(${year})`] = leaveDetails.total;
                userList[i][`${leaveName} Plan Quota Balance(${year})`] = planQuota;
              }
            }
          }
        }
      }
    }
    const leaveTypeArrFinal = [];
    for (let ik = 0; ik < leaveTypeArr.length; ik++) {
      const name = leaveTypeArr[ik];
      for (let y = 0; y < yearArr.length; y++) {
        leaveTypeArrFinal.push(`${name} Plan Quota(${yearArr[y]})`);
        leaveTypeArrFinal.push(`${name} Plan Quota Balance(${yearArr[y]})`);
      }
    }
    return { userList, leaveTypeArrFinal };
  }
  async sendDetailsDataExport(results, res, maxSuccess, maxApplied, week, leaveTypeArr) {
    // return res.json({ results })
    const csvData = [];
    let keys = ["Staff Name", "StaffId", "Business Unit Name", "Ops Group", "Ops Team", "Ballot Period", "Total Applied Slot"];
    for (let iii = 1; iii <= maxApplied; iii++) {
      keys.push("Applied Dates " + iii);
    }
    keys.push("Successfull Ballots");
    for (let iii = 1; iii <= maxSuccess; iii++) {
      keys.push("Leave Dates " + iii);
    }
    keys = keys.concat(leaveTypeArr)
    console.log('keys', keys)
    for (let ji = 0; ji < results.length; ji++) {
      const item = results[ji];
      if (item.user) {
        let appliedRound = [];
        let appliedDate = [];
        const obj = {};
        obj["Staff Name"] = item.user.name;
        obj["StaffId"] = item.user.staffId;
        obj["Business Unit Name"] =
          "" +
          item.user.parentBussinessUnitId.sectionId.departmentId.companyId.name +
          "->" +
          item.user.parentBussinessUnitId.sectionId.departmentId.name +
          "->" +
          item.user.parentBussinessUnitId.sectionId.name +
          "->" +
          item.user.parentBussinessUnitId.name;
        obj["Ops Group"] = item.Ops.opsGroupName;
        obj["Ops Team"] = item.Team.name;
        obj["Ballot Period"] = item.ballotPeriod;
        console.log('item.appliedData', item.appliedData, maxApplied)
        for (let k = 1; k <= maxApplied; k++) {
          if (item.appliedData.length >= k) {
            const aa = item.appliedData[k - 1];
            //console.log('aa', aa)
            const sNo = aa.weekNo + 1;
            obj["Applied Dates " + k] = '(slot' + sNo + ') ' + moment(new Date(week[aa.weekNo].start)).format('DD-MM-YYYY') + ' - ' + moment(new Date(week[aa.weekNo].end)).format('DD-MM-YYYY');
            console.log('aa.ballotRound', aa.ballotRound)
            const round = parseInt(aa.ballotRound) - 1;
            let prev = appliedRound[round];
            if (prev) {
              prev++;
            } else {
              prev = 1;
            }
            console.log('appliedRound', round, prev)
            appliedRound[round] = prev;
          } else {
            obj["Applied Dates " + k] = '-'
          }
        }
        let appliedRoundStr = '';
        for (let ap = 1; ap <= appliedRound.length; ap++) {
          if (appliedRound[ap - 1]) {
            appliedRoundStr = appliedRoundStr + '' + appliedRound[ap - 1] + ' R(' + ap + ')  ';
          }
        }
        obj['Total Applied Slot'] = appliedRoundStr;
        obj['Successfull Ballots'] = item.wonData ? item.wonData.length : 0;
        //console.log('item.wonData.length', item.wonData.length)
        for (let k = 1; k <= maxSuccess; k++) {
          if (item.wonData && item.wonData.length >= k) {
            const aa = item.wonData[k - 1];
            //console.log('kk', k)
            obj["Leave Dates " + k] = '' + moment(new Date(week[aa.weekNo].start)).format('DD-MM-YYYY') + ' - ' + moment(new Date(week[aa.weekNo].end)).format('DD-MM-YYYY') + ' R(' + aa.ballotRound + ')';
            //console.log('hh')
          } else {
            obj["Leave Dates " + k] = '-'
          }
        }
        for (let m = 0; m < leaveTypeArr.length; m++) {
          const nn = leaveTypeArr[m];
          if (item[nn] || item[nn] == 0) {
            obj[nn] = item[nn];
          } else {
            obj[nn] = "-"
          }
        }
        csvData.push(obj);
      }
    }
    // return res.json({ csvData })
    json2csv({ data: csvData, fields: keys }, function (err, csv) {
      if (err) console.log(err);

      res.setHeader("Content-disposition", "attachment; filename=testing.csv");
      res.set("Content-Type", "application/csv");
      res.status(200).json({ csv, noData: true });
    });
  }

  async saveBallotAsDraft(req, res) {
    try {
      // check required filed
      console.log("REQ OBJ : ", req.body);
      req.body.createdBy = req.user._id;
      req.body.companyId = req.user.companyId;
      const data = req.body;
      if (data.applicationOpenDateTime) {
        data.applicationOpenDateTime = moment(data.applicationOpenDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.applicationCloseDateTime) {
        data.applicationCloseDateTime = moment(data.applicationCloseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.ballotStartDate) {
        data.ballotStartDate = moment(data.ballotStartDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.ballotEndDate) {
        data.ballotEndDate = moment(data.ballotEndDate, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }
      if (data.resultRelease && data.resultRelease == "1") {
        data.resultReleaseDateTime = moment(data.resultReleaseDateTime, "MM-DD-YYYY HH:mm:ss Z").utc().format();
      }

      new Ballot(data)
        .save()
        .then((ressss) => {
          let message = "Ballot successfully created";
          if (data.isDraft) {
            message = "Ballot saved as a draft";
          } else {
            this.ballotEvent(ressss, 'createBallot', false)
            //console.log('ressasss', ressss);
            // notification for publish ballot
            // this.sendNotification(ressss)
          }

          if (data.parentBallot) {
            console.log("Parent Ballot is:", data.parentBallot);
            this.checkIfHasParentAndUpdate(req.body.parentBallot, ressss._id);
          }
          return res.json({ status: true, message });
        })
        .catch((err) => {
          console.log("aaaa", err);
        });
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }

  async getBallotDataToAutoAssing(req, res) {
    try {
      let id = req.params.id;
      const ballot = await Ballot.findOne({ _id: id });
      //console.log("BALLOT: ",ballot);
      // let totalQuota=0;
      let slotdata = [];
      let totalTeamUnassign = 0;
      // let leaveFormat = 5;
      // if (ballot.leaveConfiguration === 2) {
      //     leaveFormat = 6;
      // } else if (ballot.leaveConfiguration === 3) {
      //     leaveFormat = 7;
      // }
      if (!ballot) {
        return res.json({
          status: false,
          message: "Couldn't find requested ballot. ",
          e,
        });
      } else {
        if (ballot.userFrom === 2) {
          //for BU do it later
        } else {
          let leaveFormat = 5;
          var startYear = new Date(ballot.ballotStartDate).getFullYear()
          if (ballot.leaveConfiguration === 2) {
            leaveFormat = 6;
          } else if (ballot.leaveConfiguration === 3) {
            leaveFormat = 7;
          }
          if (ballot.leaveType == 2) {
            leaveFormat = 1;
          }

          //console.log("@ else me once");
          let newballot = JSON.stringify(ballot);
          newballot = JSON.parse(newballot);
          //console.log("@ else me");
          let slots = ballot.slotCreation;

          for (let i = 0; i <= slots.length - 1; i++) {
            let totalQuota = 0;
            let opsGrpid = slots[i].opsGroup.opsId;

            slots[i].totalBallotBalance = 0;

            slots[i].opsGroup.unassignBalanace = 0;
            slots[i].opsGroup.BallotBalance = 0;
            let opsQuota = 0;
            let teamQuota = 0;
            const opsGroupUser = await OpsGroup.findOne({ _id: slots[i].opsGroup.opsId }, { userId: 1, _id: 0 }).lean();
            // const leaveBallanceData = await StaffSapData.find({ staff_Id: { $in: opsGroupUser.userId } }, { ballotLeaveBalanced: 1, _id: 0 }).lean();
            const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsGroupUser.userId, req.user.companyId, startYear);
            let opsUnassign = 0;
            leaveBallanceData.staffArr.forEach((item) => {
              //  console.log("inin");
              opsUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
            });
            slots[i].opsGroup.unassignBalanace = opsUnassign;
            for (let j = 0; j <= slots[i].arr.length - 1; j++) {
              let hasTeam = false;
              // console.log("@inner loop me",slots[i].opsGroup);
              // let opsQuota=0;
              // let teamQuota=0;
              let currentweek = j + "A";

              var found = ballot.wonStaff.filter(function (element) {
                return element.opsGroupId.toString() === opsGrpid.toString() && element.weekNo === j;
              });

              slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;
              opsQuota = slots[i].weekRangeSlot[currentweek].value;
              // slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + slots[i].weekRangeSlot[currentweek].value;
              let currentOpsSlotValueIs = slots[i].weekRangeSlot[currentweek].value;

              // slots[i].opsGroup.ratioForBalnceQuota = slots[i].opsGroup.unassignBalanace/slots[i].opsGroup.BallotBalance;
              //Ops Team is there
              let slotValueOfTeams = 0;

              if (slots[i].opsTeam.length > 0) {
                hasTeam = true;
                for (let d = 0; d <= slots[i].opsTeam.length - 1; d++) {
                  slots[i].opsTeam[d].unassignBalanace = 0;
                  let currentweek = 'OG' + j + 'OT' + d.toString();

                  var found = ballot.wonStaff.filter(function (element) {
                    if (element.opsTeamId) {
                      return element.opsTeamId.toString() === slots[i].opsTeam[d]._id.toString() && element.weekNo === j;
                    } else {
                      return element.opsGroupId === opsGrpid && !element.opsTeamId && element.weekNo === j;
                    }
                  });

                  slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;

                  slotValueOfTeams = slotValueOfTeams + slots[i].weekRangeSlot[currentweek].value;

                  teamQuota = teamQuota + slots[i].weekRangeSlot[currentweek].value;
                  if (slots[i].opsTeam[d].BallotBalance) {
                    slots[i].opsTeam[d].BallotBalance = slots[i].opsTeam[d].BallotBalance + slots[i].weekRangeSlot[currentweek].value;
                  } else {
                    slots[i].opsTeam[d].BallotBalance = 0;
                    slots[i].opsTeam[d].BallotBalance = slots[i].opsTeam[d].BallotBalance + slots[i].weekRangeSlot[currentweek].value;
                  }

                  //to find Unassigned per team

                  const opsTeamUser = await OpsTeam.findOne({ _id: slots[i].opsTeam[d]._id }, { userId: 1, _id: 0 }).lean();
                  //const leaveBallanceData = await StaffSapData.find({ staff_Id: { $in: opsTeamUser.userId } }, { ballotLeaveBalanced: 1, _id: 0 }).lean();
                  const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear);
                  let teamUnassign = 0;
                  leaveBallanceData.staffArr.forEach((item) => {
                    teamUnassign += Math.floor(item.leaveTypeData.ballotLeaveBalanced / leaveFormat);
                  });

                  slots[i].opsTeam[d].unassignBalanace = teamUnassign;
                  slots[i].opsTeam[d].ratioForBalnceQuota = RATIO
                  //slots[i].opsTeam[d].unassignBalanace / slots[i].opsTeam[d].BallotBalance;
                }
              }
              if (hasTeam) {
                //if has team is true.
                if (slotValueOfTeams > currentOpsSlotValueIs) {
                  slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + currentOpsSlotValueIs;
                } else {
                  slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + slotValueOfTeams;
                }
              } else {
                //if hasteam is false i.e only opsgroup is there.
                slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + currentOpsSlotValueIs;
              }

              slots[i].opsGroup.ratioForBalnceQuota = RATIO
              //slots[i].opsGroup.unassignBalanace / slots[i].opsGroup.BallotBalance;

              if (opsQuota > teamQuota) {
                //   console.log("Hi the total Quota is: ", teamQuota);
                totalQuota = totalQuota + teamQuota;
              } else {
                totalQuota = totalQuota + opsQuota;
              }
              if (teamQuota === 0) {
                totalQuota = totalQuota + opsQuota;
              }
              slots[i].totalBallotBalance = totalQuota;
            }
          }

          for (let i = 0; i <= slots.length - 1; i++) {
            //  console.log("After above for are done",slots[i]);
            slots[i].totalUnassignedIs = 0;

            let opsRatio = slots[i].opsGroup.ratioForBalnceQuota;
            let totalinAssign = 0;
            if (slots[i].opsTeam.length > 0) {
              for (let t = 0; t <= slots[i].opsTeam.length - 1; t++) {
                totalinAssign = totalinAssign + slots[i].opsTeam[t].unassignBalanace;
              }
              if (totalinAssign > slots[i].opsGroup.unassignBalanace) {
                slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + slots[i].opsGroup.unassignBalanace;
              } else {
                slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + totalinAssign;
              }
            } else {
              slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + slots[i].opsGroup.unassignBalanace;
            }

            for (let j = 0; j <= slots[i].arr.length - 1; j++) {
              let currentweek = j + "A";

              slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;

              slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = slots[i].weekRangeSlot[currentweek].value * opsRatio;
              if (slots[i].opsTeam.length > 0) {
                for (let d = 0; d <= slots[i].opsTeam.length - 1; d++) {
                  let teamRatio = slots[i].opsTeam[d].ratioForBalnceQuota;
                  let currentweek = 'OG' + j + 'OT' + d.toString();
                  slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;
                  slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = slots[i].weekRangeSlot[currentweek].value * teamRatio;
                }
              }
            }
          }
          // console.log("sending date here");
          let data = { slot: slots };
          return res.status(201).json({ status: true, data: data, message: "Received data." });
        }
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }
  async checkIsAnnualLeaveArr(userId, companyId, year = new Date().getFullYear(), isFixedBallotingLeaveType = false, leaveTypeId = null) {
    let annualLeave;
    if (isFixedBallotingLeaveType) {
      annualLeave = await leaveType.findOne({ _id: leaveTypeId, isActive: true, companyId });
    } else {
      annualLeave = await leaveType.findOne({ name: "Annual Leave", isActive: true, companyId });
    }

    console.log("annualLeaveannualLeaveannualLeave", annualLeave)

    if (annualLeave) {
      const staffLevaeData = await staffLeave.find({
        userId: { $in: userId },
        "leaveDetails.leaveTypeId": annualLeave._id,
      });
      if (staffLevaeData) {
        console.log('staffLevaeData', year)
        const staffArr = [];
        for (let i = 0; i < staffLevaeData.length; i++) {
          const item = staffLevaeData[i];
          let leaveTypeData = item.leaveDetails.filter((leave) => {
            return leave.leaveTypeId.toString() == annualLeave._id.toString() && leave.year == year;
          });
          if (leaveTypeData && leaveTypeData.length > 0) {
            staffArr.push({
              userId: item.userId,
              leaveTypeData: leaveTypeData[0],
              leaveGroupId: item.leaveGroupId,
              businessUnitId: item.businessUnitId,
            });
          }
        }
        return { status: true, staffArr };
      }
      return { status: false };
    }
    return { status: false };
  }
  async getBallotDataToAssignByStaff(req, res) {
    // try {
    let ballotId = req.params.id;
    const ballot = await Ballot.findOne({ _id: ballotId });

    if (!ballot) {
      return res.json({
        status: false,
        message: "Couldn't find requested ballot. ",
        e,
      });
    } else {
      const startYear = new Date(ballot.ballotStartDate).getFullYear()
      let leaveFormat = 5;
      if (ballot.leaveConfiguration === 2) {
        leaveFormat = 6;
      } else if (ballot.leaveConfiguration === 3) {
        leaveFormat = 7;
      }
      if (ballot.leaveType == 2) {
        leaveFormat = 1;
      }
      console.log("IN ELSE ME: ");
      let newBallot = JSON.stringify(ballot);
      newBallot = JSON.parse(newBallot);

      if (ballot.userFrom === 2) {
        //for BU do it later
      } else {
        let slots = newBallot.slotCreation;
        let users = [];
        for (var i = 0; i <= slots.length - 1; i++) {
          console.log("inside of for: ", slots[i].opsGroup);

          slots[i].opsGroup.Users = [];
          const opsGroupUser = await OpsGroup.findOne({ _id: slots[i].opsGroup.opsId }, { userId: 1, _id: 0 }).lean();
          const leaveBallanceOpsData = await this.checkIsAnnualLeaveArr(opsGroupUser.userId, req.user.companyId, startYear);
          if (slots[i].opsTeam.length > 0) {
            for (let j = 0; j <= slots[i].opsTeam.length - 1; j++) {
              slots[i].opsTeam[j].Users = [];
              const opsTeamUser = await OpsTeam.findOne({ _id: slots[i].opsTeam[j]._id }, { userId: 1, _id: 0 }).lean();

              let leaveBallanceData;
              if (ballot !== null && ballot.fixedBallotingLeaveType) {
                leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, true, ballot.leaveTypeId);
              } else {
                leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear, false);
              }
              // const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, req.user.companyId, startYear);

              leaveBallanceData.staffArr.forEach((item) => {
                let user = {
                  opsG: slots[i].opsGroup.opsId,
                  opsT: slots[i].opsTeam[j]._id,
                  teamIndex: j,
                  userId: item.userId,
                  leaveTypeId: item.leaveTypeData.leaveTypeId,
                  leaveGroupId: item.leaveGroupId,
                  ballotLeaveBalance: parseInt(item.leaveTypeData.planQuota / leaveFormat),
                };
                users.push(user);
              });
            }
          } else {
            console.log("-----------------inside else")
            leaveBallanceOpsData.staffArr.forEach((item) => {
              console.log("ininelse");
              let user = {
                opsG: slots[i].opsGroup.opsId,
                opsT: null,
                userId: item.userId,

                leaveTypeId: item.leaveTypeData.leaveTypeId,
                leaveGroupId: item.leaveGroupId,
                ballotLeaveBalance: parseInt(item.leaveTypeData.planQuota / leaveFormat),
              };
              users.push(user);
            });
          }
        }
        if (users.length > 0) {
          for (let u = 0; u <= users.length - 1; u++) {
            const username = await User.findOne({ _id: users[u].userId }, { _id: 0, name: 1, staffId: 1, parentBussinessUnitId: 1 });

            users[u].name = username.name;
            users[u].staffId = username.staffId;
            users[u].parentBu = username.parentBussinessUnitId;
          }
          return res.json({
            status: true,
            data: users,
            message: "Successfully received data.",
          });
        } else {
          //send users as it is
          return res.json({
            status: true,
            data: users,
            message: "Successfully received data.",
          });
        }
        //this.checkforUserResrictions(users,newBallot,res);
      }
    }
    // } catch (e) {
    //   return res.json({ status: false, message: "Something went wrong1", e });
    // }
  }

  async checkforUserResrictions(users, newBallot, res) {
    try {
      if (users.length > 0) {
        for (let u = 0; u <= users.length - 1; u++) {
          users[u].wonWeeks = [];
          let deepClone = JSON.parse(JSON.stringify(users[u].weekRange));
          const username = await User.findOne({ _id: users[u].userId }, { _id: 0, name: 1, staffId: 1, parentBussinessUnitId: 1 });

          users[u].name = username.name;
          users[u].staffId = username.staffId;
          users[u].parentBu = username.parentBussinessUnitId;
          if (users[u].opsT === null) {
            console.log("In if");
            let filteredData = newBallot.wonStaff.filter(
              (userWon) => userWon.userId.toString() === users[u].userId.toString() && userWon.opsGroupId.toString() === users[u].opsG.toString()
            );
            for (let f = 0; f <= filteredData.length - 1; f++) {
              console.log("in filter for loop");
              const weekIs = filteredData[f].weekNo;
              let opsWeekIs = weekIs + "A";
              console.log("opsWeekIs: ", opsWeekIs);
              deepClone[opsWeekIs].isRestrict = true;
              deepClone[opsWeekIs].isWon = true;

              //check for consecutive and restrict
              if (newBallot.maxConsecutiveBallot !== null && newBallot.maxConsecutiveBallot > 0) {
                let nextInd = weekIs + newBallot.maxConsecutiveBallot;
                if (weekIs < newBallot.maxConsecutiveBallot) {
                  let prevInd = weekIs - newBallot.maxConsecutiveBallot;
                  if (deepClone[prevInd + "A"]) {
                    deepClone[prevInd + "A"].isRestrict = true;
                  }
                }
                if (deepClone[nextInd + "A"]) {
                  deepClone[nextInd + "A"].isRestrict = true;
                }
              }
            }
          } else {
            console.log("In else", users[u].userId);
            let filteredData = newBallot.wonStaff.filter(
              (userWon) =>
                userWon.userId.toString() === users[u].userId.toString() &&
                userWon.opsGroupId.toString() === users[u].opsG.toString() &&
                userWon.opsTeamId.toString() === users[u].opsT.toString()
            );
            for (let f = 0; f <= filteredData.length - 1; f++) {
              console.log("in filter for loop");
              const weekIs = filteredData[f].weekNo;
              let opsWeekIs = weekIs + "A";
              console.log("opsWeekIs: ", opsWeekIs);
              deepClone[opsWeekIs].isRestrict = true;
              deepClone[opsWeekIs].isWon = true;
              let teamWeekIs = "" + weekIs + users[u].teamIndex;
              console.log("teamweek: ", teamWeekIs);
              deepClone[teamWeekIs].isRestrict = true;
              deepClone[teamWeekIs].isWon = true;

              //check for consecutive and restrict

              if (newBallot.maxConsecutiveBallot !== null && newBallot.maxConsecutiveBallot > 0) {
                let nextInd = weekIs + newBallot.maxConsecutiveBallot;
                if (!(weekIs < newBallot.maxConsecutiveBallot)) {
                  let prevInd = weekIs - newBallot.maxConsecutiveBallot;
                  if (deepClone[prevInd + "A"]) {
                    deepClone[prevInd + "A"].isRestrict = true;
                    deepClone["" + prevInd + users[u].teamIndex].isRestrict = true;
                  }
                }

                if (deepClone[nextInd + "A"]) {
                  deepClone[nextInd + "A"].isRestrict = true;
                  deepClone["" + nextInd + users[u].teamIndex].isRestrict = true;
                }
              }
            }
          }
          delete users[u].weekRange;
          users[u].deepClone = deepClone;

          if (newBallot.isRestrict) {
            const staffRestriction = [];
            newBallot.staffRestriction.forEach((item) => {
              let isPresent = false;
              let staffRestrictionObj = {};
              isPresent = item.userList.some((user) => {
                ////console.logs('user',user)
                if (user.id.toString() === users[u].userId.toString()) {
                  staffRestrictionObj = {
                    slot: item.slot,
                    startDate: item.startDate,
                    endDate: new Date(new Date(item.endDate).setDate(new Date(item.endDate).getDate() + 6)),
                  };
                  return true;
                }
              });
              if (isPresent) {
                const slot = this.getWeekIndex(item.startDate, newBallot.weekRange, "start", newBallot.leaveType);
                staffRestrictionObj.slotNo = slot;
                staffRestriction.push(staffRestrictionObj);
              }
            });
            console.log("isRestrict : ", staffRestriction);
            if (staffRestriction.length > 0) {
              for (let r = 0; r <= staffRestriction.length - 1; r++) {
                if (users[u].opsT === null) {
                  const weekIs = staffRestriction[r].slotNo;
                  let opsWeekIs = weekIs + "A";
                  console.log("opsWeekIs: ", opsWeekIs);
                  deepClone[opsWeekIs].isRestrict = true;
                  deepClone[opsWeekIs].isStaffRestricted = true;
                } else {
                  const weekIs = staffRestriction[r].slotNo;
                  let opsWeekIs = weekIs + "A";
                  deepClone[opsWeekIs].isRestrict = true;
                  deepClone[opsWeekIs].isStaffRestricted = true;
                  let teamWeekIs = "" + weekIs + users[u].teamIndex;
                  deepClone[teamWeekIs].isRestrict = true;
                  deepClone[teamWeekIs].isStaffRestricted = true;
                }
              }
            }

            const segmentRestriction = [];

            newBallot.maxSegment.forEach((item, index) => {
              let startSlot = this.getWeekIndex(item.startDate, newBallot.weekRange, "start", newBallot.leaveType);
              //console.logs('item.endDate', item.endDate);
              let endSlot = this.getWeekIndex(item.endDate, newBallot.weekRange, "end", newBallot.leaveType);
              let slotRange = [];
              for (let i = startSlot; i <= endSlot; i++) {
                slotRange.push(i);
              }
              let segmentRestrictionObj = {
                startSlot,
                endSlot,
                slotRange,
                maxBallot: item.maxBallot,
              };
              segmentRestriction.push(segmentRestrictionObj);
            });

            console.log("here after segment restrictions: ", segmentRestriction);
            if (segmentRestriction.length > 0) {
              for (let sg = 0; sg <= segmentRestriction.length - 1; sg++) {
                let wonFilterd = newBallot.wonStaff.filter(
                  (winers) => segmentRestriction[sg].slotRange.includes(winers.weekNo) && winers.userId.toString() === users[u].userId.toString()
                );
                console.log("CHECK OF USER IDS ", users[u].userId, "with: ", segmentRestriction[sg].maxBallot, "and: won", wonFilterd.length);
                if (segmentRestriction[sg].maxBallot === wonFilterd.length) {
                  console.log("IN IF OF SEGMENT MATCH: ", users[u].userId, "for ballot:");
                  for (let slot = 0; slot <= segmentRestriction[sg].slotRange.length - 1; slot++) {
                    let indexAtSegment = segmentRestriction[sg].slotRange[slot];
                    //  users[u].deepClone[indexAtSegment+'A'].isRestrict =true;
                    if (users[u].opsT === null) {
                      users[u].deepClone[indexAtSegment + "A"].isRestrict = true;
                    } else {
                      users[u].deepClone[indexAtSegment + "A"].isRestrict = true;
                      users[u].deepClone["" + indexAtSegment + users[u].teamIndex].isRestrict = true;
                    }
                  }
                } else {
                  if (!wonFilterd.length > 0) {
                    var show = segmentRestriction[sg].slotRange[Math.floor(Math.random() * segmentRestriction[sg].slotRange.length)];
                    users[u].deepClone[show + "A"].isRestrict = true;
                    if (users[u].opsT !== null) {
                      users[u].deepClone["" + show + users[u].teamIndex].isRestrict = true;
                    }
                  }
                  for (let slot = 0; slot <= segmentRestriction[sg].slotRange.length - 1; slot++) {
                    const weekNo = segmentRestriction[sg].slotRange[slot] + "A";

                    console.log("in segment R: ", weekNo);
                    if (users[u].deepClone[weekNo].isRestrict) {
                      //its consicative so here again check for consecutive
                      if (newBallot.maxConsecutiveBallot !== null && newBallot.maxConsecutiveBallot > 0) {
                        let nextInd = segmentRestriction[sg].slotRange[slot] + newBallot.maxConsecutiveBallot;
                        if (segmentRestriction[sg].slotRange[slot] < newBallot.maxConsecutiveBallot) {
                          let prevInd = segmentRestriction[sg].slotRange[slot] - newBallot.maxConsecutiveBallot;

                          users[u].deepClone[prevInd + "A"].isRestrict = true;
                        }
                        if (users[u].deepClone[nextInd + "A"]) {
                          users[u].deepClone[nextInd + "A"].isRestrict = true;
                        }
                      }
                    } else {
                      console.log("its not restriced.");
                    }

                    if (users[u].opsT !== null) {
                      const weekNo = "" + segmentRestriction[sg].slotRange[slot] + users[u].teamIndex;

                      if (users[u].deepClone[weekNo].isRestrict) {
                        //its consicative so here again check for consecutive
                        if (newBallot.maxConsecutiveBallot !== null && newBallot.maxConsecutiveBallot > 0) {
                          let nextInd = segmentRestriction[sg].slotRange[slot] + newBallot.maxConsecutiveBallot;
                          if (segmentRestriction[sg].slotRange[slot] < newBallot.maxConsecutiveBallot) {
                            let prevInd = segmentRestriction[sg].slotRange[slot] - newBallot.maxConsecutiveBallot;

                            users[u].deepClone["" + prevInd + users[u].teamIndex].isRestrict = true;
                          }
                          if (users[u].deepClone["" + nextInd + users[u].teamIndex]) {
                            users[u].deepClone["" + nextInd + users[u].teamIndex].isRestrict = true;
                          }
                        }
                      } else {
                        console.log("Team - its not restriced.");
                      }
                    }
                  }
                }
              }
            }
          }

          //finally the only maxConsecutive ballots to check
          if (newBallot.maxConsecutiveBallot !== null && newBallot.maxConsecutiveBallot > 0) {
            console.log("here at newballot check ia ma");
            let check = checkForIsRestrict(users[u].deepClone);
            console.log("CHeck is: ", check);
            if (check === true) {
              console.log("CHeck is: inside true one ");
              for (let ar = 0; ar <= users[u].arr.length - 1; ar++) {
                //for ops group here
                console.log(ar);
                let nextOfar = ar + newBallot.maxConsecutiveBallot;
                console.log(users[u].deepClone[ar + "A"]);

                //writting random no logic here..
                const ballarr = [ar, nextOfar];
                var show = ballarr[Math.floor(Math.random() * ballarr.length)];
                // console.log("SHOW IS: between ",ar ,"and",nextOfar,"=>",show);

                if (users[u].deepClone[ar + "A"].isRestrict) {
                  console.log("curent index is restricted go to next iteration.");
                } else {
                  if (users[u].deepClone[nextOfar + "A"]) {
                    if (users[u].deepClone[nextOfar + "A"].isRestrict) {
                      console.log("next on resticted so chill");
                    } else {
                      //users[u].deepClone[nextOfar+'A'].isRestrict = true;
                      users[u].deepClone[show + "A"].isRestrict = true;
                    }
                  }
                }
                //For ops teams
                if (users[u].opsT !== null) {
                  if (users[u].deepClone["" + ar + users[u].teamIndex].isRestrict) {
                    console.log("curent index is restricted go to next iteration.");
                  } else {
                    if (users[u].deepClone[nextOfar + "A"]) {
                      if (users[u].deepClone["" + nextOfar + users[u].teamIndex].isRestrict) {
                        console.log("next on resticted so chill");
                      } else {
                        //users[u].deepClone[''+nextOfar+users[u].teamIndex].isRestrict = true;
                        users[u].deepClone["" + show + users[u].teamIndex].isRestrict = true;
                      }
                    }
                  }
                }
              }
            } else {
              console.log("In return check else");
              for (let ar = 0; ar <= users[u].arr.length - 1; ar++) {
                //for ops group here
                let nextOfar = ar + newBallot.maxConsecutiveBallot;
                //writting random no logic here..
                const ballarr = [ar, nextOfar];
                var show = ballarr[Math.floor(Math.random() * ballarr.length)];
                // console.log("SHOW IS: between ",ar ,"and",nextOfar,"=>",show);

                if (users[u].deepClone[ar + "A"].isRestrict) {
                  console.log("curent index is restricted go to next iteration.");
                } else {
                  if (users[u].deepClone[nextOfar + "A"]) {
                    if (users[u].deepClone[nextOfar + "A"].isRestrict) {
                      console.log("next on resticted so chill");
                    } else {
                      //users[u].deepClone[nextOfar+'A'].isRestrict = true;
                      users[u].deepClone[show + "A"].isRestrict = true;
                    }
                  }
                }

                //For ops teams
                if (users[u].opsT !== null) {
                  if (users[u].deepClone["" + ar + users[u].teamIndex].isRestrict) {
                    console.log("curent index is restricted go to next iteration.");
                  } else {
                    if (users[u].deepClone[nextOfar + "A"]) {
                      if (users[u].deepClone["" + nextOfar + users[u].teamIndex].isRestrict) {
                        console.log("next on resticted so chill");
                      } else {
                        //  users[u].deepClone[''+nextOfar+users[u].teamIndex].isRestrict = true;
                        users[u].deepClone["" + show + users[u].teamIndex].isRestrict = true;
                      }
                    }
                  }
                }
              }
            }
            delete users[u].arr;
          }
        }
      } else {
        //This case will never happen.In case is happens by mistake We are returning all users list without applying any Restrictions.
      }
      return res.json({
        status: true,
        data: users,
        message: "Successfully received data.",
      });
    } catch (e) {
      return res.json({
        status: false,
        data: e,
        message: "cannot receive data.",
      });
    }

    function checkForIsRestrict(clone) {
      var cc = false;
      for (let [key, value] of Object.entries(clone)) {
        console.log(key, value);

        if (value.isRestrict) {
          // return true;
          cc = true;
        } else {
          console.log("no");
        }
      }

      return cc;
    }
  }

  async getAutoAssignedUsers(req, res) {
    try {
      const ballotId = req.params.id;

      let finalWonStaff = [];
      const ballotData = await Ballot.findById({ _id: ballotId }, { _id: 0, ballotName: 1, wonStaff: 1 });
      let newBallot = JSON.stringify(ballotData);
      newBallot = JSON.parse(newBallot);
      //  const Ballot = await Ballot.findOne({_id:ballotId},{_id:0,ballotName:1,wonStaff:1});

      const result = newBallot.wonStaff.filter((staff) => staff.isAutoAssign === true);

      if (result.length > 0) {
        for (let r = 0; r <= result.length - 1; r++) {
          const user = await User.findOne({ _id: result[r].userId }, { _id: 0, name: 1, staffId: 1 });
          result[r].userData = user;
          finalWonStaff.push(result[r]);
        }
      } else {
        finalWonStaff = result;
      }
      // finalWonStaff = result;
      finalWonStaff = groupBy(finalWonStaff, "userId");

      function groupBy(xs, key) {
        return xs.reduce(function (rv, x) {
          (rv[x[key]] = rv[x[key]] || []).push(x);
          return rv;
        }, {});
      }
      return res.json({
        message: "Successfully auto assign done",
        success: true,
        finalWonStaff,
      });
    } catch (e) {
      return res.status(500).json({ status: false, message: "Something went wrong1", e });
    }
  }

  async ballotDetailsForAutoAssigned(req, res) {
    try {
      let ballotId = req.params.id;
      const parentBallot = await Ballot.findOne({ _id: ballotId });
      let userList = [];
      if (!parentBallot.isAutoAssign) {
        res.status(201).json({ status: false, message: "ballot is not yet AutoAssigned" });
      }
      var won = groupByAuto(parentBallot.wonStaff, function (item) {
        return [item.userId, item.opsGroupId, item.opsTeamId, item.isAutoAssign];
      });
      const opsGroupD = {};
      const opsTeamD = {};
      for (var wins = 0; wins <= won.length - 1; wins++) {
        console.log("WON DATA:for ", won[wins]);
        if (won[wins].isAuto) {
          let user = {};
          user.user = await User.findOne({ _id: won[wins].userId }, { _id: 1, name: 1, staffId: 1 });
          if (!opsGroupD[won[wins].opsId]) {
            user.Ops = await OpsGroup.findOne({ _id: won[wins].opsId }, { _id: 1, opsGroupName: 1 });
            opsGroupD[won[wins].opsId] = user.Ops;
          } else {
            user.Ops = opsGroupD[won[wins].opsId];
          }
          if (won[wins].teamId !== null || won[wins].teamId !== undefined) {
            if (!opsTeamD[won[wins].teamId]) {
              user.Team = await OpsTeam.findOne({ _id: won[wins].teamId }, { _id: 1, name: 1 });
              opsTeamD[won[wins].teamId] = user.Team;
            } else {
              user.Team = opsTeamD[won[wins].teamId];
            }
          } else {
            user.Team = {};
            user.Team.name = " ";
          }
          user.userId = won[wins].userId;
          user.opsId = won[wins].opsId;
          user.teamId = won[wins].teamId;
          user.ballotId = parentBallot._id;
          user.applied = 0;
          user.ballotRound = parentBallot.ballotRound + 1;
          user.wonCount = won[wins].data.length;
          console.log("USERS HERE iS: ", user);
          userList.push(user);
        } else {
          console.log("ITS won in ballot before/ not Autoassugned.");
        }
      }
      res.status(200).json({
        status: true,
        message: "Successfully got data",
        data: userList,
      });
    } catch (e) {
      return res.status(500).json({ status: false, message: "Something went wrong1", e });
    }

    function groupByAuto(array, f) {
      var groups = {};
      array.forEach(function (o) {
        var group = JSON.stringify(f(o));

        groups[group] = groups[group] || [];

        groups[group].push(o);
      });

      return Object.keys(groups).map(function (group) {
        var array = JSON.parse("[" + group + "]");
        return {
          userId: array[0][0],
          opsId: array[0][1],
          teamId: array[0][2],
          isAuto: array[0][3],
          data: groups[group],
        };
      });
    }
  }

  async exportleavebalance(req, res) {
    const appliedStaff = await Ballot.findOne({ _id: "5ddba42b6253dc44cbcc1dac" }, { _id: 0, appliedStaff: 1, opsGroupId: 1 });
    const userId = [];
    const opsIds = [];
    appliedStaff.opsGroupId.forEach((item) => {
      opsIds.push(item);
    });
    const opsD = await OpsGroup.find({ _id: { $in: opsIds } }, { _id: 1, userId: 1 }).lean();
    for (let j = 0; j <= opsD.length - 1; j++) {
      userId.push(opsD[j].userId);
      console.log("userdata: ", opsD[j].userId.length);
    }
    let IDS = [];
    for (let k = 0; k <= userId.length - 1; k++) {
      IDS = IDS.concat(userId[k]);
    }
    console.log("IDS ARE: ", IDS.length);
    const data = await StaffSapData.find(
      { staff_Id: { $in: IDS } },
      {
        staff_Id: 1,
        postBallotBalance: 1,
        daysBallotApplied: 1,
        ballotLeaveBalanced: 1,
        leavesBalanced: 1,
        leavesAvailed: 1,
        leavesEntitled: 1,
      }
    ).populate([{ path: "staff_Id", select: "_id name" }]);
    const findaData = [];
    data.forEach((item) => {
      const obj = JSON.parse(JSON.stringify(item));
      obj.userId = item.staff_Id._id;
      obj.userName = item.staff_Id.name;
      delete obj.staff_Id;
      findaData.push(obj);
    });
    res.send({ findaData });
  }
  async revertBallot(req, res) {
    const ballotData = await Ballot.findOne(
      { _id: "5db8f61142053834e4903aee" },
      {
        _id: 0,
        weekRange: 1,
        appliedStaff: 1,
        wonStaff: 1,
        leaveConfiguration: 1,
      }
    );
    const finalWonStaff = groupBy(ballotData.wonStaff, "weekNo");
    const applied = groupBy(ballotData.appliedStaff, "weekNo");
    const wonStaffIdWeekWise = [];
    const appliedStaffIdWeekwise = [];
    let leave = 5;
    if (ballotData.leaveConfiguration === 2) {
      leave = 6;
    } else if (ballotData.leaveConfiguration === 3) {
      leave = 7;
    }
    for (let i = 0; i < ballotData.weekRange.length; i++) {
      if (finalWonStaff["" + i]) {
        const arr = finalWonStaff["" + i];
        const userId = [];
        arr.forEach((item) => {
          userId.push(item.userId.toString());
        });
        wonStaffIdWeekWise.push(userId);
      } else {
        wonStaffIdWeekWise.push([]);
      }
      if (applied["" + i]) {
        const arr = applied["" + i];
        const userId = [];
        arr.forEach((item) => {
          userId.push(item.userId.toString());
        });
        appliedStaffIdWeekwise.push(userId);
      } else {
        appliedStaffIdWeekwise.push([]);
      }
    }

    const unsuccessfullStaff = [];
    for (let j = 0; j < ballotData.weekRange.length; j++) {
      const arr1 = appliedStaffIdWeekwise[j];
      const arr2 = wonStaffIdWeekWise[j];
      if (j === 0) {
        console.log("aaa", arr1, arr2);
      }
      const diffUserId = [];
      arr1.forEach((item) => {
        if (!arr2.includes(item)) {
          diffUserId.push(item);
        }
      });
      if (diffUserId.length === 0) {
        unsuccessfullStaff.push([]);
      } else {
        unsuccessfullStaff.push(diffUserId);
      }
    }
    function groupBy(xs, key) {
      return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
      }, {});
    }
    for (let i = 0; i < ballotData.weekRange.length; i++) {
      const userId = unsuccessfullStaff[i];
      if (userId.length > 0) {
        const sapData = StaffSapData.updateMany({ staff_Id: { $in: userId } }, { $inc: { ballotLeaveBalanced: -leave } }).then((result1) => {
          console.log(result1);
        });
      }
    }
    res.send({ unsuccessfullStaff });
  }

  async BallotDataByUserTestExport(req, res) {
    let All = [];
    const BallotR = await Ballot.findOne({ _id: "5db8f88242053834e4903b00" });
    var applied = groupByOU(BallotR.appliedStaff, function (item) {
      return [item.userId, item.opsGroupId, item.opsTeamId];
    });
    var wons = groupByOU(BallotR.wonStaff, function (item) {
      return [item.userId, item.opsGroupId, item.opsTeamId];
    });
    for (let apply = 0; apply <= applied.length - 1; apply++) {
      console.log("applied[apply]: ", applied[apply]);
      const user = await User.findOne({ _id: applied[apply].userId }, { _id: 1, name: 1, staffId: 1 }).populate({
        path: "parentBussinessUnitId",
        select: "name sectionId",
        populate: {
          path: "sectionId",
          select: "name departmentId",
          populate: {
            path: "departmentId",
            select: "name companyId",
            populate: {
              path: "companyId",
              select: "name status",
            },
          },
        },
      });
      // .populate(
      //             [{path:'parentBussinessUnitId',select:'name'}]);
      const ops = await OpsGroup.findOne({ _id: applied[apply].opsId }, { _id: 0, opsGroupName: 1 });
      const team = await OpsTeam.findOne({ _id: applied[apply].teamId }, { _id: 0, name: 1 });
      console.log("User: ", user);
      let row = {};
      row.name = user.name;
      row.staffId = user.staffId;
      row.parentBussinessUnitId =
        user.parentBussinessUnitId.sectionId.departmentId.name + " > " + user.parentBussinessUnitId.sectionId.name + " > " + user.parentBussinessUnitId.name;
      row.opsGroupName = ops.opsGroupName;
      if (team !== null) {
        row.opsTeamName = team.name;
      } else {
        row.opsTeamName = "";
      }

      row.appliedCount = applied[apply].data.length;
      row.slotSubmitted = [];
      for (let k = 0; k <= applied[apply].data.length - 1; k++) {
        let week = applied[apply].data[k].weekNo + 1;
        let dates = BallotR.weekRange[applied[apply].data[k].weekNo].start + "to" + BallotR.weekRange[applied[apply].data[k].weekNo].end;
        let slot = "slot-" + week + "-> " + dates;
        row.slotSubmitted.push(slot);
      }

      for (let won = 0; won <= wons.length - 1; won++) {
        if (applied[apply].userId === wons[won].userId && applied[apply].opsId === wons[won].opsId && applied[apply].teamId === wons[won].teamId) {
          row.wonCount = wons[won].data.length;
          row.slotSuccessfull = [];
          for (let k = 0; k <= wons[won].data.length - 1; k++) {
            let week = wons[won].data[k].weekNo + 1;
            let dates = BallotR.weekRange[wons[won].data[k].weekNo].start + "to" + BallotR.weekRange[wons[won].data[k].weekNo].end;
            let slot = "slot-" + week + "-> " + dates;
            row.slotSuccessfull.push(slot);

            row.unSuccessfull = [];
            let difference = row.slotSubmitted.filter((x) => !row.slotSuccessfull.includes(x));
            row.unSuccessfull.push(difference);
          }
        }
      }
      All.push(row);
    }
    // let data = {applied:applied.length,wins:wons.length}

    return res.json({ All });

    function groupByOU(array, f) {
      var groups = {};
      array.forEach(function (o) {
        var group = JSON.stringify(f(o));

        groups[group] = groups[group] || [];

        groups[group].push(o);
      });

      return Object.keys(groups).map(function (group) {
        var array = JSON.parse("[" + group + "]");
        return {
          userId: array[0][0],
          opsId: array[0][1],
          teamId: array[0][2],
          data: groups[group],
        };
      });
    }
  }

  async AutoAssignBallot(req, res) {
    let id = req.params.id;
    const ballot = await Ballot.findOne({ _id: id }).populate([
      {
        path: "adminId",
        select: "_id name staffId",
      },
      { path: "opsGroupId", model: "OpsGroup", select: "_id opsGroupName" },
    ]);
    if (!ballot) {
      return res.status(500).json({ success: false, message: "Requested ballot not found" });
    } else {
      if (ballot.isAutoAssign) {
        return res.status(402).json({
          success: false,
          message: "Requested ballot Already Auto assigned.",
        });
      }
      let newballot = JSON.stringify(ballot);
      newballot = JSON.parse(newballot);
      newballot.parentBallot = ballot._id;
      newballot.ballotStartDate = moment(newballot.ballotStartDate).format('MM-DD-YYYY');
      newballot.ballotEndDate = moment(newballot.ballotEndDate).format('MM-DD-YYYY');
      
      //start with remainng quotas
      let slots = ballot.slotCreation;
      if (newballot.userFrom === 2) {
        //FOr BU's
        for (let i = 0; i <= slots.length - 1; i++) {
          // let users = [];
          //const users = await User.find({parentBussinessUnitId : slots[i].buId},{_id:1,name:1});
          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            var found = ballot.wonStaff.filter(function (element) {
              return element.buId.toString() === slots[i].buId.toString() && element.weekNo === j;
            });
            //console.logs("FOUND: ", found);
            slots[i].arr[j].value = slots[i].arr[j].value - found.length;
          }
          //res.send(users)
        }
      } else {
        //For Ops groups
        for (let i = 0; i <= slots.length - 1; i++) {
          let opsGrpid = slots[i].opsGroup.opsId;
          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            let currentweek = j + "A";
            var found = ballot.wonStaff.filter(function (element) {
              return element.opsGroupId.toString() === opsGrpid.toString() && element.weekNo === j;
            });

            slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;
            if (slots[i].opsTeam.length > 0) {
              slots[i].opsTeam.forEach((team, d) => {
                currentweek = 'OG' + j + 'OT' + d.toString();
                console.log("Current week in Team: ", currentweek);
                var found = ballot.wonStaff.filter(function (element) {
                  if (element.opsTeamId) {
                    return element.opsTeamId.toString() === team._id.toString() && element.weekNo === j;
                  } else {
                    return element.opsGroupId === opsGrpid && !element.opsTeamId && element.weekNO === j;
                  }
                });
                //console.logs("FOUND: ", found);
                slots[i].weekRangeSlot[currentweek].value = slots[i].weekRangeSlot[currentweek].value - found.length;
              });
            }
          }
        }
      }
      newballot.ballotName = newballot.ballotName + "-AutoAssign";
      newballot.slotCreation = slots;
      newballot.appliedStaff = [];
      // newballot.wonStaff = [];
      newballot.isPublish = false;
      newballot.isDraft = false;
      newballot.isResultRelease = false;
      newballot.isAutoAssign = true;
      newballot.isConduct = false;
      delete newballot._id;
      delete newballot.updatedAt;
      delete newballot.createdAt;
      delete newballot.__v;
      delete newballot.resultReleaseDateTime;
      return  this.getslotsCalculated(newballot, res);
      //return res.status(201).json({status: true, data: newballot, message: "Received data."});
    }
  }

  async getslotsCalculated(ballot, res) {
    console.log("I am inside getSlots ");
    try {
      let slotdata = [];
      let totalTeamUnassign = 0;
      let Ratio = 0;
      if (ballot.userFrom === 2) {
        //for BU do it later
      } else {
        var startYear = new Date(ballot.ballotStartDate).getFullYear();
        let leaveFormat = 5;
        if (ballot.leaveConfiguration === 2) {
          leaveFormat = 6;
        } else if (ballot.leaveConfiguration === 3) {
          leaveFormat = 7;
        }
        if (ballot.leaveType == 2) {
          leaveFormat = 1;
        }

        let newballot = JSON.stringify(ballot);
        newballot = JSON.parse(newballot);
        //console.log("@ else me");
        let slots = ballot.slotCreation;
        let totUnAssign = 0;
        let totBQ = 0;
        for (let i = 0; i <= slots.length - 1; i++) {
          let totalQuota = 0;
          let opsGrpid = slots[i].opsGroup.opsId;
          slots[i].totalUnassignedIs = 0;

          slots[i].totalBallotBalance = 0;

          slots[i].opsGroup.unassignBalanace = 0;
          slots[i].opsGroup.BallotBalance = 0;
          let opsQuota = 0;
          let teamQuota = 0;
          let totalinAssign = 0;
          const opsGroupUser = await OpsGroup.findOne({ _id: slots[i].opsGroup.opsId }, { userId: 1, _id: 0 }).lean();

          let leaveBallanceData;
          if (ballot !== null && ballot.fixedBallotingLeaveType) {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(opsGroupUser.userId, ballot.companyId, startYear, true, ballot.leaveTypeId);
          } else {
            leaveBallanceData = await this.checkIsAnnualLeaveArr(opsGroupUser.userId, ballot.companyId, startYear, false);
          }
          // const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsGroupUser.userId, ballot.companyId, startYear);

          let opsUnassign = 0;
          leaveBallanceData.staffArr.forEach((item) => {
            opsUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
            // console.log("ininwww", opsUnassign);
          });
          slots[i].opsGroup.unassignBalanace = opsUnassign;
          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            let hasTeam = false;
            let currentweek = j + "A";
            opsQuota = slots[i].weekRangeSlot[currentweek].value;
            // slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + slots[i].weekRangeSlot[currentweek].value;
            let currentOpsSlotValueIs = slots[i].weekRangeSlot[currentweek].value;

            //Ops Team is there
            let slotValueOfTeams = 0;

            if (slots[i].opsTeam.length > 0) {
              hasTeam = true;
              for (let d = 0; d <= slots[i].opsTeam.length - 1; d++) {
                slots[i].opsTeam[d].unassignBalanace = 0;
                // let currentweek = j + d.toString();

                let currentweek = 'OG' + j + 'OT' + d.toString();

                slotValueOfTeams = slotValueOfTeams + slots[i].weekRangeSlot[currentweek].value;
                teamQuota = teamQuota + slots[i].weekRangeSlot[currentweek].value;
                if (slots[i].opsTeam[d].BallotBalance) {
                  slots[i].opsTeam[d].BallotBalance = slots[i].opsTeam[d].BallotBalance + slots[i].weekRangeSlot[currentweek].value;
                } else {
                  slots[i].opsTeam[d].BallotBalance = 0;
                  slots[i].opsTeam[d].BallotBalance = slots[i].opsTeam[d].BallotBalance + slots[i].weekRangeSlot[currentweek].value;
                }
                const opsTeamUser = await OpsTeam.findOne({ _id: slots[i].opsTeam[d]._id }, { userId: 1, _id: 0 }).lean();
                // const leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, ballot.companyId, startYear);

                let leaveBallanceData;
                if (ballot !== null && ballot.fixedBallotingLeaveType) {
                  leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, ballot.companyId, startYear, true, ballot.leaveTypeId);
                } else {
                  leaveBallanceData = await this.checkIsAnnualLeaveArr(opsTeamUser.userId, ballot.companyId, startYear, false);
                }

                let teamUnassign = 0;

                // console.log("leaveBallanceDataleaveBallanceDataleaveBallanceData", leaveBallanceData)

                leaveBallanceData.staffArr.forEach((item) => {
                  teamUnassign += Math.floor(item.leaveTypeData.planQuota / leaveFormat);
                });
                slots[i].opsTeam[d].unassignBalanace = teamUnassign;
                totalinAssign = totalinAssign + slots[i].opsTeam[d].unassignBalanace;
                slots[i].opsTeam[d].ratioForBalnceQuota = RATIO
              }
            }
            if (hasTeam) {
              if (slotValueOfTeams > currentOpsSlotValueIs) {
                slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + currentOpsSlotValueIs;
              } else {
                slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + slotValueOfTeams;
              }
            } else {
              slots[i].opsGroup.BallotBalance = slots[i].opsGroup.BallotBalance + currentOpsSlotValueIs;
            }

            slots[i].opsGroup.ratioForBalnceQuota = RATIO
            if (opsQuota > teamQuota) {
              totalQuota = totalQuota + teamQuota;
            } else {
              totalQuota = totalQuota + opsQuota;
            }
            if (teamQuota === 0) {
              totalQuota = totalQuota + opsQuota;
            }
            slots[i].totalBallotBalance = slots[i].opsGroup.BallotBalance;
          }
          if (slots[i].opsTeam.length > 0) {
            if (totalinAssign > slots[i].opsGroup.unassignBalanace) {
              slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + slots[i].opsGroup.unassignBalanace;
            } else {
              slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + totalinAssign;
            }
          } else {
            slots[i].totalUnassignedIs = slots[i].totalUnassignedIs + slots[i].opsGroup.unassignBalanace;
          }
          totBQ = totBQ + slots[i].totalBallotBalance;
          totUnAssign = totUnAssign + slots[i].totalUnassignedIs;
        }
        Ratio = totUnAssign / totBQ;
        ballot.TotBQ = totBQ;
        ballot.totUN = totUnAssign;
        ballot.RATio = RATIO
        //Ratio;
        for (let i = 0; i <= slots.length - 1; i++) {
          //  console.log("After above for are done",slots[i]);
          //   slots[i].totalUnassignedIs=0;

          let opsRatio = slots[i].opsGroup.ratioForBalnceQuota;
          let totalinAssign = 0;
          //   if (slots[i].opsTeam.length > 0) {
          //       for(let t=0;t<=slots[i].opsTeam.length-1;t++){
          //           totalinAssign = totalinAssign+slots[i].opsTeam[t].unassignBalanace;
          //       }
          //       if(totalinAssign > slots[i].opsGroup.unassignBalanace){
          //           slots[i].totalUnassignedIs = slots[i].totalUnassignedIs+slots[i].opsGroup.unassignBalanace;

          //       }else{
          //           slots[i].totalUnassignedIs = slots[i].totalUnassignedIs+totalinAssign;

          //       }
          //   }else{
          //       slots[i].totalUnassignedIs = slots[i].totalUnassignedIs+slots[i].opsGroup.unassignBalanace;
          //   }

          for (let j = 0; j <= slots[i].arr.length - 1; j++) {
            let currentweek = j + "A";

            slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;
            slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = Math.round(slots[i].weekRangeSlot[currentweek].value * ballot.RATio);
            // slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = slots[i].weekRangeSlot[currentweek].value * opsRatio;
            if (slots[i].opsTeam.length > 0) {
              for (let d = 0; d <= slots[i].opsTeam.length - 1; d++) {
                let teamRatio = slots[i].opsTeam[d].ratioForBalnceQuota;
                let currentweek = 'OG' + j + 'OT' + d.toString();
                slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = 0;
                //slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = slots[i].weekRangeSlot[currentweek].value * teamRatio;
                slots[i].weekRangeSlot[currentweek].balanceToBeAssigned = Math.round(slots[i].weekRangeSlot[currentweek].value * ballot.RATio);
              }
            }
          }
        }

        ballot.wonStaff = [];
        return res.status(201).json({ status: true, data: ballot, message: "Received data." });
      }
    } catch (e) {
      return res.json({ status: false, message: "Something went wrong1", e });
    }
  }

  async getSwapDetailChanges(req, res) {
    let reqdata = req.body;
    const ballot = await Ballot.findOne({ _id: reqdata.ballotId }, { weekRange: 1, wonStaff: 1 });
    let slotDates = {
      start: ballot.weekRange[reqdata.slotNo].start,
      end: ballot.weekRange[reqdata.slotNo].end,
    };
    const ops = await OpsGroup.findOne({ userId: req.user._id, isDelete: false }, { opsGroupName: 1, swopSetup: 1, userId: 1 }).populate({
      path: "userId",
      select: "name staffId",
    });
    if (ops) {
      let swopSetup = parseInt(ops.swopSetup);
      let users = [];
      console.log("in ops", ops);
      if (swopSetup == 1) {
        users = ops.userId;
      } else {
        const opsTeam = await OpsTeam.findOne({ userId: req.user._id, isDeleted: false }, { userId: 1 }).populate({ path: "userId", select: "name staffId" });
        if (opsTeam) {
          users = opsTeam.userId;
        } else {
          return res.status(300).json({
            success: false,
            data: null,
            message: "Couldn't find ops group data of you.",
          });
        }
      }
      const currentuser = await User.findOne({ _id: req.user._id }, { _id: 0, parentBussinessUnitId: 1 }).populate({
        path: "parentBussinessUnitId",
        select: "name",
        populate: {
          path: "sectionId",
          select: "name",
          populate: {
            path: "departmentId",
            select: "name",
            populate: {
              path: "companyId",
              select: "name",
            },
          },
        },
      });
      let BU =
        currentuser.parentBussinessUnitId.sectionId.departmentId.companyId.name +
        " > " +
        currentuser.parentBussinessUnitId.sectionId.departmentId.name +
        " > " +
        currentuser.parentBussinessUnitId.sectionId.name +
        " > " +
        currentuser.parentBussinessUnitId.name;

      let resObj = {
        Bu: BU,
        opsName: ops.opsGroupName,
        opsGroupId: ops._id,
        type: "Balloted",
        leavedays: 5,
        currentdates: slotDates,
        slotNo: reqdata.slotNo,
        users: users,
        ballotId: reqdata.ballotId,
      };
      return res.status(201).json({
        success: true,
        data: resObj,
        message: "received!",
      });
    } else {
      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find ops group data of you.",
      });
    }
  }

  async getslotswonByUser(req, res) {
    const ballot = await Ballot.findOne({ _id: req.body.ballotId }, { wonStaff: 1, weekRange: 1 });
    if (ballot && ballot.wonStaff.length > 0) {
      let users = ballot.wonStaff.filter((wq) => wq.userId.toString() == req.body.userId.toString());

      let resArr = [];
      for (let i = 0; i <= users.length - 1; i++) {
        let currObj = {};
        currObj.slotNo = users[i].weekNo;
        currObj.start = ballot.weekRange[users[i].weekNo].start;
        currObj.end = ballot.weekRange[users[i].weekNo].end;
        resArr.push(currObj);
      }
      return res.status(201).json({
        success: true,
        data: resArr,
        message: "received!",
      });
    } else {
      return res.status(300).json({
        success: false,
        data: null,
        message: "Couldn't find requested ballots and won users.",
      });
    }
  }

  async saveWonsAllAsLeave(wonStaff, weekRange, round, id) {
    let leaveObjects = [];
    if (wonStaff.length > 0) {
      for (let i = 0; i <= wonStaff.length - 1; i++) {
        var leave = {};
        leave.ballotId = id;
        leave.slotNo = wonStaff[i].weekNo;
        leave.userId = wonStaff[i].userId;
        leave.status = "Balloted";
        leave.type = 1;
        leave.fromdate = weekRange[wonStaff[i].weekNo].start;
        leave.todate = weekRange[wonStaff[i].weekNo].end;
        leave.ballotRound = round + 1;
        leaveObjects.push(leave);
      }
      userLeaves.insertMany(leaveObjects).then((docs) => {
        console.log(docs);
      });
    }
  }

  async saveWonsAllAsLeave(wonStaff, weekRange, round, id) {
    let leaveObjects = [];
    if (wonStaff.length > 0) {
      for (let i = 0; i <= wonStaff.length - 1; i++) {
        var leave = {};
        leave.ballotId = id;
        leave.slotNo = wonStaff[i].weekNo;
        leave.userId = wonStaff[i].userId;
        leave.status = "Balloted";
        leave.type = 1;
        leave.fromdate = weekRange[wonStaff[i].weekNo].start;
        leave.todate = weekRange[wonStaff[i].weekNo].end;
        leave.ballotRound = round + 1;
        leaveObjects.push(leave);
      }
      userLeaves.insertMany(leaveObjects).then((docs) => {
        console.log(docs);
      });
    }
  }

  async createLeaves(req, res) {
    const ballot = await Ballot.findOne({ _id: req.body.id });
    let leaveObjects = [];
    if (ballot.wonStaff.length > 0) {
      for (let i = 0; i <= ballot.wonStaff.length - 1; i++) {
        var leave = {};
        leave.ballotId = ballot._id;
        leave.slotNo = ballot.wonStaff[i].weekNo;
        leave.userId = ballot.wonStaff[i].userId;
        leave.status = "Balloted";
        leave.type = 1;
        leave.fromdate = ballot.weekRange[ballot.wonStaff[i].weekNo].start;
        leave.todate = ballot.weekRange[ballot.wonStaff[i].weekNo].end;
        leave.ballotRound = ballot.ballotRound + 1;
        leaveObjects.push(leave);
      }
      userLeaves.insertMany(leaveObjects).then((docs) => {
        console.log(docs);
      });
    }
  }
}

function intersect(a, b) {
  var t;
  if (b.length > a.length) (t = b), (b = a), (a = t); // indexOf to loop over shorter
  return a.filter(function (e) {
    return b.indexOf(e) > -1;
  });
}

Array.prototype.diff = function (arr2) {
  var ret = [];
  this.sort();
  arr2.sort();
  for (var i = 0; i < this.length; i += 1) {
    if (arr2.indexOf(this[i]) > -1) {
      ret.push(this[i]);
    }
  }
  return ret;
};
async function pushLeaveToLeaveApplied(ballotData) {
  console.log("i ammmmmmmmmmmmmmmmm&&&&&&&&&&&&&&&&&&&", ballotData.ballotName);
  if (ballotData.staffLeave) {
    for (let i = 0; i < ballotData.staffLeave.length; i++) {
      const leave = ballotData.staffLeave[i];
      const saveLeave = await new LeaveApplied(leave).save();
    }
  }
}

async function sendResultReleaseNotification(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find({ _id: { $in: item.opsGroupId }, isDelete: false }, { userId: 1, _id: 0 });
    //console.logs("userIDARR : ",userIDArr);
    let userId = [];
    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    //console.logs('userId', userId)
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select("deviceToken")
      .lean();
    ////console.logs('user11', JSON.stringify(unAssignUser));
    const usersDeviceTokens = [];
    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    //console.logs('usersDeviceTokens', usersDeviceTokens);
    if (usersDeviceTokens.length > 0) {
      //Balloting Exercise (Ballot Name) results are released, please check the results
      const pushData = {
        title: "Balloting Excercise results are released.",
        body: 'Balloting Excercise "' + item.ballotName + '" results are released,  please check the results.',
        bodyText: 'Balloting Excercise "' + item.ballotName + '" results are released, please check the results.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find({ parentBussinessUnitId: { $in: item.businessUnitId } }, { _id: 0, deviceToken: 1 });
    const usersDeviceTokens = [];
    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Balloting Excercise results are released.",
        body: 'Balloting Excercise "' + item.ballotName + '" results are released,  please check the results.',
        bodyText: 'Balloting Excercise "' + item.ballotName + '" results are released, please check the results.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}
// result release
async function resultReleaseFun(ballotId) {
  try{
    logInfo('resultReleaseFun called', ballotId)
  const ballotList = await Ballot.findOne({
    isDeleted: false,
    isCanceled: false,
    isPublish: true,
    isDraft: false,
    isConduct: true,
    isResultRelease: false,
    resultRelease: 1,
    _id:ballotId
  });

  if (ballotList) {
      ballotList.isResultRelease = true;
      sendResultReleaseNotification(ballotList)
      pushLeaveToLeaveApplied(ballotList);
      let ballot = await Ballot.findByIdAndUpdate(ballotList._id, {
        $set: { isResultRelease: true },
      });
      console.log("AT HERE SAVED");
  }
  return true;
}catch(e){
  logError('resultReleaseFun ballot has error', e)
  logError('resultReleaseFun ballot has error', e.stack)
  return false;
}
}
// publish ballot
async function publishBallot(ballotId){
  try{
  logInfo('publish ballot called', ballotId)
  const item = await Ballot.findOne({
    isDeleted: false,
    isCanceled: false,
    isPublish: false,
    isDraft: false,
    _id:ballotId
  });
  if (item) {
      // get user
      // update ballot ispublish
      if (item.userFrom === 1) {
        // user from ops group
        const userIDArr = await OpsGroup.find(
          { _id: { $in: item.opsGroupId }, isDelete: false },
          {
            userId: 1,
            _id: 0,
          }
        );
        let userId = [];
        userIDArr.forEach((item) => {
          userId = userId.concat(item.userId);
        });
        //console.logs('userId', userId)
        const unAssignUser = await User.find({ _id: { $in: userId } })
          .select("deviceToken")
          .lean();
        ////console.logs('user11', JSON.stringify(unAssignUser));
        const usersDeviceTokens = [];
        unAssignUser.forEach((token) => {
          if (token.deviceToken) {
            usersDeviceTokens.push(token.deviceToken);
          }
        });

        if (usersDeviceTokens.length > 0) {
          const pushData = {
            title: "New Balloting Exercise",
            body: '" ' + item.ballotName + '" Ballot Available. ',
            bodyText: item.ballotName + " ballot created.",
            bodyTime: [item.applicationCloseDateTime],
            bodyTimeFormat: ["dd MMM"],
          },
            collapseKey = item._id; /*unique id for this particular ballot */
          FCM.push(usersDeviceTokens, pushData, collapseKey);
        }
        const data = await Ballot.update({ _id: item._id }, { isPublish: true });
      } else {
        // user from bu
        const userList = await User.find(
          { parentBussinessUnitId: { $in: item.businessUnitId } },
          {
            _id: 0,
            deviceToken: 1,
          }
        );
        const usersDeviceTokens = [];
        userList.forEach((token) => {
          if (token.deviceToken) {
            usersDeviceTokens.push(token.deviceToken);
          }
        });

        if (usersDeviceTokens.length > 0) {
          const pushData = {
            title: "New Balloting Exercise",
            body: '" ' + item.ballotName + '" Ballot Available.',
            bodyText: item.ballotName + " ballot created.",
            bodyTime: [item.applicationCloseDateTime],
            bodyTimeFormat: ["dd MMM"],
          },
            collapseKey = item._id; /*unique id for this particular ballot */
          FCM.push(usersDeviceTokens, pushData, collapseKey);
        }
        const data = await Ballot.update({ _id: item._id }, { isPublish: true });
      }
  }
  return true
}catch(e){
  logError('publish ballot has error', e)
  logError('publish ballot has error', e.stack)
  return false;
}
}

async function sendBallotEditNotification(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find({ _id: { $in: item.opsGroupId }, isDelete: false }, { userId: 1, _id: 0 });
    //console.logs("userIDARR : ",userIDArr);
    let userId = [];
    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    //console.logs('userId', userId)
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select("deviceToken")
      .lean();
    ////console.logs('user11', JSON.stringify(unAssignUser));
    const usersDeviceTokens = [];
    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    //console.logs('usersDeviceTokens', usersDeviceTokens);
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Balloting Excercise Updated.",
        body: 'Balloting Excercise "' + item.ballotName + '" has been revised, please see the new details.',
        bodyText: 'Balloting Excercise "' + item.ballotName + '" has been revised, please see the new details.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find({ parentBussinessUnitId: { $in: item.businessUnitId } }, { _id: 0, deviceToken: 1 });
    const usersDeviceTokens = [];
    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Balloting Excercise Updated.",
        body: 'Balloting Excercise "' + item.ballotName + '" has been revised, please see the new details.',
        bodyText: 'Balloting Excercise "' + item.ballotName + '" has been revised, please see the new details.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}

async function ballotCancelledNotifications(item) {
  const currentTime = new Date();

  if (item.userFrom === 1) {
    const userIDArr = await OpsGroup.find({ _id: { $in: item.opsGroupId }, isDelete: false }, { userId: 1, _id: 0 });
    //console.logs("userIDARR : ",userIDArr);
    let userId = [];
    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    //console.logs('userId', userId)
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select("deviceToken")
      .lean();
    ////console.logs('user11', JSON.stringify(unAssignUser));
    const usersDeviceTokens = [];
    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    //console.logs('usersDeviceTokens', usersDeviceTokens);
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Balloting Excercise Cancelled.",
        body: 'Balloting Excercise "' + item.ballotName + '" has been Cancelled.',
        bodyText: 'Balloting Excercise "' + item.ballotName + '" has been Cancelled.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  } else {
    // user from bu
    const userList = await User.find({ parentBussinessUnitId: { $in: item.businessUnitId } }, { _id: 0, deviceToken: 1 });
    const usersDeviceTokens = [];
    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Ballot Cancelled",
        body: "Ballot" + item.ballotName + "has been Cancelled.",
        bodyText: "Ballot" + item.ballotName + "has been Cancelled.",
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 4 });
  }
}

async function ballotExtendNotifications(item) {
  const currentTime = new Date();
  if (item.userFrom === 1) {
    // user from ops group
    const userIDArr = await OpsGroup.find({ _id: { $in: item.opsGroupId }, isDelete: false }, { userId: 1, _id: 0 });
    let userId = [];
    userIDArr.forEach((item) => {
      userId = userId.concat(item.userId);
    });
    //console.logs('userId', userId)
    const unAssignUser = await User.find({ _id: { $in: userId } })
      .select("deviceToken")
      .lean();
    ////console.logs('user11', JSON.stringify(unAssignUser));
    const usersDeviceTokens = [];
    unAssignUser.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    //console.logs('usersDeviceTokens', usersDeviceTokens);
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Balloting Excercise Extended",
        body: 'Closing date of Balloting Excercise "' + item.ballotName + '" has been extended. Please check the new closing date.',
        bodyText: 'Closing date of Balloting Excercise "' + item.ballotName + '" has been extended. Please check the new closing date.',
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 3 });
  } else {
    // user from bu
    const userList = await User.find({ parentBussinessUnitId: { $in: item.businessUnitId } }, { _id: 0, deviceToken: 1 });
    const usersDeviceTokens = [];
    userList.forEach((token) => {
      if (token.deviceToken) {
        usersDeviceTokens.push(token.deviceToken);
      }
    });
    if (usersDeviceTokens.length > 0) {
      const pushData = {
        title: "Ballot Extended",
        body: "Ballot Application date is extended.",
        bodyText: "Applocation closing date for  Ballot: " + item.ballotName + "is extended.",
        bodyTime: currentTime,
        bodyTimeFormat: ["DD-MMM-YYYY HH:mm"],
      },
        collapseKey = item._id; /*unique id for this particular ballot */
      FCM.push(usersDeviceTokens, pushData, collapseKey);
    }
    const data = await Ballot.update({ _id: item._id }, { isNotified: 3 });
  }
}

async function conductBallot(id) {
  try {
   logInfo('conductBallot called', id)
    const ballotId = id;
    //console.logs('ballotId', ballotId)
    let ballotResult = await Ballot.findOne({
      _id: ballotId,
      isConduct: false,
    }); //isConduct: false

    if (ballotResult) {
      // result for BU
      let totalDeducated = 5;
      if (ballotResult.leaveConfiguration === 2) {
        totalDeducated = 6;
      } else if (ballotResult.leaveConfiguration === 3) {
        totalDeducated = 7;
      }
      if (ballotResult.leaveType == 2) {
        totalDeducated = 1;
      }
      console.log("ballotResult", ballotResult.ballotName);
      if (ballotResult.userFrom === 2) {
        ballotResult = JSON.stringify(ballotResult);
        ballotResult = JSON.parse(ballotResult);
        ////console.logs('ballotResult', ballotResult);
        let shuffle = [];
        shuffle = ballotResult.slotCreation;
        ballotResult.appliedStaff.forEach((appliedStaff) => {
          const indexOfBu = ballotResult.slotCreation.findIndex((x) => x.buId === appliedStaff.buId);
          if (shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff) {
            shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
          } else {
            shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff = [];
            shuffle[indexOfBu].arr[appliedStaff.weekNo].appliedStaff.push(appliedStaff);
          }
        });
        let finalWinStaff = [];
        shuffle.forEach((staffShuffle) => {
          staffShuffle.arr.forEach((slotWise) => {
            const howMuchWin = slotWise.value;

            if (slotWise.appliedStaff && slotWise.appliedStaff.length <= howMuchWin) {
              finalWinStaff = finalWinStaff.concat(slotWise.appliedStaff);
            } else if (slotWise.appliedStaff) {
              const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
              randomStaff.forEach((randomSelectedStaff) => {
                finalWinStaff.push(slotWise.appliedStaff[randomSelectedStaff]);
              });
              //console.logs('slotWise.appliedStaff.length', slotWise.appliedStaff.length, howMuchWin, randomStaff)
            }
          });
        });
        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: {
              wonStaff: finalWinStaff,
              isConduct: true,
              isResultRelease: false,
            },
          }
        );
        insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
        unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
        return true;
      } else {
        // for ops group
        ballotResult = JSON.stringify(ballotResult);
        ballotResult = JSON.parse(ballotResult);
        ////console.logs('ballotResult', ballotResult);
        let shuffle = [];

        const opsGroupQuota = [];
        shuffle = ballotResult.slotCreation;
        let appliedStaffArray = [];
        for (let i = 0; i < ballotResult.slotCreation.length; i++) {
          const opsGroupSlot = ballotResult.slotCreation[i];
          // get quato for ops group
          // get quato for team
          let slotValue = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            slotQuota: [],
          };
          opsGroupSlot.arr.forEach((arrItem, arrIndex) => {
            ////console.logs('aaaaaaaa');
            let key = "" + arrIndex + "A";
            let slotNumber = arrIndex;
            let slotOpsGroupValue = parseInt(opsGroupSlot.weekRangeSlot[key].value);
            //opsGroupQuato.push({value:opsGroupSlot.weekRangeSlot[key].value, key});
            const teamValue = [];
            let totalTeamQuota = 0;
            opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
              ////console.logs('aaaaaaaa');
              let key = "OG" + arrIndex +"OT"+ teamIndex;
              totalTeamQuota = totalTeamQuota + parseInt(opsGroupSlot.weekRangeSlot[key].value);
              teamValue.push(parseInt(opsGroupSlot.weekRangeSlot[key].value));
            });
            const obj = {
              slot: slotNumber,
              opsGroupQuotaValue: slotOpsGroupValue,
              opsTeamQuotaValue: teamValue,
              totalTeamQuota,
            };
            slotValue.slotQuota.push(obj);
          });
          ////console.logs('aauued', slotValue)
          opsGroupQuota.push(slotValue);
          ////console.logs('yyegwb');
          ////console.logs('aaaa', groupBy(ballotResult.appliedStaff,'weekNo'));
          let appliedStaffObject = {};
          appliedStaffObject = groupBy(ballotResult.appliedStaff, "opsTeamId");
          ////console.logs('appliedStaffObject', appliedStaffObject)
          //return res.send(ballotResult.appliedStaff)
          /* for(let keyyy in appliedStaffObject){
                         const ayaya = groupBy(appliedStaffObject[keyyy],'weekNo');
                         appliedStaffArray.push(ayaya);
                     }*/
          const opsGroupSlotWithTeam = {
            opsGroupId: opsGroupSlot.opsGroup.opsId,
            opsTeamValue: [],
          };
          //console.logs('yyegwbaaa',opsGroupSlot.opsTeam);
          if (opsGroupSlot.opsTeam && opsGroupSlot.opsTeam.length > 0) {
            opsGroupSlot.opsTeam.forEach((teamItem, teamIndex) => {
              if (appliedStaffObject[teamItem._id]) {
                const ayaya = groupBy(appliedStaffObject[teamItem._id], "weekNo");
                opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
              } else {
                opsGroupSlotWithTeam.opsTeamValue.push({});
              }
            });
          } else {
            //console.logs('no temmmm',appliedStaffObject);
            if (isEmpty(appliedStaffObject)) {
              // Object is empty (Would return true in this example)
              //console.logs("do nothing obect is empty");
            } else {
              // Object is NOT empty
              if (appliedStaffObject["undefined"]) {
                const staffAyaya = appliedStaffObject["undefined"].filter((sta) => {
                  return sta.opsGroupId.toString() === opsGroupSlot.opsGroup.opsId.toString();
                });
                appliedStaffObject["undefined"] = [];
                appliedStaffObject["undefined"] = staffAyaya;
                const ayaya = groupBy(appliedStaffObject["undefined"], "weekNo");
                opsGroupSlotWithTeam.opsTeamValue.push(ayaya);
              }
              //console.logs("please check here");
            }
          }
          ////console.logs('hgfgetgt')
          appliedStaffArray.push(opsGroupSlotWithTeam);
          /*groupBy(ballotResult.appliedStaff, function(item)
                    {
                        return [item.weekNo, item.opsTeamId];
                    });*/
        }
        function isEmpty(obj) {
          for (var key in obj) {
            if (obj.hasOwnProperty(key)) return false;
          }
          return true;
        }
        ////console.logs('aaaaaaaa');
        function groupBy(xs, key) {
          return xs.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
          }, {});
        }

        /* function groupBy( array , f )
                 {
                     var groups = {};
                     array.forEach( function( o )
                     {
                         var group = JSON.stringify( f(o) );
                         groups[group] = groups[group] || [];
                         groups[group].push( o );
                     });
                     return Object.keys(groups).map( function( group )
                     {
                         return groups[group];
                     })
                 }*/

        let limitQuota = [];
        let finalWinStaff = [];
        console.log("aaaaaaaa");
        opsGroupQuota.forEach((item, topIndex) => {
          ////console.logs('aaa')
          let objA = {
            opsGroupId: item.opsGroupId,
          };
          item.slotQuota.forEach((slll) => {
            objA.slot = slll.slot;
            if (slll.opsTeamQuotaValue.length === 0) {
              objA.isTeamPresent = false;
              objA.opsGroupQuotaValue = slll.opsGroupQuotaValue;
              // //console.logs('callleddd');
              if (appliedStaffArray[topIndex].opsTeamValue[0] && appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]) {
                if (slll.opsGroupQuotaValue >= appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length) {
                  finalWinStaff = finalWinStaff.concat(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot]);
                } else {
                  const randomStaff = getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot].length, slll.opsGroupQuotaValue);
                  randomStaff.forEach((ppp) => {
                    finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[0]["" + slll.slot][ppp]);
                  });
                }
              }

              // const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
            } else if (slll.opsGroupQuotaValue >= slll.totalTeamQuota) {
              // all team quota should win
              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                if (
                  appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                  appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                ) {
                  console.log("bbb");
                  const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length;
                  //console.logs('len', len, slll.slot, p);
                  // p means no of win
                  // len means no of applied
                  if (len > p) {
                    const randomStaff = getRandomNumber(len, p);
                    //console.logs('randomStaff', randomStaff);
                    randomStaff.forEach((randomSelectedStaff) => {
                      finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][randomSelectedStaff]);
                    });
                  } else {
                    for (let x = 0; x < len; x++) {
                      finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][x]);
                    }
                  }
                }
                //const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
              });
            } else {
              // if ops group quota value is less then total team quota
              let allAppliedStaff = [];
              slll.opsTeamQuotaValue.forEach((p, opsTeamQuotaValueIndex) => {
                ////console.logs('topIndexppppppp', topIndex, opsTeamQuotaValueIndex);
                if (
                  appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex] &&
                  appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]
                ) {
                  //console.logs('aaaaeee');
                  if (p >= appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length) {
                    // //console.logs('hh', appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot])
                    allAppliedStaff = allAppliedStaff.concat(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot]);
                  } else {
                    //console.logs('thiselseworkssss')
                    const randomStaff = getRandomNumber(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot].length, p);
                    randomStaff.forEach((ppp) => {
                      allAppliedStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex]["" + slll.slot][ppp]);
                    });
                  }
                  /*       //console.logs('bbb');
                                    const len = appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot].length;
                                    //console.logs('len', len, slll.slot, p);
                                    // p means no of win
                                    // len means no of applied
                                    if(len>p) {
                                        const randomStaff = getRandomNumber(len, p);
                                        //console.logs('randomStaff', randomStaff);
                                        randomStaff.forEach((randomSelectedStaff)=>{
                                            finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][randomSelectedStaff])
                                        });
                                    }else {
                                        for(let x=0; x<len; x++){
                                            finalWinStaff.push(appliedStaffArray[topIndex].opsTeamValue[opsTeamQuotaValueIndex][''+slll.slot][x]);
                                        }
                                    }*/
                }

                //const randomStaff = getRandomNumber(slotWise.appliedStaff.length, howMuchWin);
              });
              if (allAppliedStaff.length > 0) {
                //console.logs('ahugwgg')
                const finalAppliedStaff = [];
                const randomStaff = getRandomNumber(allAppliedStaff.length, allAppliedStaff.length);
                //console.logs('randomStaff', randomStaff, allAppliedStaff.length);
                randomStaff.forEach((ppp) => {
                  finalAppliedStaff.push(allAppliedStaff[ppp]);
                });
                const finalRandomStaff = getRandomNumber(allAppliedStaff.length, slll.opsGroupQuotaValue);
                //console.logs('finalRandomStaff', finalRandomStaff)
                //console.logs('sdhfys', allAppliedStaff.length, finalRandomStaff, slll.opsGroupQuotaValue);
                finalRandomStaff.forEach((ppp) => {
                  finalWinStaff.push(finalAppliedStaff[ppp]);
                });
              }
            }
          });
        });
        console.log("finalWinStaff", finalWinStaff);
        const updateWin = await Ballot.findOneAndUpdate(
          { _id: ballotId },
          {
            $set: {
              wonStaff: finalWinStaff,
              isConduct: true,
              isResultRelease: false,
            },
          }
        );
        insertStaffLeaveForBallot(finalWinStaff, updateWin, totalDeducated);
        unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId);
        return true;
      }
    } else {
      logInfo('conductBallot not found', id)
      return true;
    }
  } catch (e) {
    console.log("éee", e);
    logError('conductBallot has error', e)
    logError('conductBallot has error', e.stack)
    return false;
  }
}

function getRandomNumber(length, howMany) {
  //console.logs("aaaaa")
  if (howMany > length) {
    howMany = length;
  }
  const arr = [];
  for (let i = 0; i < howMany; i++) {
    const num = Math.floor(Math.random() * (length - 0)) + 0;
    if (arr.includes(num)) {
      i = i - 1;
    } else {
      arr.push(num);
    }
  }
  return arr;
}
async function checkIsAnnualLeave(userId, companyId, year, isFixedBallotingLeaveType = false, leaveTypeId = null) {
  let annualLeave;
  if (isFixedBallotingLeaveType) {
    annualLeave = await leaveType.findOne({ _id: leaveTypeId, isActive: true, companyId });
  } else {
    annualLeave = await leaveType.findOne({ name: "Annual Leave", isActive: true, companyId });
  }

  console.log("annualLeaveannualLeaveannualLeaveannualLeaveannualLeavewwwwwqqq", annualLeave)

  // const annualLeave = await leaveType.findOne({ name: "Annual Leave", isActive: true, companyId });
  if (annualLeave) {
    const staffLevaeData = await staffLeave.findOne({
      userId: userId,
      "leaveDetails.leaveTypeId": annualLeave._id,
    });
    if (staffLevaeData) {
      if (!year) {
        let leaveTypeData = staffLevaeData.leaveDetails.filter((leave) => {
          return leave.leaveTypeId.toString() == annualLeave._id.toString();
        })[0];
        return {
          leaveTypeData,
          status: true,
          leaveGroupId: staffLevaeData.leaveGroupId,
          businessUnitId: staffLevaeData.businessUnitId,
        };
      } else {
        let leaveTypeData = staffLevaeData.leaveDetails.filter((leave) => {
          return leave.leaveTypeId.toString() == annualLeave._id.toString() && leave.year == year;
        });
        var status = true
        if (leaveTypeData && leaveTypeData.length > 0) {
          leaveTypeData = leaveTypeData[0]

        } else {
          status = false;
          leaveTypeData = {};
        }
        return {
          leaveTypeData,
          status,
          leaveGroupId: staffLevaeData.leaveGroupId,
          businessUnitId: staffLevaeData.businessUnitId,
        };
      }
    }
    return { status: false };
  }
  return { status: false };
}
async function managePlanLeave(userId, leaveQuota, leaveTypeData, startYear = new Date().getFullYear()) {
  console.log("leave aa", leaveQuota);
  const updateStaffLeave = await staffLeave.findOneAndUpdate(
    { userId, leaveDetails: { "$elemMatch": { "year": startYear, leaveTypeId: leaveTypeData.leaveTypeId } } },
    { $inc: { "leaveDetails.$.planQuota": leaveQuota, "leaveDetails.$.request": leaveQuota } }
  );
  return updateStaffLeave;
}
async function insertStaffLeaveForBallot(finalWinStaff, ballot, totalDeducated) {
  //userId, weekNo,
  // yyyy-mm-dd
  const finalLeave = [];
  for (let i = 0; i < finalWinStaff.length; i++) {
    const staffWon = finalWinStaff[i];
    const userId = staffWon.userId;
    const leaveTypeData = await checkIsAnnualLeave(userId, ballot.companyId);
    if (leaveTypeData.status) {
      const slotWon = staffWon.weekNo;
      const slotArr = ballot.weekRange;
      const slotValue = slotArr[slotWon];
      let startDate = moment(slotValue.start); //.format('DD-MM-YYYY');
      console.log("startDate", startDate);
      let endDate = moment(slotValue.end);
      const diff = endDate.diff(startDate, "days") + 1;
      console.log("diff", diff);
      let leaveTypeId = leaveTypeData.leaveTypeData.leaveTypeId;
      let leaveGroupId = leaveTypeData.leaveGroupId;
      let parentBussinessUnitId = leaveTypeData.businessUnitId;
      const obj = {
        ballotId: ballot._id,
        userId,
        startDate,
        endDate,
        totalDeducated,
        totalRestOff: diff - totalDeducated,
        leaveTypeId: leaveTypeId,
        leaveGroupId: leaveGroupId,
        remark: "Won by Ballot",
        timeZone: ballot.timeZone,
        totalDay: diff,
        businessUnitId: parentBussinessUnitId,
        status: 4,
        submittedFrom: 4,
      };
      finalLeave.push(obj);
      //const saveLeave = new LeaveApplied(obj).save();
    } else {
      // failed to won as anuual leave is not present
    }
  }
  const finalLeavePush = await Ballot.findOneAndUpdate({ _id: ballot._id }, { $set: { staffLeave: finalLeave } });
}
async function unSuccessfullStaffLeaveBallotBalanaceUpdate(ballotId) {
  //console.logs('ballotId', ballotId)
  const ballotData = await Ballot.findOne({ _id: ballotId });
  let leave = 5;
  if (ballotData.leaveConfiguration === 2) {
    leave = 6;
  } else if (ballotData.leaveConfiguration === 3) {
    leave = 7;
  } else if (ballotData.leaveConfiguration === 4) {
    leave = 1;
  }
  if (ballotData.leaveType == 2) {
    leave = 1;
  }
  console.log("leaveleave", leave);
  const appliedStaff = groupBy(ballotData.appliedStaff, "userId");
  const wonStaff = groupBy(ballotData.wonStaff, "userId");
  ////console.logs('ba', JSON.stringify(ballotData));
  const updateLeaveBy = [];
  for (let key in appliedStaff) {
    const obj = {
      userId: key,
      value: 0,
      startYear: new Date().getFullYear
    };
    const staffAppliedCount = appliedStaff[key].length;
    const slotNo = appliedStaff[key][0].weekNo;
    const startDate = ballotData.weekRange[slotNo].start;
    const startYearF = new Date(startDate).getFullYear();
    let staffWonCount = 0;
    if (wonStaff[key]) {
      staffWonCount = wonStaff[key].length;
    }
    obj.startYear = startYearF;
    obj.value = (staffAppliedCount - staffWonCount) * leave;
    updateLeaveBy.push(obj);
  }
  for (let i = 0; i < updateLeaveBy.length; i++) {
    const user = updateLeaveBy[i];
    const userId = user.userId;
    const startYear = user.startYear;

    let leaveTypeData;
    if (ballotData !== null && ballotData.fixedBallotingLeaveType) {
      leaveTypeData = await checkIsAnnualLeave(userId, ballotData.companyId, null, true, ballotData.leaveTypeId);
    } else {
      leaveTypeData = await checkIsAnnualLeave(userId, ballotData.companyId, null, false);
    }
    // const leaveTypeData = await checkIsAnnualLeave(userId, ballotData.companyId);
    //console.logs('user', user)
    if (leaveTypeData.status) {
      let totalLeave = leaveTypeData.leaveTypeData.planQuota + user.value;
      const update = await managePlanLeave(userId, user.value, leaveTypeData.leaveTypeData, startYear);
      // const staffLevae = await StaffSapData.findOne({staff_Id: user.userId});
      // if (staffLevae) {
      //     let totalLeave = staffLevae.ballotLeaveBalanced + user.value;
      //     if (totalLeave > staffLevae.leavesBalanced) {
      //         totalLeave = staffLevae.leavesBalanced;
      //     }
      //     // //console.logs(staffLevae)
      //     const update = await StaffSapData.update({staff_Id: user.userId}, {$set: {ballotLeaveBalanced: totalLeave}});
      // }
    }
  }

  function groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  }
}
ballot = new ballot();
module.exports = {ballot, conductBallot, publishBallot, resultReleaseFun};
