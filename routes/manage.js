var express = require('express');
var router = express.Router();
var session = require('express-session');
var podaci = process.env;
var pg = require('pg');
var mapquest = require('mapquest');
const bcrypt = require('bcrypt');
const multer  = require('multer');
const path = require('path');
process.env.MAPQUEST_API_KEY = 'n4edXxOu26XAjeXgn9NLWGIyS40TlGm2';
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

const saltRounds = 10;

var pool = new pg.Pool(config);

const redirect = (req,res,next) => {
    if(!req.session.userID){
        res.redirect('/login');
    }else if(req.session.userID && req.session.role == 1){
        next();
    }else{
        res.redirect('/');
    }
}

var db = {
    getUsers: function(req,res,next){
        pool.connect(function(err,client,done){
           if(err){
               console.info('Greška prilikom spajanja na bazu podataka.');
           } else{
               client.query('SELECT k.id as kid,k.ime as i, k.prezime as p,k.email as e,' +
                   ' a.naziv_ulice as ulica, r.naziv as rank FROM korisnik k INNER JOIN adresa a ON k.adresa = a.id INNER JOIN role r ON k.role = r.id WHERE k.active = 1;',[],
                   function(err,result){
                        if(result.rows){
                            req.users = result.rows;
                            next();
                        }done();
                   })
           }
        });
    },
    getRanks: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('SELECT * FROM role;',[],
                    function(err,result){
                        if(result.rows){
                            req.ranks = result.rows;
                            next();
                        }done();
                    })
            }
        });
    },
    updateRank: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('UPDATE korisnik SET role = $1 WHERE id = $2;',[req.params.rank,req.params.user],
                    function(err,result){
                        req.flash('promjena-ranka','Uspješno updateovan rank.');
                        next();
                        done();
                    })
            }
        });
    },
    deleteUser: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('UPDATE korisnik SET active = 0 WHERE id = $1;',[req.params.id],
                    function(err,result){
                        req.flash('delete-user','Korisnik izbrisan iz sistema.');
                        next();
                        done();
                    })
            }
        });
    },
    deleteRestoran: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('UPDATE restoran SET active = 0 WHERE id = $1;',[req.params.id],
                    function(err,result){
                        req.flash('delete-restoran','Restoran izbrisan iz sistema.');
                        next();
                        done();
                    })
            }
        });
    },
    provjeraMaila: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('SELECT * FROM korisnik WHERE email = $1 and active = 1;',[req.params.mail],
                    function(err,result){
                        if(result.rows.length>0){
                            req.flash('greska','Email je već u upotrebi.');
                            req.postoji = 1;
                            next();
                        }else{
                            req.postoji = 0;
                            next();
                        }
                        done();
                    })
            }
        });
    }
    ,
    updateEmail: function(req,res,next){
        if(req.postoji == 1){
            next();
        }else{
            pool.connect(function(err,client,done){
                if(err){
                    console.info('Greška prilikom spajanja na bazu podataka.');
                } else{
                    client.query('UPDATE korisnik SET email = $1 WHERE id = $2 and active = 1;',[req.params.mail,req.params.id],function(err,result){
                        req.flash('uspjeh','Uspješno promijenjen email.');
                        next();
                    })
                    done();
                }
            });
        }
    },
    updateVlasnik:function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('UPDATE restoran SET vlasnik = $1 WHERE id = $2 and active = 1;',[req.params.korisnik,req.params.restoran],function(err,result){
                    req.flash('vlasnik','Uspješno promijenjen vlasnik restorana.');
                    next();
                })
                done();
            }
        });
    },
    updateKategorija: function(req,res,next){
        if(req.params.kategorija.length > 0) {
            pool.connect(function (err, client, done) {
                if (err) {
                    console.info('Greška prilikom spajanja na bazu podataka.');
                } else {
                    client.query('UPDATE restoran SET kategorija = $1 WHERE id = $2 and active = 1;', [req.params.kategorija, req.params.id], function (err, result) {
                        req.flash('kategorija', 'Uspješno promijenjena kategorija');
                        next();
                    })
                    done();
                }
            });
        }else{
            req.flash('greska-kategorija','Zaboravili ste unijeti opis kategorije.');
            next();
        }
    },
    getRestorani: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('SELECT restoran.id as rid,naziv_restorana as nr,kategorija as kt,a.naziv_ulice as ulica,k.id as korid,k.ime as ime,k.prezime as prezime,restoran.slika as sl FROM ' +
                    'restoran INNER JOIN adresa a ON restoran.adresa = a.id INNER JOIN korisnik k ON restoran.vlasnik = k.id WHERE restoran.active = 1;',[],
                    function(err,result){
                        if(result.rows){
                            req.restorani = result.rows;
                            next();
                        }done();
                    })
            }
        });
    },
    provjeraPostojeceg: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Greška prilikom spajanja na bazu podataka.');
            } else{
                client.query('SELECT * FROM korisnik WHERE username = $1 OR email = $2 AND active = 1;',[req.body.username,req.body.email],function(err,result){
                    if(result.rows.length>0){
                        req.postoji = 1;
                        console.info('Postoji.');
                        next();
                    }else{
                        req.postoji = 0;
                        console.info('Ne postoji');
                        next();
                    }
                })
                done();
            }
        });
    },
    dodajKorisnika: function(req,res,next){
        if(req.postoji == 1){
            console.info('Ne dodaje morisnika jer postoji.');
            next();
        }else{
            pool.connect(function(err,client,done){
                if(err){
                    console.info('Greška prilikom spajanja na bazu podataka.');
                } else{
                    console.info('Dodajem korisnika');;
                    client.query('INSERT INTO korisnik (username,ime,prezime,email,adresa,password,role) VALUES ($1,$2,$3,$4,$5,$6,$7);',
                        [req.body.username,req.body.ime,req.body.prezime,req.body.email,req.id_ulice,req.body.password,req.body.role],function(err,result){
                        console.info('Dodao sam korisnika');
                        next();
                    })
                    done();
                }
            });
        }
    },
    obradiAdresu: function(req,res,next){
        var zaObradu = req.body.adresa + ' Sarajevo';
        mapquest.geocode({ address: zaObradu }, function(err, location) {
            req.ulica_objekat = location;
            console.info('Obradio sam adresu.');
            next();
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
                        console.info('Dodao sam ulicu u bazu.');
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
                        console.info('Dobio sam ID ulice.');
                        next();
                    });
            }done();
        });
    },
    hashPassword: function(req,res,next){
        bcrypt.genSalt(saltRounds, function(err, salt) {
            bcrypt.hash(req.body.password, salt, function(err, hash) {
                req.body.password = hash;
                next();
            });
        });
    },
    dodajRestoran: function(req,res,next){
        pool.connect(function(err,client,done){
            console.info('Dodajem restoran...');
           if(err){
               console.info('Došlo je do greške prilikom spajanja na bazu.');
           } else{
               client.query('INSERT INTO restoran (naziv_restorana,kategorija,adresa,vlasnik) VALUES ($1,$2,$3,$4);',
                   [req.body.nazivrestorana,req.body.kategorijarestorana,req.id_ulice,req.body.vlasnikrestorana],function(err,result){
                       console.info('ID ULICE RESTORANA ---->'+req.id_ulice);
                       console.info('NAZIV RESTORANA ----->'+req.body.nazivrestorana);
                       console.info('KATEGORIJA RESTORANA ----->'+req.body.kategorijarestorana);
                       console.info('ID VLASNIKA ----->'+req.body.vlasnikrestorana);
                        console.info('Dodao sam restoran');
                        next();
                   });
           }done();
        });
    },
    upisiSlikuUBazu: function(req,res,next){
        req.fajl = req.file.filename;
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('UPDATE restoran set slika = $1 WHERE id = $2;',
                    [req.fajl,req.params.id]
                    ,function(err,result){
                        console.info('Dodao sam sliku u bazu.');
                        next();
                    });
            }done();
        });
    },
    getSviDostavljaci: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT * FROM korisnik WHERE role = 3;',
                    [],function(err,result){
                        req.svidostavljaci = result.rows;
                        next();
                    });
            }done();
        });
    },
    getStatistikaMapa: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                if(req.body.dostavljac_izbor == 0){
                    client.query('SELECT  a.latituda as latituda, a.longituda as longituda FROM narudzbe INNER JOIN adresa a ON narudzbe.adresa = a.id WHERE date_part(\'year\',datum_narudzbe) = $1 and  date_part(\'month\',datum_narudzbe) = $2 and date_part(\'day\',datum_narudzbe) =$3;',
                        [req.body.godina,req.body.mjesec,req.body.dan],function(err,result){
                            console.info(result.rows[0].latituda + ' PRVI PUT');
                            req.statistikadostave = result.rows;
                            for(let i=0;i<req.statistikadostave.length;++i){
                                console.info(req.statistikadostave[i].latituda + '  ' + req.statistikadostave[i].longituda);
                            }
                            next();
                        });
                }else if(req.body.dostavljac_izbor > 0){
                    client.query('SELECT  a.latituda as latituda, a.longituda as longituda FROM narudzbe INNER JOIN adresa a ON narudzbe.adresa = a.id WHERE date_part(\'year\',datum_narudzbe) = $1 and date_part(\'month\',datum_narudzbe) = $2 and date_part(\'day\',datum_narudzbe) =$3 and dostavljac = $4;',
                        [req.body.godina,req.body.mjesec,req.body.dan,req.body.dostavljac_izbor],function(err,result){
                            console.info(result.rows[0].latituda+ ' DRUGI PUT');
                            req.statistikadostave = result.rows;
                            next();
                        });
                }
            }done();
        });
    },
    posaljiizvjestaj: function(req,res,next){
        var datum = new Date();
        pool.connect(function(err,client,done){
           client.query('SELECT kr.ime as krime,kr.prezime as krprezime,k.ime as kime,k.prezime as prezime,r.naziv_restorana as naziv_restorana,datum_narudzbe,ukupna_cijena,telefon \n' +
               ' FROM narudzbe\n' +
               ' INNER JOIN restoran r ON narudzbe.restoran = r.id\n' +
               ' INNER JOIN korisnik kr ON narudzbe.korisnik = kr.id\n' +
               ' INNER JOIN korisnik k ON narudzbe.dostavljac = k.id\n' +
               ' WHERE date_part(\'month\',datum_narudzbe) = $1 and date_part(\'year\',datum_narudzbe) = $2;',[datum.getMonth()+1,datum.getFullYear()],function(err,result){
                    if(err){
                        console.info('DOSLO JE DO GRESKE PRILIKO IZVJESTAJA.');
                    }else{
                        req.za_izvjestaj = result.rows;
                        req.datum = datum;
                        next();
                    }
           });
        });
    },
    obradihtml: function(req,res,next){
        var html = "----IZVJEŠTAJ O RESTORANIMA, BROJU NARUDŽBI TE PROFITU----<br><hr>";
        for(let i=0;i<req.brojacporestoranu.length;++i){
            html+='Naziv restorana: ' + req.brojacporestoranu[i].naziv_restorana + ', ukupan broj narudžbi: ' + req.brojacporestoranu[i].brojac + ', ukupan profit: ' + req.profitporestoranu[i].brojac + 'KM <br>';
        }
        html+="<br><hr>";
        for(let i=0;i<req.za_izvjestaj.length;++i){
            html+= 'Ime kupca: ' + req.za_izvjestaj[i].krime + ' - Prezime kupca: ' + req.za_izvjestaj[i].krprezime + ' - Restoran: ' + req.za_izvjestaj[i].naziv_restorana +
            ' - Datum narudžbe: ' + req.za_izvjestaj[i].datum_narudzbe + ' - Ukupna cijena: ' + req.za_izvjestaj[i].ukupna_cijena + ' - Telefon: ' + req.za_izvjestaj[i].telefon;
            html+='<br><hr><br>';
        }
        console.info(html);
        req.linije = html;
        next();
    },
    posaljiMail: function(req,res,next){
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
            to: 'filipvlaisavljevic@outlook.com',
            subject: 'GRIZ.BA - IZVJEŠTAJ ZA  ' + (req.datum.getMonth()+1) + '. MJESEC,' + (req.datum.getFullYear()),
            text: "----IZVJEŠTAJ----",
            html: req.linije
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error.message);
                next();
            }
            console.log('success emailed');
            next();
        });
    },
    getBrojacPoRestoranu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT r.naziv_restorana as naziv_restorana, count(kr.id) as brojac\n' +
                    ' FROM narudzbe\n' +
                    ' INNER JOIN restoran r ON narudzbe.restoran = r.id\n' +
                    ' INNER JOIN korisnik kr ON narudzbe.korisnik = kr.id\n' +
                    ' INNER JOIN korisnik k ON narudzbe.dostavljac = k.id\n' +
                    ' WHERE date_part(\'month\',datum_narudzbe) = $1 and date_part(\'year\',datum_narudzbe) = $2\n' +
                    ' GROUP BY r.id\n' +
                    ';',
                    [req.datum.getMonth()+1,req.datum.getFullYear()],function(err,result){
                        console.info(result.rows.length + ' BROJAC DUZINA ');
                        req.brojacporestoranu = result.rows;
                        next();
                    });
            }done();
        });
    },
    getProfitPoRestoranu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('SELECT r.naziv_restorana as naziv_restorana, sum(ukupna_cijena) as brojac\n' +
                    ' FROM narudzbe\n' +
                    ' INNER JOIN restoran r ON narudzbe.restoran = r.id\n' +
                    ' INNER JOIN korisnik kr ON narudzbe.korisnik = kr.id\n' +
                    ' INNER JOIN korisnik k ON narudzbe.dostavljac = k.id\n' +
                    ' WHERE date_part(\'month\',datum_narudzbe) = $1 and date_part(\'year\',datum_narudzbe) = $2\n' +
                    ' GROUP BY r.id\n' +
                    ';\n',
                    [req.datum.getMonth()+1,req.datum.getFullYear()],function(err,result){
                        console.info(result.rows.length + ' PROFIT DUZINA ');
                        req.profitporestoranu = result.rows;
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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        console.log('dosao storage');
        console.log(file);
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

const upload = multer({ storage: storage, fileFilter: fileFilter });

/* GET users listing. */
router.get('/',redirect, db.getNotifikacije,db.getUsers,db.getRanks,db.getRestorani,function(req, res, next) {
    res.render('manage',{users:req.users,rankovi:req.ranks,restorani:req.restorani,notifikacije:req.notifikacije});
});

router.post('/izvjestaj',db.posaljiizvjestaj,db.getBrojacPoRestoranu,db.getProfitPoRestoranu,db.obradihtml,db.posaljiMail,function(req,res,next){
   res.send('Izvještaj je poslan na Vaš email.');
});

router.get('/statistika',redirect,db.getNotifikacije,db.getSviDostavljaci,function(req,res,next){
   res.render('statistika',{svidostavljaci:req.svidostavljaci,notifikacije:req.notifikacije});
});

router.post('/prikazistatistiku',db.getNotifikacije,db.getStatistikaMapa,function(req,res,next){
   res.render('prikaz',{statistika:req.statistikadostave,notifikacije:req.notifikacije});
});

router.get('/promjenaRanka/:rank/:user',db.updateRank,function(req,res,next){
   let objekat = {
       ispis: req.flash('promjena-ranka'),
       rank: req.params.rank,
       user: req.params.user
   }
   console.info(req.flash('promjena-ranka'));
   res.send(objekat);
});

router.get('/izbrisiKorisnika/:id',db.deleteUser,function(req,res,next){
    res.send(req.flash('delete-user'));
});

router.get('/promjenaMaila/:mail/:id',db.provjeraMaila,db.updateEmail,function(req,res,next){
    let objekat = {
        greska: req.flash('greska'),
        uspjeh: req.flash('uspjeh')
    }
    res.send(objekat);
});

router.get('/promjenaKategorije/:kategorija/:id',db.updateKategorija,function(req,res,next){
    let ispis = {
        greska: req.flash('greska-kategorija'),
        uspjeh: req.flash('kategorija')
    }
    res.send(ispis);
});

router.get('/promjenaVlasnika/:restoran/:korisnik',db.updateVlasnik,function(req,res,next){
    res.send(req.flash('vlasnik'));
});

router.get('/izbrisiRestoran/:id',db.deleteRestoran,function(req,res,next){
   res.send(req.flash('delete-restoran'));
});

router.post('/uploadslike/:id',upload.single('image'),db.upisiSlikuUBazu,function(req,res,next){
    try {
        res.redirect('/');

    } catch (error) {
        console.error(error);
    }
});

router.post('/kreirajNalog',db.provjeraPostojeceg,db.hashPassword,db.obradiAdresu,db.dodajUlicu,db.getIDUlice,db.dodajKorisnika,function(req,res,next){
    res.send('ok');
})

router.post('/kreirajRestoran',db.obradiAdresu,db.dodajUlicu,db.getIDUlice,db.dodajRestoran,function(req,res,next){
    res.send('ok');
});

module.exports = router;
