const Emojis = require('../../models/emoji'), __ = require('../../../helpers/globalFunctions');

class Emoji {

    async upload(req, res) {
        try {
            if (!req.file)
                return __.out(res, 300, `No File is Uploaded`);

            const result = await __.scanFile(req.file.filename, `public/uploads/emojis/${req.file.filename}`);
            if (!!result) {
                return __.out(res, 300, result);
            }
            let insert = req.body;
            insert.companyId = req.user.companyId;
            insert.name = req.file.filename;
            insert.status = 1;
            insert.emoji = `uploads/emojis/${req.file.filename}`;
            let insertedDoc = await new Emojis(insert).save();
            if (!insertedDoc)
                 __.out(res, 300, 'Error while uploading Emoji');

             __.out(res, 201, 'Uploaded successfully!');
            //  const result = await __.scanFile(req.file.filename, `public/uploads/emojis/${req.file.filename}`);
            // if(!!result){
            //     //return __.out(res, 300, result);
            // }
        } catch (error) {
            __.log(error);
            return __.out(res, 500, error);
        };
    }

    async get(req, res) {
        try {
            let where = {
                companyId: req.user.companyId,
                status: {
                    $nin: [0, 3]
                }
            };
            let emojiData = await Emojis.find(where).select(' emoji _id name ').lean();
            if (!emojiData)
                return __.out(res, 300, 'Oops something went wrong');

            return __.out(res, 201, emojiData);
        } catch (error) {
            __.log(error);
            return __.out(res, 500, error);
        }
    }

    async remove(req, res) {
        try {
            // Check required fields
            let requiredResult = await __.checkRequiredFields(req, ['emojiId']);
            if (requiredResult.status == false) {
                return __.out(res, 400, requiredResult.missingFields);
            }

            var query = {
                _id: req.body.emojiId,
                status: {
                    $nin: [3]
                }
            },
                update = {
                    status: 3
                },
                options = {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                };

            let emojiData = await Emojis.findOneAndUpdate(query, update, options);
            if (!emojiData)
                return __.out(res, 300, 'Oops something went wrong');

            return __.out(res, 201, 'Removed Successfully');
        } catch (error) {
            __.log(error);
            return __.out(res, 500, error);
        }
    }
}

emoji = new Emoji();
module.exports = emoji;
