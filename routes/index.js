var express = require('express');
var router = express.Router();
var session = require('express-session');
var podaci = process.env;
var pg = require('pg');
var mapquest = require('mapquest');
const bcrypt = require('bcrypt');
const geolib = require('geolib');

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

  provjeraKorisnikaPoID: function (req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT * FROM korisnik WHERE id = $1 and active = 1;',[req.session.userID],function(err,result){
          if(err){
            console.info('Greška prilikom upita za korisnika.');
          }else{
            req.korisnik = result.rows;
            next();
          }
        });
      }done();
    });
  },

  korisnikLogin: function (req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT * FROM korisnik WHERE email = $1 and active = 1;',[req.body.email],function(err,result){
          if(err){
            console.info('Greška prilikom upita za korisnika.3');
          }else{
            if(result.rows.length>0){
              bcrypt.compare(req.body.password, result.rows[0].password, function(err, rezultat) {
                if(rezultat){
                  req.session.userID = result.rows[0].id;
                  req.session.role = result.rows[0].role;
                  next();
                }else{
                  req.flash('poruka','Pogrešan email ili password!');
                  res.redirect('/login');
                }
              });
            }else{
              req.flash('poruka','Pogrešan email ili password!');
              res.redirect('/login');
            }
          }done();
        });
      }
    });
  },

  korisnikRegistracija: function (req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        console.info('Heširan password u korisnikRegistracija: '+req.body.password);
        client.query('SELECT * FROM korisnik WHERE email = $1 OR username = $2 and active = 1;',[req.body.email,req.body.username],
            function(err,result){
          if(err){
            console.info('Greška prilikom upita za korisnika.');
          }else{
            if(result.rows.length>0){
              console.info(result.rows.length);
              req.flash('poruka', 'Korisnik već postoji. Napravite novi profil ili se logujte!');
              res.redirect('/login');
              done();
            }else{
              next();
              done();
            }
          }
        });
      }
    });
  },

  dodajKorisnika: function (req,res,next){
      pool.connect(function(err,client,done){
        if(err){
          console.info('Došlo je do greške prilikom spajanja na bazu.');
        }else{
          client.query('INSERT INTO korisnik (username,ime,prezime,email,adresa,password,role) VALUES ($1,$2,$3,$4,$5,$6,4);',
              [req.body.username,req.body.ime,req.body.prezime,req.body.email,req.id_ulice,req.body.password]);
          client.query('SELECT id FROM korisnik WHERE username = $1;',
              [req.body.username],function(err,result){
                req.session.userID = result.rows[0].id;
                req.session.role = result.rows[0].role;
                res.redirect('/');
                next();
                done();
              });
        }
      });
  },
  dodajUlicu: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('INSERT INTO adresa (naziv_ulice,latituda,longituda) VALUES ($1,$2,$3);',
            [req.body.adresa,req.ulica_objekat.latLng.lat,req.ulica_objekat.latLng.lng]
           ,function(err,result){
              next();
            });
      }done();
    });
  },
  getKorisnikRole: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT r.naziv AS rn FROM korisnik INNER JOIN role r ON korisnik.role = r.id WHERE korisnik.id = $1;',
            [req.session.userID],function(err,result){
              req.rank = result.rows[0].rn;
              next();
            });
      }done();
    });
  },

  getKorisnikUlica: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT *  FROM korisnik INNER JOIN adresa a ON korisnik.adresa = a.id WHERE korisnik.id = $1;',
            [req.session.userID],function(err,result){
              req.ulica = result.rows[0];
              next();
            });
      }done();
    });
  },

  getIDUlice: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT id FROM adresa WHERE naziv_ulice = $1;',
            [req.body.adresa],function(err,result){
              req.id_ulice = result.rows[0].id;
              next();
            });
      }done();
    });
  },

  obradiAdresu: function(req,res,next){
    var zaObradu = req.body.adresa + ' Sarajevo';
    mapquest.geocode({ address: zaObradu }, function(err, location) {
      req.ulica_objekat = location;
      next();
    });
  },
  hashPassword: function(req,res,next){
    bcrypt.genSalt(saltRounds, function(err, salt) {
      bcrypt.hash(req.body.password, salt, function(err, hash) {
        // OBRADJEN PASSWORD
        req.body.password = hash;
        next();
      });
    });
  },
  getRestorani: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT restoran.preporucen as preporucen,restoran.id,naziv_restorana,udaljenostdostave,kategorija,slika,a.naziv_ulice AS nazivulice,a.latituda as latituda,a.longituda as longituda,k.ime AS kime,k.prezime AS kprezime FROM restoran ' +
            ' INNER JOIN korisnik k ON restoran.vlasnik = k.id INNER JOIN adresa a ON restoran.adresa = a.id WHERE restoran.active = 1;',
            [],function(err,result){
              if(req.session.role != 4) {
                req.restoran = result.rows;
                next();
              }
              else{
                var niz_restorana = [];
                for(let i=0;i<result.rows.length;++i){
                  console.info(dostupanRestoran(req.ulica.latituda,req.ulica.longituda,result.rows[i].latituda,result.rows[i].longituda) <= result.rows[i].udaljenostdostave);
                  if(dostupanRestoran(req.ulica.latituda,req.ulica.longituda,result.rows[i].latituda,result.rows[i].longituda) <= result.rows[i].udaljenostdostave){
                    niz_restorana.push(result.rows[i]);
                  }
                }
                req.restoran = niz_restorana;
                next();
              }
            });
      }done();
    });
  },
  postaviIDRestorana: function(req,res,next){
    if(req.session.role == 2){
      pool.connect(function(err,client,done){
        if(err){
          console.info('Došlo je do greške prilikom spajanja na bazu.');
        }else{
          client.query('SELECT id FROM restoran WHERE vlasnik = $1 and active = 1;',[req.session.userID],function(err,rezultat){
            if(rezultat.rows.length>0){
              console.info('ID: '+req.session.userID);
              console.info('RANK: '+req.session.role);
              req.session.rid = rezultat.rows[0].id;
              console.info('VLASNIK RESTORANA: '+req.session.rid);
              res.redirect('/');
              next();
            }else{
              res.redirect('/');
              next();
            }
          });
        }
      })
    }else{
      res.redirect('/');
      next();
    }
  },
  getInfo: function(req,res,next){
    console.info('stigao sam');
    pool.connect(function(err,client,done){
      if(err){
        console.info('Nisam se uspio spojiti na bazu.');
      } else{
        client.query('SELECT narudzbe.status as status,narudzbe.id as nid,p.id as pid,p.ime_proizvoda as ime_proizvoda,p.opis as opis,dn.kolicina as kolicina,datum_narudzbe,ukupna_cijena,potvrdjena FROM narudzbe INNER JOIN detalji_narudzbe dn\n' +
            ' ON dn.id_narudzbe = narudzbe.id INNER JOIN proizvod p ON p.id = dn.id_proizvoda\n' +
            ' WHERE narudzbe.id = $1;',[req.session.korpa],function(err,result){
          if(err){
            console.info('Nisam uspio dobiti korisnika.');
            next();
          } else{
            req.info = result.rows;
            console.info('Nisam uspiasdasdasdo dobiti korisnika.');
            next();
          }
        });
      }done();
    });
  },
  upisiRecenziju: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('INSERT INTO recenzija (id_korisnika,id_restorana,ocjena,opis) VALUES ($1,$2,$3,$4);',
            [req.session.userID,req.recenzijarestoran,req.body.star,req.body.recenzija]
            ,function(err,result){
              console.info(req.session.userID + 'ID SESIJE');
              console.info(req.recenzijarestoran+' ID RESTORANA');
              console.info(req.body.star + ' BROJ ZVJEZDICA');
              console.info(req.body.recenzija);
              next();
            });
      }done();
    });
  },
  getRecenzijaRestoran: function(req,res,next){
    pool.connect(function(err,client,done){
      if(err){
        console.info('Došlo je do greške prilikom spajanja na bazu.');
      }else{
        client.query('SELECT restoran FROM narudzbe WHERE id = $1;',
            [req.session.korpa]
            ,function(err,result){
              req.recenzijarestoran = result.rows[0].restoran;
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

const redirectHome = (req,res,next) =>{
  if(req.session.userID){
    res.redirect('/');
  }else{
    next();
  }
}

function dostupanRestoran(lat1,long1,lat2,long2){
  return parseInt(geolib.getDistance(
      { latitude: lat1, longitude: long1 },
      { latitude: lat2, longitude: long2 }
  )/1000);
}

router.get('/', db.getKorisnikUlica,db.getRestorani,db.getNotifikacije,
    function(req, res, next) {
  res.render('index',{sesija:res.locals.sesija,restoran:req.restoran,trenutnanarudzba: req.trenutnanarudzba,info:req.info,notifikacije: req.notifikacije});
});

router.get('/status', db.getInfo,
    function(req, res, next) {
      res.render('status',{sesija:res.locals.sesija,info:req.info});
    });

router.get('/login', redirectHome,
    function(req, res, next) {
  res.render('login',{layout:'login',poruka: req.flash('poruka')});
});

router.post('/status/recenzija',db.getRecenzijaRestoran,db.upisiRecenziju,function(req,res,next){
  req.session.korpa = null;
  req.session.potvrdjena = null;
  res.redirect('/');
});

router.get('/register', redirectHome,
    function(req, res, next) {
  res.render('register',{layout:'register'});
});

router.post('/login',redirectHome, db.korisnikLogin,db.postaviIDRestorana,
    function(req, res, next) {
});

router.post('/register', redirectHome,db.hashPassword,db.korisnikRegistracija,db.obradiAdresu,db.dodajUlicu,db.getIDUlice,db.dodajKorisnika,
    function(req, res, next) {
});

router.post('/logout', redirectLogin,
    function(req, res, next) {
  req.session.destroy(err =>{
    if(err){
      return res.redirect('/');
    }
    res.clearCookie('sid');
    res.redirect('/login');
  })
});

module.exports = router;
