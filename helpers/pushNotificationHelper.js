const mongoose = require('mongoose')
const User = require('../app/models/user');
const Notification = require('../app/models/notification');
const Post = require('../app/models/post');
const Challenge = require('../app/models/challenge');
const mActions = {
    CREATE_WALL_POST: 'CREATE_WALL_POST',
    CREATE_WALL_POST_NOMINEE: 'CREATE_WALL_POST_NOMINEE',
    UPDATE_WALL_POST_ADD_TASK: 'UPDATE_WALL_POST_ADD_TASK',
    CREATE_ADMIN_RESPONSE: 'CREATE_ADMIN_RESPONSE',
    PROFILE_UPDATED: 'PROFILE_UPDATED',
    CREATE_CUSTOM_FORM: 'CREATE_CUSTOM_FORM',
    PUBLISH_NOTIFICATION: 'PUBLISH_NOTIFICATION',
    PUBLISH_NEWS_EVENT: 'PUBLISH_NEWS_EVENT',
    PUBLISH_CHALLENGE: 'PUBLISH_CHALLENGE'
};

//  const status_flags = {
//     DRAFT: "draft",
//     ACTIVE: "active",
//     INACTIVE: "inactive",
//     DELETED: "deleted"
// };

 const status_flags = {
    DRAFT: 3,
    ACTIVE: 1,
    INACTIVE: 2,
    DELETED: 0
};
class pushNotificationHelper {
    constructor() { }

    async getUserList(input) {
        let output = {
            isActive: true,
            reason: '', // provide reason if isActive is false
            deviceTokenList: [],
            userIds: []
        }

        const userData = async (assignUsers, selectArray = ["_id", "staffId", "deviceToken"]) => await this.getAssignUsers({ assignUsers }, selectArray),
            getDetails = async condition => await this.getUserDetails(condition, { "_id": 1, "staffId": 1, "deviceToken": 1 }),
            mapper = (userDetails) => {
                output.userIds = userDetails.map(u => u._id);
                output.deviceTokenList = userDetails.map(u => u.deviceToken).filter(Boolean);
            };

        /* 1.Myboard push notification */
        /* 2.User push notification */
        /* 3.Customform notification */
        /* 4.Notification module notification */
        /* 5.News/event notification */
        /* 6.Challenge notification */

        // 1.1 create wall post
        if (mActions.CREATE_WALL_POST === input.moduleAction) {
            const userDetails = await userData(input.assignUsers);
            input.moduleId = input.moduleId + '_create_post'; // collapse key
            mapper(userDetails);
        }

        // 1.2 create wall post with nominee users
        if (mActions.CREATE_WALL_POST_NOMINEE === input.moduleAction) {
            const userDetails = await getDetails({ _id: { $in: input.nomineeUsers } });
            input.moduleId = input.moduleId + '_nominee_wall_post'; // collapse key
            mapper(userDetails);
        }

        // 1.3 update wall post with new task
        if (mActions.UPDATE_WALL_POST_ADD_TASK === input.moduleAction) {
            const userDetails = await getDetails({ _id: { $in: input.assignedToList } });
            input.moduleId = input.moduleId + '_add_task'; // collapse key
            mapper(userDetails);
        }

        // 1.4 create admin response for a wall post
        if (mActions.CREATE_ADMIN_RESPONSE === input.moduleAction) {
            const userDetails = await getDetails({ _id: { $in: input.userIds } });
            input.moduleId = input.moduleId + '_admin_response'; // collapse key
            mapper(userDetails);
        }



        // 2.1 user profile updated by admin
        if (mActions.PROFILE_UPDATED === input.moduleAction) {
            const userDetails = await getDetails({ _id: { $in: [input.moduleId] } });
            input.moduleId = input.moduleId + '_user_profile_update'; // collapse key
            mapper(userDetails);
        }



        // 3.1 create custom form
        if (mActions.CREATE_CUSTOM_FORM === input.moduleAction) {
            const userDetails = await userData(input.assignUsers);
            input.moduleId = input.moduleId + '_create_customform'; // collapse key
            mapper(userDetails);
        }



        // 4.1 notification dynamic user assign
        /* need to implement */

        // 4.2 create notification
        if (mActions.PUBLISH_NOTIFICATION === input.moduleAction && (input.isDynamic === 1)) { // dynamic user notification
            const notification = await this.getOneNotification({ _id: input.moduleId, status: status_flags.ACTIVE }, { assignUsers: 1 });
            if (!notification) {
                output.isActive = false;
                output.reason = 'notification is not active or not exists';
                return output;
            }
            const userDetails = await userData(notification.assignUsers);
            input.moduleId = input.moduleId + '_PUBLISH_NOTIFICATION'; // collapse key
            mapper(userDetails);
        }
        if (mActions.PUBLISH_NOTIFICATION === input.moduleAction && (input.isDynamic !== 1)) { // static user notification
            const notification = await this.getOneNotification({ _id: input.moduleId, status: status_flags.ACTIVE }, { notifyOverAllUsers: 1 });
            if (!notification) {
                output.isActive = false;
                output.reason = 'notification is not active or not exists';
                return output;
            }
            const userDetails = await getDetails({ _id: { $in: notification.notifyOverAllUsers } });
            input.moduleId = input.moduleId + '_PUBLISH_NOTIFICATION'; // collapse key
            mapper(userDetails);
        }



        // 5.1 news/event publish
        if (mActions.PUBLISH_NEWS_EVENT === input.moduleAction) { // publish news or event
            // check path are correct or not
            const post = await this.getOnePost({ _id: input.moduleId, status: status_flags.ACTIVE }, {}, [
                {
                    path: "channelId",
                    select: "_id name assignUsers",
                    match: {
                        status: status_flags.ACTIVE
                    }
                }, {
                    path: "categoryId",
                    select: "_id name",
                    match: {
                        status: status_flags.ACTIVE
                    }
                }
            ]);
            if (!post || !post.channelId || !post.categoryId) {
                output.isActive = false;
                output.reason = !post ? 'post not in active status' : 'channel or category not active';
                return output;
            }
            const userDetails = await userData(post.assignUsers);
            input.moduleId = input.moduleId + '_publish_post'; // collapse key
            mapper(userDetails);
        }



        // 6.1 news/event publish
        if (mActions.PUBLISH_CHALLENGE === input.moduleAction) { // publish challenge
            let challenge = await this.getChallenges({ _id: input.moduleId, status: status_flags.ACTIVE }, {}, [
                {
                    path: "selectedChannel",
                    select: "assignUsers"
                }, {
                    path: "selectedWall",
                    select: "assignUsers"
                }
            ]);
            challenge = challenge[0];
            challenge.assignUsers = challenge.selectedChannel && challenge.selectedChannel.assignUsers || challenge.selectedWall && challenge.selectedWall.assignUsers;
            if (!challenge || !challenge.selectedChannel || !challenge.selectedWall) {
                output.isActive = false;
                output.reason = !challenge ? 'challenge not in active status' : 'channel or board not exists';
                return output;
            }
            const userDetails = await userData(challenge.assignUsers);
            input.moduleId = input.moduleId + '_publish_challenge'; // collapse key
            mapper(userDetails);
        }


        return output;
    }

