const passport = require("passport"),
  JwtStrategy = require("passport-jwt").Strategy,
  ExtractJwt = require("passport-jwt").ExtractJwt,
  dotenv = require("dotenv").config(),
  User = require("../app/models/user"),
  AdminUser = require("../app/models/adminUser"),
  LoginController = require("../app/controllers/loginController"),
  __ = require("./globalFunctions");

ExtractJwt.fromAuthHeaderAsBearerToken();
const opts = {
  Strategy: "local",
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.API_KEY,
};

passport.use(
  new JwtStrategy(opts, (jwtPayload, done) => {
    // SUPER ADMIN APIs
    if (
      jwtPayload.flexiController &&
      jwtPayload.flexiController == "superadmin"
    ) {
      AdminUser.findOne({
        _id: jwtPayload.id,
        role: jwtPayload.role,
        status: 1,
      })
        .then((user) => {
          __.log(user);
          if (!user) {
            return done(null, false);
          } else if (!user.role) return done(null, false);
          else {
            return done(null, user);
          }
        })
        .catch((err) => {
          return done(err, false);
        });

      //  OTHER APIs
    } else {
      User.findOne({
        _id: jwtPayload.id,
        tokenList: {
          $in: [jwtPayload.tokenId],
        },
        status: 1,
      })
        .populate([
          {
            path: "role",
            select: "name description isFlexiStaff privileges",
            populate: {
              path: "privileges",
              select: "name description privilegeCategoryId",
              populate: {
                path: "privilegeCategoryId",
                select: "name",
              },
            },
          },
          {
            path: "schemeId",
            select: "shiftSchemeType",
          },
          {
            path: "companyId",
            select: "name logo",
          },
        ])
        .then(async (user) => {
          if (!user) {
            return done(null, false);
          } else if (!user.role) return done(null, false);
          else {
            // Current Device
            user.tokenId = jwtPayload.tokenId;
            user.company = user.companyId;
            user.companyId = user.companyId._id;
            // Restrict for Push
            let req = {
              user: user,
              body: {
                internalRes: true,
              },
            };
            let checkPwdDuration = await LoginController.pwdChangeDuration(req);
            user.pwdDurationStatus = checkPwdDuration.status;
            // All bu access
            user.allBUAccess = user.allBUAccess || 0;

            // Staff
            user.isFlexiStaff = user.role.isFlexiStaff;

            return done(null, user);
          }
        })
        .catch((err) => {
          return done(err, false);
        });
    }
  })
);
