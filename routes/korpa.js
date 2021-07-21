var express = require('express');
var router = express.Router();
var mapquest = require('mapquest');
var pg = require('pg');
var session = require('express-session');
const bcrypt = require('bcrypt');
var nodemailer = require('nodemailer');

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
    posaljiEmail: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('SELECT email FROM korisnik WHERE id= $1;',[req.session.userID],function(err,result){
                    req.email = result.rows[0].email;
                    let transporter = nodemailer.createTransport({
                        host: 'smtp.gmail.com',
                        port: 587,
                        secure: false,
                        requireTLS: true,
                        auth: {
                            user: 'grizprojekat@gmail.com',
                            pass: 'Changeme1234@'
                        }
                    });

                    let mailOptions = {
                        from: 'grizprojekat@gmail.com',
                        to: req.email,
                        subject: 'GRIZ.BA - RAČUN DOSTAVE',
                        text: 'Vaša narudžba je uspješno zaprimljena. Pratite status narudžbe na našoj aplikaciji.'
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            return console.log(error.message);
                            next();
                        }
                        console.log('success emailed');
                        next();
                    });
                });
                done();
            }
        })
    },
    getNarudzba: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio spojiti na bazu.');
            } else{
                client.query('SELECT narudzbe.id as nid,p.id as pid,p.ime_proizvoda as ime_proizvoda,p.opis as opis,dn.kolicina as kolicina,datum_narudzbe,ukupna_cijena,potvrdjena FROM narudzbe INNER JOIN detalji_narudzbe dn\n' +
                    ' ON dn.id_narudzbe = narudzbe.id INNER JOIN proizvod p ON p.id = dn.id_proizvoda\n' +
                    ' WHERE narudzbe.id = $1 AND potvrdjena = false;',[req.params.id],function(err,result){
                    if(err){
                        console.info('Nisam uspio dobiti korisnika.');
                    } else{
                        req.narudzba = result.rows;
                        next();
                    }
                });
            }done();
        });
    },
    potvrdiNarudzbu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                console.info(req.params.id + ' DA LI OVDJE RADI');
                client.query("UPDATE narudzbe SET potvrdjena = true WHERE id = $1;",[req.params.id],function(err,result){
                    console.info(req.params.id + ' CCCCC')
                    client.query("UPDATE narudzbe SET telefon = $1 WHERE id = $2;",[req.body.broj_telefona,req.session.korpa],function(err,resultt){
                        client.query("UPDATE narudzbe SET zeljeno_vrijeme = $1 WHERE id = $2;",[req.body.zeljeno_vrijeme,req.session.korpa],function(err,resulttt){
                            console.info(req.params.id + ' AAAAAAAAAA')
                            next();
                        });
                    });
                });
                done();
            }
        })
    },
    ukloniProdukt: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('DELETE FROM detalji_narudzbe WHERE id_narudzbe = $1 and id_proizvoda = $2;',[req.params.id,req.params.proizvod],function(err,result){
                    next();
                });
                done();
            }
        })
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
    getDostavljac: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                console.info(req.trenutnanarudzba.restoran + ' OVO PROVJERAVAS');
                client.query('SELECT DISTINCT restoran_dostavljac.*, (SELECT COUNT(*) FROM narudzbe WHERE narudzbe.dostavljac = restoran_dostavljac.id_dostavljaca AND narudzbe.je_zavrsena= true) AS TOT,\n' +
                    '                (SELECT COUNT(*) FROM narudzbe WHERE narudzbe.dostavljac = restoran_dostavljac.id_dostavljaca AND narudzbe.je_zavrsena= false ) AS TOT_AKTIVNIH FROM restoran_dostavljac\n' +
                    '    WHERE restoran_dostavljac.id_restorana = $1\n' +
                    '    GROUP BY restoran_dostavljac.id\n' +
                    '    ORDER BY TOT_AKTIVNIH ASC\n' +
                    ';',[req.trenutnanarudzba.restoran],function(err,result){
                    if(result.rows){
                        console.info('usao u prvi');
                        req.iddostavljaca = result.rows[0].id_dostavljaca;
                        console.info(req.iddostavljaca + '  ID DOSTAVLJACA');
                        next();
                    }else{
                        client.query('SELECT DISTINCT restoran_dostavljac.*, (SELECT COUNT(*) FROM narudzbe WHERE narudzbe.dostavljac = restoran_dostavljac.id_dostavljaca AND narudzbe.je_zavrsena= true) AS TOT,\n' +
                            '                (SELECT COUNT(*) FROM narudzbe WHERE narudzbe.dostavljac = restoran_dostavljac.id_dostavljaca AND narudzbe.je_zavrsena= true ) AS TOT_AKTIVNIH FROM restoran_dostavljac\n' +
                            '    WHERE restoran_dostavljac.id_restorana = 9\n' +
                            '    GROUP BY restoran_dostavljac.id\n' +
                            '    ORDER BY TOT_AKTIVNIH ASC\n' +
                            ' ;',[req.trenutnanarudzba.restoran],function(err,resultt){
                            console.info('usao u drugu.');
                            req.iddostavljaca = resultt.rows[0].id_dostavljaca;
                            next();
                        });
                    }
                });
                done();
            }
        })
    },
    dodajDostavljacaNarudzbi: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE narudzbe SET dostavljac = $1,potvrdjena = true WHERE id = $2;',[req.iddostavljaca,req.session.korpa],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    getTrenutnuNarudzbu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('SELECT * FROM narudzbe WHERE id = $1;',[req.session.korpa],function(err,result){
                    if(result.rows){
                        req.trenutnanarudzba = result.rows[0];
                        if(req.trenutnanarudzba.potvrdjena)
                            res.redirect('/');
                        next();
                    }else next();
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

/* GET users listing. */
router.get('/:id', db.getNotifikacije,db.getNarudzba,db.getTrenutnuNarudzbu,function(req, res, next) {
    res.render('korpa',{korpa:req.narudzba,notifikacije:req.notifikacije});
});

router.post('/ukloniproizvod/:id/:proizvod',db.ukloniProdukt,db.updateCijena,function(req,res,next){
   res.redirect('back');
});

router.post('/posaljinarudzbu',db.getTrenutnuNarudzbu,db.getDostavljac,db.dodajDostavljacaNarudzbi,db.potvrdiNarudzbu,db.posaljiEmail,function(req,res,next){
    req.session.potvrdjena = 1;
    res.redirect('/');
});

module.exports = router;
