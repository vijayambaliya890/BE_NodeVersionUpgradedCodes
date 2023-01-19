// import FCM from 'fcm-push';
const FCM = require('fcm-push');
const fcmKey = process.env.FCM_SERVER_KEY;
const fcm = new FCM(fcmKey);
class PushNotification {
    async push(notificationData, token, key) {
        let foregroundShow = {
            show_in_foreground: true
        }
        let customNotification = {
            ...foregroundShow,
            ...notificationData
        }
        let data = {
            custom_notification: customNotification
        };
        const Apnsexpiration = Date.now();
        let message = {
            collapse_key: key,
            data: data,
            notification: customNotification,
            registration_ids: token,
            apns: {
                headers: {
                    "apns-expiration": Apnsexpiration
                }
            },
            android: {
                ttl: "60s"
            },
            time_to_live: 30
        }
        fcm.send(message, function (err, response) {
            if (err) {
                console.log("Something has gone wrong!", err);
            } else {
                console.log("Successfully sent with response: ", response);
            }
        });
    }
}
PushNotification = new PushNotification();
module.exports = PushNotification;
