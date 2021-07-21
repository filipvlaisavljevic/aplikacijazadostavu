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

var narudzbe = [];
var gotovenarudzbe = [];

var db = {
    getTrenutneNarudzbe: function(req,res,next){
        console.info('dosao do ovdje 3');
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT narudzbe.id as nid,narudzbe.zeljeno_vrijeme as zeljenovrijeme,narudzbe.status as marker,a.naziv_ulice as ulica,narudzbe.id,datum_narudzbe::timestamp WITHOUT TIME ZONE,ukupna_cijena,k.ime as kime ,k.prezime as kprezime,r.naziv_restorana as restoran FROM narudzbe INNER JOIN korisnik k on narudzbe.dostavljac = k.id\n' +
                    '    INNER JOIN restoran r on narudzbe.restoran = r.id  INNER JOIN adresa a on narudzbe.adresa = a.id WHERE je_zavrsena = false;',
                    [],function(err,result){
                        if(result.rows[0]){
                            req.trenutnenarudzbe = result.rows;
                            narudzbe.splice(0,narudzbe.length);
                            for(let i=0;i<req.trenutnenarudzbe.length;++i){
                                    client.query('SELECT p.ime_proizvoda as proizvod,kolicina,p.cijena_proizvoda as cijenap FROM detalji_narudzbe INNER JOIN proizvod p ON p.id = detalji_narudzbe.id_proizvoda WHERE id_narudzbe = $1;',
                                        [req.trenutnenarudzbe[i].id],function(err,resultt){
                                            if(resultt.rows[0])
                                                narudzbe.push(resultt.rows);
                                            console.info('Broj narudzbi : ' + narudzbe.length);

                                        });
                            }next();
                        }else{
                            next();
                        }
                    });
            }done();
        });
    },
    getZavrseneNarudzbe: function(req,res,next){
        console.info('dosao do ovdje 4');
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT narudzbe.id as nid,narudzbe.zeljeno_vrijeme as zeljenovrijeme,narudzbe.status as marker,a.naziv_ulice as ulica,narudzbe.id,datum_narudzbe::timestamp WITHOUT TIME ZONE,ukupna_cijena,k.ime as kime ,k.prezime as kprezime,r.naziv_restorana as restoran FROM narudzbe INNER JOIN korisnik k on narudzbe.dostavljac = k.id\n' +
                    '    INNER JOIN restoran r on narudzbe.restoran = r.id INNER JOIN adresa a on narudzbe.adresa = a.id  WHERE je_zavrsena = true;',
                    [],function(err,result){
                        if(result.rows){
                            req.gotovenarudzbe = result.rows;
                            for(let i=0;i<req.gotovenarudzbe.length;++i){
                                client.query('SELECT p.ime_proizvoda as proizvod,kolicina,p.cijena_proizvoda as cijenap FROM detalji_narudzbe INNER JOIN proizvod p ON p.id = detalji_narudzbe.id_proizvoda  WHERE id_narudzbe = $1;',
                                    [req.gotovenarudzbe[i].id],function(err,resultt){
                                        if(resultt.rows)
                                            gotovenarudzbe.push(resultt.rows);
                                        console.info('Broj narudzbiZZ : ' + gotovenarudzbe.length);

                                    });
                            }next();
                        }else next();
                    });
            }done();
        });
    },
    getSlobodniDostavljaci: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('SELECT korisnik.id as kid,korisnik.ime as kime,korisnik.prezime as kprezime FROM korisnik WHERE role = 3;',[],function(err,result){
                    if(err){
                        console.info('Nisam uspio');
                        next();
                    }else{
                        if(result.rows){
                            req.slobodnidostavljaci = result.rows;
                            console.info('DOSTAO');
                            console.info(req.slobodnidostavljaci[0].kime);
                            next();
                        }else next();
                    }
                });
                done();
            }
        })
    },
    postaviDostavljaca: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET dostavljac = $1 WHERE id=$2;',[req.body.novidostavljac,req.params.id],function(err,result){
                    if(err){
                        console.info('Nisam uspio');
                        next();
                    }else{
                        next();
                    }
                });
                done();
            }
        })
    },
    updateNotifikacije: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET vidjena = true;',[],function(err,result){
                    next();
                });
                done();
            }
        })
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
        if(req.session.role != 1)
            res.redirect('/');
        next();
    }
}

/* GET users listing. */
router.get('/', redirectLogin,db.updateNotifikacije,db.getNotifikacije,db.getTrenutneNarudzbe,db.getZavrseneNarudzbe,db.getSlobodniDostavljaci,function(req, res, next) {
    res.render('admindostave',{trenutnenarudzbe: req.trenutnenarudzbe,info:narudzbe,gotovenarudzbe:req.gotovenarudzbe,infog:gotovenarudzbe,dostavljaci:req.slobodnidostavljaci,notifikacije:req.notifikacije});
    gotovenarudzbe = [];
    narudzbe = [];
});

router.post('/postavidostavljaca/:id',db.postaviDostavljaca,function(req,res,next){
    res.redirect('back');
});

module.exports = router;
