var express = require('express');
var router = express.Router();
var mapquest = require('mapquest');
var pg = require('pg');
var session = require('express-session');
const bcrypt = require('bcrypt');

var config = {
    user:'postgres',
    database:'postgres',
    password:'admin',
    host:'localhost',
    port:5432,
    max:100,
    idleTimeoutMillis: 30000
}

// API ZA GEOCODING ADRESE
process.env.MAPQUEST_API_KEY = 'n4edXxOu26XAjeXgn9NLWGIyS40TlGm2';
const saltRounds = 10;

var pool = new pg.Pool(config);

var db = {
    getKorisnik: function(req,res,next){
        pool.connect(function(err,client,done){
           if(err){
               console.info('Nisam se uspio spojiti na bazu.');
           } else{
               client.query('SELECT k.ime,k.prezime,k.username,k.email,a.naziv_ulice,a.latituda,a.longituda,r.naziv as rank FROM' +
                   ' korisnik k INNER JOIN adresa a ON k.adresa = a.id ' +
                   ' INNER JOIN role r ON k.role = r.id WHERE k.id = $1;',[req.session.userID],function(err,result){
                  if(err){
                      console.info('Nisam uspio dobiti korisnika.');
                  } else{
                      req.korisnik = result.rows[0];
                      next();
                  }
               });
           }done();
        });
    },
    changeEmail: function(req,res,next){
        if(req.postoji != 1){
            pool.connect(function(err,client,done){
                if(err){
                    console.info('Greška prilikom spajanja na bazu.');
                }else{
                    client.query('UPDATE korisnik SET email = $1 WHERE id = $2;',[req.params.mail,req.session.userID],function(err,result){
                        if(err){
                            console.info('Nisam uspio promijeniti email.');
                        } else{
                            req.flash('promjena','Email uspješno promjenjen!');
                            done();
                        }next();
                    });
                }
            });
        }else{
            next();
        }
    },
    postojiEmail: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu.');
            }else{
                client.query('SELECT * FROM korisnik WHERE email = $1;',[req.params.mail],function(err,result){
                    if(err){
                        console.info('Nisam uspio promijeniti email.');
                    } else{
                        if(result.rows[0]) {
                            req.postoji = 1;
                            req.flash('poruka','Email je već u upotrebi!');
                            next();
                        }else{
                            req.postoji = 0;
                            next();
                        }
                        done();
                    }
                });
            }
        });
    },
    changePw: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu.');
            }else{
                bcrypt.genSalt(saltRounds, function(err, salt) {
                    bcrypt.hash(req.params.password, salt, function(err, hash) {
                        // OBRADJEN PASSWORD
                        req.params.password = hash;
                        client.query('UPDATE korisnik SET password = $1 WHERE id = $2;',[req.params.password,req.session.userID],function(err,result){
                            if(err){
                                console.info('Nisam uspio promijeniti email.');
                            } else{
                                req.flash('poruka','Lozinka uspješno promjenjena!');
                                next();
                                done();
                            }
                        });
                    });
                });
            }
        });
    },
    obradiAdresu: function(req,res,next){
        pool.connect(function(err,client,done){
           if(err){
               console.info('Ne mogu se povezati na bazu podataka.');
           } else{
               var zaObradu = req.params.adresa + ' Sarajevo';
               mapquest.geocode({ address: zaObradu }, function(err, location) {
                   client.query('INSERT INTO adresa (naziv_ulice,latituda,longituda) VALUES ($1,$2,$3);',[req.params.adresa,location.latLng.lat,location.latLng.lng],
                       function(err,rezultat){
                            if(err){
                                console.info('Nisam uspio update adresu.');
                            }else{
                                req.nova_adresa = location;
                                next();
                            }
                       });
               });
           }
        });
    },
    getIDUlice: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT id FROM adresa WHERE naziv_ulice = $1;',
                    [req.params.adresa],function(err,result){
                        req.id_ulice = result.rows[0].id;
                        next();
                    });
            }done();
        });
    },
    updateUlica: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('UPDATE korisnik SET adresa = $1 WHERE id = $2;',
                    [req.id_ulice,req.session.userID],function(err,result){
                        req.flash('adresa','Adresa uspješno promjenjena');
                        next();
                    });
            }done();
        });
    },
    getDostave: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT r.naziv_restorana as restoran,ukupna_cijena,telefon,zeljeno_vrijeme FROM narudzbe INNER JOIN restoran r ON narudzbe.restoran = r.id WHERE korisnik = $1;',
                    [req.session.userID],function(err,result){
                        if(result.rows)
                            req.historija = result.rows;
                        next();
                    });
            }done();
        });
    },
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

const redirectLogin = (req,res,next) => {
    if(!req.session.userID){
        res.redirect('/login');
    }else{
        next();
    }
}

/* GET users listing. */
router.get('/', redirectLogin,db.getNotifikacije,db.getKorisnik,db.getDostave,function(req, res, next) {
    res.render('profil',{korisnik:req.korisnik,sesija:req.session,idrestorana:req.idrestorana,historija:req.historija,notifikacije:req.notifikacije});
});

router.get('/promjenaEmaila/:mail',db.postojiEmail,db.changeEmail,db.getKorisnik,function(req,res,next){
    let objekat = {
        email: req.korisnik.email,
        poruka: req.flash('poruka'),
        promjenamail: req.flash('promjena')
    }
    res.send(objekat);
});

router.get('/promjenaLozinke/:password',db.changePw,function(req,res,next){
    let p = {
        poruka: req.flash('poruka'),
    }
    res.send(p);
});

router.get('/promjenaAdrese/:adresa',db.obradiAdresu,db.getIDUlice,db.updateUlica,function(req,res,next){
   let rez = {
       rezp: req.flash('adresa'),
       objekat_ulica: req.nova_adresa
   }
   res.send(rez);
});

module.exports = router;
