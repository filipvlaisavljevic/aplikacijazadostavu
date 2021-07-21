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

const redirectLogin = (req,res,next) => {
    if(!req.session.userID){
        res.redirect('/login');
    }else{
        if(req.session.role != 3 || req.session.userID != req.params.id)
            res.redirect('/');
        next();
    }
}

var gotovenarudzbe = [];
var aktivnenarudzbe = [];

var db = {
    getZavrseneNarudzbe: function(req,res,next){
        gotovenarudzbe = [];
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                console.info('Broj narudzbi : ' + gotovenarudzbe.length);
                client.query('SELECT r.naziv_restorana as restoran,narudzbe.id as nid,narudzbe.zeljeno_vrijeme as zeljenovrijeme,narudzbe.status as marker,a.naziv_ulice as ulica,narudzbe.id,datum_narudzbe::timestamp WITHOUT TIME ZONE,ukupna_cijena,k.ime as kime ,\n' +
                    '       k.prezime as kprezime FROM narudzbe INNER JOIN korisnik k on narudzbe.dostavljac = k.id\n' +
                    '                 INNER JOIN adresa a on narudzbe.adresa = a.id  INNER JOIN restoran r ON r.id = narudzbe.restoran WHERE je_zavrsena = true AND dostavljac = $1;',
                    [req.params.id],function(err,result){
                    if(err){
                        next();
                    }
                        if(result.rows[0]){
                            console.info('Broj narudzbi : ' + gotovenarudzbe.length);
                            req.gotovenarudzbe = result.rows;
                            for(let i=0;i<req.gotovenarudzbe.length;++i){
                                console.info('ID NARUDZBE: '+ req.gotovenarudzbe[i].id);
                                client.query('SELECT p.ime_proizvoda as proizvod,kolicina,p.cijena_proizvoda as cijenap FROM detalji_narudzbe INNER JOIN proizvod p ON p.id = detalji_narudzbe.id_proizvoda  WHERE id_narudzbe = $1;',
                                    [req.gotovenarudzbe[i].id],function(err,resultt){
                                        if(resultt.rows[0])
                                            gotovenarudzbe.push(resultt.rows);
                                    });
                            }next();
                        }else{
                            next();
                        }
                    });
            }done();
        });
    },
    getAktivneNarudzbe: function(req,res,next){
        aktivnenarudzbe = [];
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                console.info('Broj narudzbi : ' + aktivnenarudzbe.length);
                client.query('SELECT narudzbe.telefon as telefon,r.naziv_restorana as restoran,narudzbe.id as nid,narudzbe.zeljeno_vrijeme as zeljenovrijeme,narudzbe.status\n' +
                    '    as marker,a.naziv_ulice as ulica,narudzbe.id,datum_narudzbe::timestamp WITHOUT TIME ZONE,ukupna_cijena,k.ime\n' +
                    '        as kime ,k.prezime as kprezime,r.naziv_restorana as restoran FROM narudzbe INNER JOIN korisnik k on narudzbe.dostavljac = k.id\n' +
                    ' INNER JOIN restoran r on narudzbe.restoran = r.id INNER JOIN adresa a on narudzbe.adresa = a.id  WHERE je_zavrsena = false AND dostavljac = $1;',
                    [req.params.id],function(err,result){
                    if(err){
                        next();
                    }
                        if(result.rows){
                            console.info('Broj narudzbi : ' + gotovenarudzbe.length);
                            req.aktivnenarudzbe = result.rows;
                            for(let i=0;i<req.aktivnenarudzbe.length;++i){
                                client.query('SELECT p.ime_proizvoda as proizvod,kolicina,p.cijena_proizvoda as cijenap FROM detalji_narudzbe INNER JOIN proizvod p ON p.id = detalji_narudzbe.id_proizvoda  WHERE id_narudzbe = $1;',
                                    [req.aktivnenarudzbe[i].id],function(err,resultt){
                                        if(resultt.rows[0])
                                           aktivnenarudzbe.push(resultt.rows);
                                    });
                            }next();
                        }else{
                            next();
                        }
                    });
            }done();
        });
    },
    krenuoPoNarudzbu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET status = 1 WHERE id = $1;',[req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    dostavljamNarudzbu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET status = 2 WHERE id = $1;',[req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    dostavljenaNarudzba: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET status = 3,je_zavrsena = true WHERE id = $1;',[req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    getLokali: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT restoran.id,naziv_restorana,kategorija,slika,a.naziv_ulice AS nazivulice,k.ime AS kime,k.prezime AS kprezime FROM restoran ' +
                    ' INNER JOIN korisnik k ON restoran.vlasnik = k.id INNER JOIN adresa a ON restoran.adresa = a.id WHERE restoran.active = 1;',
                    [],function(err,result){
                        req.svirestorani = result.rows;
                        next();
                    });
            }done();
        });
    },
    dajOtkaz: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE restoran_dostavljac SET active = false WHERE id_restorana = $1 and id_dostavljaca = $2;',[req.body.izbor_restorana,req.params.dostavljac],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    zaposliMe: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('INSERT INTO restoran_dostavljac(id_dostavljaca,id_restorana) VALUES($1,$2)',[req.params.dostavljac,req.body.restoran_izbor],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    getGdjeRadim: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT r.id,r.naziv_restorana FROM restoran_dostavljac INNER JOIN restoran r on restoran_dostavljac.id_restorana = r.id WHERE id_dostavljaca = $1 and restoran_dostavljac.active = true;',
                    [req.params.id],function(err,result){
                        req.gdjeradim = result.rows;
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

var idRacuna = '_' + Math.random().toString(36).substr(2, 9);

/* GET users listing. */
router.get('/:id',redirectLogin,db.getNotifikacije,db.getZavrseneNarudzbe,db.getAktivneNarudzbe,db.getLokali,db.getGdjeRadim, function(req, res, next) {
    res.render('dostavljac',{infog:gotovenarudzbe,gotovenarudzbee:req.gotovenarudzbe,racun:idRacuna,info:aktivnenarudzbe,aktivnenarudzbee:req.aktivnenarudzbe,sesija:res.locals.sesija,svirestorani:req.svirestorani,gdjeradim:req.gdjeradim,notifikacije:req.notifikacije});
});

router.post('/krenuoponarudzbu/:id',db.krenuoPoNarudzbu,function(req,res,next){
    res.redirect('back');
});

router.post('/dostavljamnarudzbu/:id',db.dostavljamNarudzbu,function(req,res,next){
    res.redirect('back');
});

router.post('/dostavljenanarudzba/:id',db.dostavljenaNarudzba,function(req,res,next){
    res.redirect('back');
});

router.post('/dajotkaz/:dostavljac',db.dajOtkaz,function(req,res,next){
    res.redirect('back');
});

router.post('/zaposlime/:dostavljac',db.zaposliMe,function(req,res,next){
   res.redirect('back');
});

module.exports = router;
