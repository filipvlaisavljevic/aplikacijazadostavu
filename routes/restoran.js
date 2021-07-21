var express = require('express');
var router = express.Router();
var session = require('express-session');
var pg = require('pg');
var mapquest = require('mapquest');
var session = require('express-session');
var imgur = require('imgur');

var prviput = true;

imgur.setClientId('cf4eec8420f4be9');

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

var config = {
    user:'postgres',
    database:'postgres',
    password:'admin',
    host:'localhost',
    port:5432,
    max:100,
    idleTimeoutMillis: 30000
}
var pool = new pg.Pool(config);
// API ZA GEOCODING ADRESE
process.env.MAPQUEST_API_KEY = 'n4edXxOu26XAjeXgn9NLWGIyS40TlGm2';

var db = {
    getRestoran: function(req,res,next){
        pool.connect(function(err,client,done){
           if(err){
               console.info('Došlo je do greške prilikom povezivanja na bazu podataka.');
           } else{
               client.query('SELECT restoran.id as rid,naziv_restorana,kategorija,a.naziv_ulice,a.latituda,a.longituda,k.ime,k.prezime,k.email,slika,radnovrijeme,udaljenostdostave FROM restoran' +
                   ' INNER JOIN korisnik k ON vlasnik = k.id INNER JOIN adresa a ON restoran.adresa = a.id' +
                   ' WHERE restoran.active = 1 AND restoran.id = $1;',[req.params.idRestorana],function(err,result){
                  if(result.rows.length>0){
                      req.restoran = result.rows[0];
                  }
                  next();
               });
           }done();
        });
    },
    getKategorije: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT  id,ime_kategorije FROM restoran_kategorija WHERE id_restorana = $1 or id_restorana = -1 and active = 1;',[req.params.idRestorana],function(err,result){
                if(result.rows.length>0){
                    console.info(result.rows);
                    req.kategorije = result.rows;
                }
                next();
                done();
            })
        });
    },
    getProizvodi: function(req,res,next){
        pool.connect(function(err,client,done){
           client.query('SELECT id,ime_proizvoda,cijena_proizvoda,stara_cijena,kategorija,opis,slika FROM proizvod WHERE (id_restorana = $1 or id_restorana = -1) and active = 1;',[req.params.idRestorana],function(err,result){
                if(result.rows){
                    req.proizvodi = result.rows;
                }
                next();
                done();
           });
        });
    },
    getGrupniProizvodi: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT * FROM grupni_meni WHERE id_restorana = $1 and active = 1;',[req.params.idRestorana],function(err,result){
                if(result.rows){
                    req.grupnimeni = result.rows;
                }
                next();
                done();
            });
        });
    },
    dodajProizvodPrviPut: function(req,res,next){
        console.info('prvi put');
        pool.connect(function(err,client,done){
            if(!req.session.korpa){
                client.query('INSERT INTO narudzbe(adresa,restoran,korisnik) VALUES($1,$2,$3);',[req.ulica[0].id,req.params.restoran,req.session.userID],function(err,result){
                    next();
                });
            }else next();
        });
    },
    dodajProizvodDrugiPut: function(req,res,next){
        console.info('dr put');
        if(req.session.korpa) {
        pool.connect(function(err,client,done){
            client.query('INSERT INTO detalji_narudzbe(id_narudzbe,id_proizvoda,kolicina) VALUES ($1,$2,$3)',[req.session.korpa,req.params.id,req.body.quantity],function(err,resultt){
                next();
            });
        });}else next();
    },
    getAdresa: function(req,res,next){
        console.info('adresa');
        pool.connect(function(err,client,done){
            client.query('SELECT a.id FROM korisnik INNER JOIN adresa a on a.id = korisnik.adresa WHERE korisnik.id = $1;',[req.session.userID],function(err,result){
               req.ulica = result.rows;
               next();
            });
        });
    },
    getIDNarudzbe: function(req,res,next){
        console.info('id narudzbe');
        pool.connect(function(err,client,done){
            client.query('SELECT * FROM narudzbe WHERE adresa = $1 and je_zavrsena = false;',[req.ulica[0].id],function(err,result){
                req.idnarudzbe = result.rows;
                if(!req.session.korpa) {
                    req.session.korpa = req.idnarudzbe[0].id;
                    client.query('INSERT INTO detalji_narudzbe(id_narudzbe,id_proizvoda,kolicina VALUES($1,$2,$3);',[req.session.korpa,req.params.id,1],function(err,resultt){
                        next();
                    });
                }else next();
            });
        });
    },
    updateCijena: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT sum(cijena_proizvoda*kolicina) FROM detalji_narudzbe INNER JOIN proizvod p ON p.id = id_proizvoda WHERE id_narudzbe = $1;',[req.session.korpa],function(err,result){
                req.cijena = result.rows[0].sum;
                client.query('UPDATE narudzbe SET ukupna_cijena = $1 WHERE id = $2;',[req.cijena,req.session.korpa],function(err,resultt){
                    console.info(req.session.korpa);
                    console.info('test');
                    next();
                });
            });
        });
    },
    getOcjena: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT avg(ocjena) as prosjek FROM recenzija WHERE id_restorana=$1;',[req.params.idRestorana],function(err,result){
                if(result.rows[0].prosjek){
                    req.recenzija = result.rows[0].prosjek;
                    console.info(req.recenzija);
                    next();
                }else{
                    req.recenzija = 5;
                    console.info('AAA'+req.recenzija);
                    next();
                }
                next();
            });
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

/* GET users listing. */
router.get('/:idRestorana', redirectLogin,db.getNotifikacije,db.getRestoran,db.getKategorije,db.getProizvodi,db.getGrupniProizvodi,db.getOcjena,function(req, res, next) {
    res.render('restoran',{restoran:req.restoran,kategorije:req.kategorije,proizvodi:req.proizvodi,grupnimeni:req.grupnimeni,ocjena:req.recenzija,notifikacije:req.notifikacije});
});

router.post('/upload',function(req,res,next){
    imgur.uploadFile(req.body.slika);
    res.sendStatus(200);
});

router.post('/dodaj/:id/:restoran',db.getAdresa,db.dodajProizvodPrviPut,db.getIDNarudzbe,db.dodajProizvodDrugiPut,db.updateCijena,function(req,res,next){
    res.redirect('back');
});

module.exports = router;
