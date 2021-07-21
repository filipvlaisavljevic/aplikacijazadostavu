var express = require('express');
var router = express.Router();
var session = require('express-session');
var podaci = process.env;
var pg = require('pg');
var mapquest = require('mapquest');
const bcrypt = require('bcrypt');
const geolib = require('geolib');
var io = null;

var config = {
    user:'postgres',
    database:'postgres',
    password:'admin',
    host:'localhost',
    port:5432,
    max:100,
    idleTimeoutMillis: 30000
}

const redirectLogin = (req,res,next) => {
    if(!req.session.userID){
        res.redirect('/login');
    }else{
        next();
    }
}

var db = {
    getNotifikacije: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT count(*) as brojac FROM narudzbe WHERE vidjena = false;',
                    []
                    ,function(err,result){
                        req.notifikacije = result.rows[0].brojac;
                        next();
                    });
            }done();
        });
    }
}

var popunjena = false;
// API ZA GEOCODING ADRESE
process.env.MAPQUEST_API_KEY = 'n4edXxOu26XAjeXgn9NLWGIyS40TlGm2';

const saltRounds = 10;

var pool = new pg.Pool(config);
/* GET users listing. */
router.get('/', redirectLogin,db.getNotifikacije,function(req, res, next){
    if(popunjena && req.session.role != 1)
        res.send('Administrator trenutno nije dostupan. Molimo pokušajte kasnije!');
    if(!io)
        io = require('socket.io')(req.connection.server);
    io.once('connection', (socket) => {
        if(req.session.role == 1)
            io.emit('chat message', 'Administrator se priključio razgovoru.');
        if(req.session.role == 4)
        {popunjena = true;
            io.emit('chat message', 'Korisnik se priključio razgovoru.');
        }
        console.log('a user connected');
        socket.once('disconnect', () => {
            if(req.session.role == 1)
                io.emit('chat message', 'Administrator je izašao iz razgovora.');
            if(req.session.role != 1)
                io.emit('chat message', 'Korisnik je izašao iz razgovora.');
            console.log('user disconnected');
            popunjena = false;
        });
        socket.on('chat message', (msg) => {
            console.log('message: ' + msg);
            io.emit('chat message', (req.session.role==1?'Administrator':'Korisnik') + ': '  +msg);
        });
    });
    res.render('chat',{sesija:res.locals.sesija,notifikacije:req.notifikacije});
});

module.exports = router;
