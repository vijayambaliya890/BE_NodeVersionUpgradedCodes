const FCM = require('fcm-push'),
    dotenv = require('dotenv').config(), User = require('../app/models/user'), fs= require('fs'),moment=require('moment'),
    serverkey = process.env.FCM_SERVER_KEY, fcmm = new FCM(serverkey);


class fcm {
    async logData(contentToAppend, lore) {
        const today = new Date()
        const dir_path = `./public/logs/`;
        const fileName = `${dir_path}${lore}_${today.getFullYear()}_${(today.getMonth() + 1)}_${today.getDate()}.log`;
        if(fs.existsSync(fileName)) {
            await fs.mkdirSync(dir_path, { recursive: true }) // file created
        }
        await fs.appendFileSync(fileName, contentToAppend);
    }

    async sendMessage(message, notificationData, staffDetailswithDeviceToken){
        if(!!staffDetailswithDeviceToken) {
            console.log(">>> message in fcm :", staffDetailswithDeviceToken, "\n", JSON.stringify(message), "\n", new Date());
        }
        return await fcmm.send(message).then(async result => {
            const logText = {
                time: moment().format(),
                params: result,
                notificationData,
                message,
                staffDetailswithDeviceToken
            }
            // await fs.appendFileSync('./public/logs/logger.log', JSON.stringify(logText));
            await this.logData("\n\n" + JSON.stringify(logText), "logger");
        }).catch(async error => {
            console.log(error)
            const logText = {
                time: moment().format(),message, params: error, notificationData, staffDetailswithDeviceToken
            }
            // await fs.appendFileSync('./public/logs/error.log', JSON.stringify(logText));
            await this.logData("\n\n" + JSON.stringify(logText), "error");
        });
    }
    async push(deviceTokens, notificationData, collapseKey, staffDetailswithDeviceToken) {
        try {
            let foregroundShow = {
                show_in_foreground: true
            }, customNotification = {
                ...foregroundShow,
                ...notificationData
            }, data = {
                custom_notification: customNotification
            };
            let response='';
            // console.log(">>> >>> notification logs :", notificationData);
            const deviceTokenSet = deviceTokens.reduce((prev, curr)=>{
                if(curr){
                    prev.add(curr);
                }
                return prev;
            }, new Set());
            deviceTokens = Array.from(deviceTokenSet);
            const expiration = Date.now();
            if(deviceTokens.length>=1000){
                const chunk = (arr, c) => arr.reduce((all,one,i) => {
                    const ch = Math.floor(i/c);
                    all[ch] = [].concat((all[ch]||[]),one);
                    return all;
                 }, []);
                 const chunkArray = chunk(deviceTokens, 900);
                 for (const temparray of chunkArray) {
                    let message = {
                        collapse_key: collapseKey,
                        data: data,
                        notification: customNotification,
                        registration_ids:temparray,
                        "apns": {
                            "headers": {
                              "apns-expiration": `${expiration}`
                            }
                          },
                          "android": {
                            "ttl": "60s"
                          },
                          "time_to_live": 30
                    }
                    response = await this.sendMessage(message, notificationData, staffDetailswithDeviceToken);
                 }
            } else {
                let message = {
                    collapse_key: collapseKey,
                    data: data,
                    notification: customNotification,
                    registration_ids:deviceTokens,
                    "apns": {
                        "headers": {
                          "apns-expiration": `${expiration}`
                        }
                      },
                      "android": {
                        "ttl": "60s"
                      },
                      "time_to_live": 30
                }
                response = await this.sendMessage(message, notificationData, staffDetailswithDeviceToken);
            }
            return {
                "data": "Successfully sent with response: ",
                "response": response
            };
        } catch (err) {
            console.log(err, 'err');
            return {
                "data": "Something has gone wrong! ",
                "response": err
            };
        }

    }
}
fcm = new fcm();
module.exports = fcm;