var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('express-flash');
var nodemailer = require('nodemailer');
var async = require('async');
var crypto = require('crypto');
var User = require('./routes/userModel');

    // Passport Local Strategy

passport.use(new LocalStrategy(function (username, password, done) {
  User.findOne({ username: username }, function (err, user) {
    if (err) return done(err);
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    user.comparePassword(password, function (err, isMatch) {
      if (isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect password.' });
      }
    });
  });
}));

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

    // Connecting To Mongo (mLab)

mongoose.connect('mongodb://hxnain619:hxn6190@ds125502.mlab.com:25502/server-mongodb', { useNewUrlParser: true }, (err, data) => {
  if (err) {
    console.log(err.message);
  } else{
  console.log("Connected To Mongo!!");
  }
});

var app = express();

// ********************* Middleware ************

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({ secret: 'session secret key' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

// ************ Routes  *****************
          // Home Page

app.get('/', function (req, res) {
  res.render('index', {
    title: 'Express',
    user: req.user
  });
});

      // Login Page Render

app.get('/login', function (req, res) {
  res.render('login', {
    title: 'Express',
    user: req.user
  });
});

    // Login or Sign In

app.post('/login', function (req, res, next) {
  passport.authenticate('local', function (err, user, info) {
    if (err) return next(err)
    if (!user) {
      req.flash('error',`User Not Found With Name , ${req.body.username}`);
      return res.redirect('/login')
    }
    req.logIn(user, function (err) {
      if (err) {
        req.flash('error', "Can't Log In")
        return next(err);
       }
      req.flash('success', "You are Logged In !!");
      return res.redirect('/');
    });
  })(req, res, next);
});

    // SignUp Page Render

app.get('/signup', function (req, res) {
  res.render('signup', {
    title: 'Express',
    user: req.user
  });
});

    // SignUp , Create Account

app.post('/signup', function (req, res) {
  var user = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  });

  user.save(function (err) {
    req.logIn(user, function (err) {
      req.flash('success', `Hi!!,  ${(user.username).toUpperCase()} you have successfully created your UpUpManga Account`);
      res.redirect('/');
    });
  });
});

  // LogOut 

app.get('/logout', function (req, res) {
  req.logout();
  req.flash('info','You are logged out Successfully!!');
  res.redirect('/');
});

    // Forgot Pass 

app.get('/forgot', function (req, res) {
  res.render('forgot', {
    title: 'Express',
    user: req.user
  });
});
app.post('/forgot', function (req, res, next) {
  async.waterfall([
    function (done) {
      crypto.randomBytes(20, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({ email: req.body.email }, function (err, user) {

        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        console.log(user);
        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      let transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          // Add Your Credentials
            user: 'hxan619@gmail.com',
            pass: 'Reymysterio^!(0'
        },
        tls: {
              rejectUnauthorized: false
          }
    });
      var mailOptions = {
        to: user.email,
        //  Change from mail to yours 
        from: 'hxan619@gmail.com',
        subject: 'UpUpManga Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      transport.sendMail(mailOptions, function (err) {
        req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function (err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

      //   to Send Reset Link

app.get('/reset/:token', function (req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {
      title: 'Express',
      user: req.user
    });
  });
});

      // To Reset / Update PAssword

app.post('/reset/:token', function (req, res) {
  async.waterfall([
    function (done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function (err) {
          req.logIn(user, function (err) {
            done(err, user);
          });
        });
      });
    },
    function (user, done) {
      let transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          // Add Your Credentials
            user: 'hxan619@gmail.com',
            pass: 'Reymysterio^!(0'
        },
        tls: {
              rejectUnauthorized: false
          }
      });
      var mailOptions = {
        to: user.email,
        //  Change from mail to yours 
        from: 'hxan619@gmail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation message that the password for your UpUpManga account ' + user.email + ' has just been changed.\n'
      };
      transport.sendMail(mailOptions, function (err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function (err) {
    res.redirect('/');
  });
});


// ************* App Post ************

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});