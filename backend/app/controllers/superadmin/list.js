const mongoose = require('mongoose'),
Schema = mongoose.Schema;
AdminUser = require('../../models/adminUser');

class SuperAdminListController {
    async getList(req, res) {
        try{
            let adminUser = await AdminUser
            .find(null, 'name userName', (err,data)=>{
                if(err){
                    return __.out(res, 500);
                }
                return __.out(res, 200, data);
            });
        } catch (err) {
            __.log(err);
            return __.out(res, 500);
        }
    }
 
};

superAdminListController = new SuperAdminListController();
module.exports = superAdminListController;
