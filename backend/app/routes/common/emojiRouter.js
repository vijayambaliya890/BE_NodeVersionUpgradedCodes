let express = require('express'),
    EmojiRouter = express.Router(),
    EmojiControllers = require('../../controllers/common/emojiController'),
    passport = require('passport'),
    jwt = require('jsonwebtoken'),
    uuid = require('node-uuid'),
    multer = require('multer'),
    path = require('path'),





    storage = multer.diskStorage({
        destination: 'public/uploads/emojis',
        filename: function (req, file, cb) {
            cb(null, uuid.v4() + path.extname(file.originalname));
        }
    }),





    upload = multer({
        storage: storage
    });


// EmojiRouter.use(passport.authenticate('jwt', {
//     session: false
// }), /*Allow only admin*/
//     function (req, res, next) {
//         // No Restrictions, Allow flexistaff & Non flexistaff
//         next();

//     });


EmojiRouter.post('/uploadEmoji', upload.single('file'), (req, res) => {
    EmojiControllers.upload(req, res)
});

EmojiRouter.get('/getEmojis', (req, res) => {
    EmojiControllers.get(req, res)
});


EmojiRouter.post('/remove', (req, res) => {
    EmojiControllers.remove(req, res)
});

module.exports = EmojiRouter;