    async getChallenges(condition = {}, select = {}, populateArr = []) {
        if (!populateArr.length) {
          return await Challenge.find(condition, select).lean();
        }
        return await Challenge.find(condition, select).populate(populateArr).lean();
      }

    async getOnePost(condition, select = {}, populateArr = []) {

        let model = Post.findOne({
            ...condition
        }, {
            ...select
        });

        if (!populateArr.length) {
            return await model.lean();
        }

        return await model.populate(populateArr).lean();
    }

    async getOneNotification(condition = {}, select = {}) {
        // const db = await getDB(this.dbName)
        // const notificationModel = await db.getModel(MODELS.NOTIFICATION)
        return await Notification.findOne(condition, select).lean();
    }

    async getAssignUsers(featureModule, selectList = []) {
         const   _id = '_id';

        if (-1 === selectList.indexOf(_id)) {
            selectList.push(_id)
        }

        const $project = selectList.reduce((final, item) => ({ ...final, [item]: 1 }), {});
        const assignUsers = featureModule.assignUsers;
        console.log("featureModulefeatureModule", featureModule)
        let userCondition = [];
        for (const curr of assignUsers) {
            let includeOnly = [];
            let excludeOnly = [];
            if (curr.customField.length) {
                for (const customField of curr.customField) {
                    includeOnly.push({ "otherFields.fieldId": customField._id, "otherFields.value": customField.value });
                    excludeOnly.push({
                        "otherFields.fieldId": customField._id,
                        "otherFields.value": {
                            $ne: customField.value,
                        },
                    });
                }
            }
            let businessUnits = [];
            if (curr.allBuToken) {
                const userBus = await User.findOne({ staffId: curr.allBuTokenStaffId }).select("planBussinessUnitId").lean();
                if (!!userBus) {
                    businessUnits = userBus.planBussinessUnitId.map(v => mongoose.Types.ObjectId(v));
                }
            } else {
                businessUnits = curr.businessUnits.map(v => mongoose.Types.ObjectId(v));
            }
            const appointmentIds = curr.appointments.map((v) => mongoose.Types.ObjectId(v)),
                userIds = curr.user.map((v) => mongoose.Types.ObjectId(v));
            let condition = {};
            if (1 === curr.buFilterType) {
                condition["parentBussinessUnitId"] = {
                    $in: businessUnits,
                };
            } else if (2 === curr.buFilterType) {
                condition["parentBussinessUnitId"] = {
                    $in: businessUnits,
                };
                condition["$or"] = [{
                    appointmentId: {
                        $in: appointmentIds,
                    },
                },
                //   {
                //     subSkillSets: {
                //       $in: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
                //     },
                //   },
                {
                    _id: {
                        $in: userIds,
                    },
                },
                ...includeOnly,
                ];
            } else if (3 === curr.buFilterType) {
                condition["parentBussinessUnitId"] = {
                    $in: businessUnits,
                };
                condition["$and"] = [{
                    appointmentId: {
                        $nin: appointmentIds,
                    },
                },
                //   {
                //     subSkillSets: {
                //       $nin: curr.subSkillSets.map((v) => mongoose.Types.ObjectId(v)),
                //     },
                //   },
                {
                    _id: {
                        $nin: userIds,
                    },
                },
                ...excludeOnly,
                ];
            }
            userCondition.push(condition);
        }
        const userList = await User.aggregate([{
            $match: {
                $or: userCondition
            },
        }, {
            $project
        }]).allowDiskUse(true);

        if ((selectList.length === 1) && selectList[0] === "_id") {
            return userList.map((user) => user._id)
        } else {
            return userList;
        }
    }

    async getUserDetails(condition, select = {}) {
        return await User.find({
            ...condition
        }, { ...select }).lean();
    }
}

// export default new pushNotificationHelper();
pushNotificationHelper = new pushNotificationHelper();
module.exports = pushNotificationHelper;
