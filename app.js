var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var expressLayouts = require('express-ejs-layouts');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var restoranRouter = require('./routes/restoran');
var profilRouter = require('./routes/profil');
var manageRouter = require('./routes/manage');
var admindostaveRouter = require('./routes/admindostave');
var editrestoranRouter = require('./routes/editrestoran');
var dostavljacRouter = require('./routes/dostavljac');
var korpaRouter = require('./routes/korpa');
var supportRouter = require('./routes/support');
var flash = require('req-flash');
var cors = require('cors')
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set("layout login", false);
app.set("layout register", false);


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.use(cors());
// POČETAK SESIJA

const TWO_HOURS = 1000 * 60 * 60 ;  // -> Dva sata, milisekunde

var {
  SESS_LIFETIME = TWO_HOURS,
  SESS_NAME = 'sid',
  SESS_SECRET = 'keyboard cat'
} = process.env;

app.use(session({
  secret: SESS_SECRET,
  resave: false,
  name: SESS_NAME,
  saveUninitialized: false,
  cookie: {
    maxAge: TWO_HOURS,
    sameSite: true
  }
}));
app.use(flash());

// KRAJ SESIJA

app.use(function(req, res, next){
  res.locals.sesija = req.session;
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/restoran',restoranRouter);
app.use('/profil',profilRouter);
app.use('/manage',manageRouter);
app.use('/editrestoran',editrestoranRouter);
app.use('/admindostave',admindostaveRouter);
app.use('/dostavljac',dostavljacRouter);
app.use('/korpa',korpaRouter);
app.use('/support',supportRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.redirect('/');
});

module.exports = process.env;
module.exports = app;
