const nodemailer = require('nodemailer'),
    os = require('os'),
    smtpTransport = require('nodemailer-smtp-transport'),
    hbs = require('nodemailer-express-handlebars'),
    __ = require('./globalFunctions');

const testEmail = false;
const testEmailId = 'janen@askpundit.com';

const adminEmail = process.env.ADMIN_EMAIL;


if (os.hostname().indexOf("doodlews-67") == 0 || os.hostname().indexOf("doodlews-88") == 0) /*localhost*/ {
    var serverType = 'LOCAL';
    var clientBaseUrl = process.env.LOCAL_CLIENT_BASEURL;
    var serverBaseUrl = process.env.LOCAL_SERVER_BASEURL;
} else if (os.hostname().indexOf("doodledev") == 0) /*staging*/ {
    var serverType = 'STAGING';
    var clientBaseUrl = process.env.STAGING_CLIENT_BASEURL;
    var serverBaseUrl = process.env.STAGING_SERVER_BASEURL;
} else /*live*/ {
    /*live hostname = 'ip-172-31-18-55'*/
    var serverType = 'LIVE';
    var clientBaseUrl = process.env.LIVE_CLIENT_BASEURL;
    var serverBaseUrl = process.env.LIVE_SERVER_BASEURL;
}

const transporter = nodemailer.createTransport((smtpTransport({
    service: 'Office365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
})));
// const transporter = nodemailer.createTransport((smtpTransport({
//     service: "gmail",
//     host: "smtp.gmail.com",
//     port: 587,
//     secure: true,
//     auth: {
//         user: process.env.NODEMAILER_EMAIL,
//         pass: process.env.NODEMAILER_PASSWORD
//     }
// })));

const options = {
    viewEngine: {
        extname: '.hbs',
        layoutsDir: '../public/email/',
    },
    viewPath: 'public/email/',
    extName: '.hbs'
};


class mail {
    feedback(userDoc) {
        /*to admin */
        var mailOptions = {
            /*for user */
            from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
            to: testEmail ? testEmailId : userDoc.adminEmail,
            subject: `MySATS+ | Feedback`,
            text: `Hi
                You have received feedback from the staff.
                
                Name :${userDoc.name},
                StaffId:${userDoc.staffId},
                Topic :${userDoc.topic},
                Message :${userDoc.message}`
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, false);
    };
    forgotPassword(userDoc) {
        let baseUrl = clientBaseUrl,
            context = {
                ...userDoc
            };
        userDoc.companyData.logo = serverBaseUrl + userDoc.companyData.logo;
        userDoc.companyData.url = clientBaseUrl + userDoc.companyData.pathName + "#!/";
        context.url = `${userDoc.companyData.url}set-password/${userDoc.emailToken}`;

        let mailOptions = {
            /*for user */
            from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
            to: userDoc.userEmail,
            subject: `MySATS+ | Password Reset`,
            template: 'resetpassword',
            context

        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, true);
    };

    newUser(userDoc) {

        let mailOptions = {
            /*for user */
            from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
            to: userDoc.email,
            subject: `MySATS+ | New User`,
            context: {
                ...userDoc
            },
            template: 'newuser'
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, true);
    };

    newCompanyUser(userDoc) {

        userDoc.companyData.logo = serverBaseUrl + "uploads/companyLogos/mysatsplus.png";
        userDoc.companyData.url = clientBaseUrl + userDoc.companyData.pathName + "#!/";

        let mailOptions = {
            /*for user */
            from: userDoc.companyData.name + `<${process.env.NODEMAILER_EMAIL}>`,
            to: userDoc.email,
            subject: `MySATS+ | New User`,
            context: {
                ...userDoc
            },
            template: 'newCompanyUser'
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, true);
    };


    userFeedback(userDoc) {

        /*to admin */
        var mailOptions = {
            /*for user */
            from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
            to: testEmail ? testEmailId : userDoc.email,
            subject: `MySATS+ | Feedback`,
            text: `Hi
            
            Message :${userDoc.feedback}`
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, false);
    };
    notificReminder(data) {

        if (data.companyData.logo.indexOf('http') == -1) {
            data.companyData.logo = serverBaseUrl + data.companyData.logo;
        }

        let mailOptions = {
            from: `${data.companyData.name} <${data.companyData.email}>`,
            to: data.userData.email,
            subject: `${data.companyData.name} | Notification Reminder`,
            context: {
                ...data
            },
            template: 'notificationReminder'
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }
        __.log(mailOptions, "mailOptions")
        this.send(mailOptions, true);
    };

    userFeedback(userDoc) {

        /*to admin */
        var mailOptions = {
            /*for user */
            from: `MySATS+ <${process.env.NODEMAILER_EMAIL}>`,
            to: testEmail ? testEmailId : userDoc.email,
            subject: `MySATS+ | Feedback`,
            text: `Hi,

            Name :${userDoc.name},
            Email :${userDoc.email},
            Phone :${userDoc.phone},
            Message :${userDoc.feedback}`
        };
        if (testEmail != true && serverType != 'LIVE') {
            mailOptions.bcc = testEmailId;
        }

        this.send(mailOptions, false);
    };


    send(mailOptions, withTemplate = false) {

        if (withTemplate)
            transporter.use('compile', hbs(options));

        transporter.sendMail(mailOptions).then((data) => {
            __.log('email sent');
            __.log(data);
        }).catch((err) => {
            __.log(err)
        });
    }
}

mail = new mail();
module.exports = mail;
