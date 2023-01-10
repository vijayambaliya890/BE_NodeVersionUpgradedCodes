const path = require('path'),
  multer = require('multer'),
  mongoose = require('mongoose');
const encript = (secrete) => {
  const salt = process.env.API_KEY;
  const textToChars = (text) => text.split('').map((c) => c.charCodeAt(0));
  const byteHex = (n) => ('0' + Number(n).toString(16)).substr(-2);
  const applySaltToChar = (code) =>
    textToChars(salt).reduce((a, b) => a ^ b, code);
  return `${secrete}`
    .split('')
    .map(textToChars)
    .map(applySaltToChar)
    .map(byteHex)
    .join('');
};

const toTitleCase = (str) =>
  str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
  );

const isEmail = (email) =>
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(
    email,
  );
const isEqualObjectIds = (o1, o2) => {
  return mongoose.Types.ObjectId(o1).equals(mongoose.Types.ObjectId(o2));
};

const mkArr = (data) => {
  return Array.isArray(data) ? data : [data];
};

const decript = (encodedSecrete) => {
  const salt = process.env.API_KEY;
  const textToChars = (text) => text.split('').map((c) => c.charCodeAt(0));
  const applySaltToChar = (code) =>
    textToChars(salt).reduce((a, b) => a ^ b, code);
  return encodedSecrete
    .match(/.{1,2}/g)
    .map((hex) => parseInt(hex, 16))
    .map(applySaltToChar)
    .map((charCode) => String.fromCharCode(charCode))
    .join('');
};

const generatePassword = (length) => {
  let result = '';
  const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

const upload = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3) ? 'public/uploads/files' : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadEmoji = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3)
      ? 'public/uploads/emojis'
      : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadChallengeIcon = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3)
      ? 'public/uploads/challenge'
      : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadContentFiles = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3)
      ? 'public/uploads/notificationAttachment'
      : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadWallFiles = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3) ? 'public/uploads/wall' : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadBadge = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3)
      ? 'public/uploads/challenge/badges'
      : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadPostFiles = multer({
  storage: multer.diskStorage({
    destination: !parseInt(process.env.ISS3) ? 'public/uploads/posts' : '/temp',
    filename: function (req, file, cb) {
      ////cnole.log(file);
      const start = Date.now();
      cb(null, `file${start}${path.extname(file.originalname)}`);
    },
  }),
});

const uploadFile = (req, res, next) => {
  try {
    if (!parseInt(process.env.ISS3)) {
      return next();
    }
    aws.config.setPromisesDependency();
    aws.config.update({
      accessKeyId: process.env.ACCESSKEYID,
      secretAccessKey: process.env.SECRETACCESSKEY,
      region: process.env.REGION,
    });
    const s3 = new aws.S3();
    const params = {
      ACL: 'public-read',
      Bucket: process.env.BUCKET_NAME,
      Body: fs.createReadStream(req.file.path),
      Key: `${req.file.originalname}`,
    };

    s3.upload(params, (err, data) => {
      if (err) {
        return res.error({
          message: 'Error occured while trying to upload to S3 bucket',
          error: err,
        });
      }

      if (data) {
        fs.unlinkSync(req.file.path); // Empty temp folder
        req.file.path = data.Location;
        return next();
      }
      return next();
    });
  } catch (error) {
    res.error(error);
  }
};

module.exports = {
  encript,
  toTitleCase,
  isEmail,
  isEqualObjectIds,
  decript,
  generatePassword,
  upload,
  uploadEmoji,
  uploadChallengeIcon,
  uploadFile,
  uploadPostFiles,
  uploadBadge,
  uploadWallFiles,
  uploadContentFiles,
};
