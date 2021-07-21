var express = require('express');
var router = express.Router();
var session = require('express-session');
var pg = require('pg');
var mapquest = require('mapquest');
const bcrypt = require('bcrypt');
const multer  = require('multer');
const path = require('path');
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

const redirect = (req,res,next) => {
    if(!req.session.userID){
        res.redirect('/login');
    }else if(req.session.userID && req.session.role == 2 && req.session.rid == req.params.id){
        next();
    }else if(req.session.userID && req.session.role == 1) {
        next();
    }else
    {
        res.redirect('/');
    }
}

var pool = new pg.Pool(config);

var db = {
    getRestoran: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }else{
                client.query('SELECT restoran.id as rid,restoran.naziv_restorana,restoran.kategorija,a.naziv_ulice as ulica FROM restoran' +
                    ' INNER JOIN adresa a ON restoran.adresa = a.id WHERE restoran.id = $1 AND active = 1;',[req.params.id],function(err,result){
                   req.restoran = result.rows[0];
                   next();
                });done();
            }
        })
    },
    getProizvodi: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }else{
                client.query('SELECT p.id,p.stara_cijena,p.ime_proizvoda,p.cijena_proizvoda,p.opis,k.ime_kategorije FROM proizvod p' +
                    ' INNER JOIN restoran_kategorija k ON p.kategorija = k.id WHERE p.id_restorana = $1 AND p.active = 1;',[req.params.id],function(err,result){
                    req.proizvodi = result.rows;
                    next();
                });done();
            }
        })
    },
    changeNaziv: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE restoran SET naziv_restorana = $1 WHERE id = $2;',[req.body.promjena_naziva,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    changeKategorija: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE restoran SET kategorija = $1 WHERE id = $2;',[req.body.promjena_kategorije,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    obradiAdresu: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Ne mogu se povezati na bazu podataka.');
            } else{
                var zaObradu = req.body.promjena_ulice + ' Sarajevo';
                mapquest.geocode({ address: zaObradu }, function(err, location) {
                    client.query('INSERT INTO adresa (naziv_ulice,latituda,longituda) VALUES ($1,$2,$3);',[req.body.promjena_ulice,location.latLng.lat,location.latLng.lng],
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
                    [req.body.promjena_ulice],function(err,result){
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
                client.query('UPDATE restoran SET adresa = $1 WHERE id = $2;',
                    [req.id_ulice,req.params.id],function(err,result){
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
    upisiSlikuProizvodaUBazu: function(req,res,next){
        req.fajl = req.file.filename;
        pool.connect(function(err,client,done){
            if(err){
                console.info('Došlo je do greške prilikom spajanja na bazu.');
            }else{
                client.query('UPDATE proizvod set slika = $1 WHERE id = $2;',
                    [req.fajl,req.params.id]
                    ,function(err,result){
                        console.info('Dodao sam sliku u bazu.');
                        next();
                    });
            }done();
        });
    },
    changeNazivProizvoda: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE proizvod SET ime_proizvoda = $1 WHERE id = $2;',[req.body.promjena_naziva_proizvoda,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    changeOpisProizvoda: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE proizvod SET opis = $1 WHERE id = $2;',[req.body.promjena_opisa,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    changeCijenaProizvoda: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE proizvod SET cijena_proizvoda = $1 , stara_cijena = $2 WHERE id = $3;',[parseFloat(req.body.promjena_cijene_proizvoda),parseFloat(req.params.cijena),req.params.id],function(err,result){
                    if(err)
                        console.info('err');
                    console.info(req.body.promjena_cijene_proizvoda + '  nova cijena');
                    console.info(req.params.cijena +  ' stara cijena');
                    console.info(req.params.id + '  id restorana');
                    console.info('Uradio sam promjenu cijene.');
                    next();
                });
                done();
            }
        })
    },
    obrisiProizvod: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE proizvod SET active = 0  WHERE id = $1;',[req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    kreirajKategoriju: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('INSERT INTO restoran_kategorija (ime_kategorije,id_restorana) VALUES ($1,$2)',[req.body.naziv_kategorije,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    getKategorije: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT  id,ime_kategorije FROM restoran_kategorija WHERE id_restorana = $1 and active = 1;',[req.params.id],function(err,result){
                if(result.rows.length>0){
                    console.info(result.rows);
                    req.kategorije = result.rows;
                }
                next();
                done();
            })
        });
    },
    dodajProizvod: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('INSERT INTO proizvod (ime_proizvoda,id_restorana,cijena_proizvoda,kategorija,opis) VALUES ($1,$2,$3,$4,$5)',[req.body.naziv_proizvoda,req.params.id,req.body.cijena_proizvoda,req.body.kategorija_izbor,req.body.opis_proizvoda],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    kreirajGrupniMeni: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query("INSERT INTO proizvod (ime_proizvoda,id_restorana,kategorija,opis,slika,cijena_proizvoda) VALUES ($1,$2,11,'Iskoristi priliku i naruči više proizvoda u specijalnoj akciji za manju cijenu.','Untitled.png',$3);",[req.body.naziv_grupnog_proizvoda,req.params.id,req.body.cijena_grupnog_proizvoda],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    getGrupniMeni: function(req,res,next){
        pool.connect(function(err,client,done){
            client.query('SELECT  * FROM grupni_meni WHERE id_restorana = $1 and active = 1;',[req.params.id],function(err,result){
                if(result.rows.length>0){
                    console.info(result.rows);
                    req.grupnimeni = result.rows;
                }
                next();
                done();
            })
        });
    },
    obrisiGrupniMeni: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE grupni_meni SET active = 0  WHERE id = $1;',[req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    updateVrijeme: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE restoran SET radnovrijeme = $1  WHERE id = $2;',[req.body.radnovrijeme,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    updateDostava: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('UPDATE restoran SET udaljenostdostave = $1  WHERE id = $2;',[req.body.udaljenostdostave,req.params.id],function(err,result){
                    next();
                });
                done();
            }
        })
    },
    posaljiizvjestaj: function(req,res,next){
        var datum = new Date();
        pool.connect(function(err,client,done){
            client.query('SELECT kr.ime as krime,kr.prezime as krprezime,k.ime as kime,k.prezime as prezime,r.naziv_restorana as naziv_restorana,datum_narudzbe,ukupna_cijena,telefon \n' +
                ' FROM narudzbe\n' +
                ' INNER JOIN restoran r ON narudzbe.restoran = r.id\n' +
                ' INNER JOIN korisnik kr ON narudzbe.korisnik = kr.id\n' +
                ' INNER JOIN korisnik k ON narudzbe.dostavljac = k.id\n' +
                ' WHERE date_part(\'month\',datum_narudzbe) = $1 and date_part(\'year\',datum_narudzbe) = $2 and restoran = $3;',[datum.getMonth()+1,datum.getFullYear(),req.params.id],function(err,result){
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
        var html = "UKUPAN BROJ NARUDŽBI U OVOM MJESECU JE ----> " + req.za_izvjestaj.length + ' <br><hr><br>';
        html+="Ispod se nalazi detaljan izvještaj o svakoj dostavi u ovom mjesecu te dostavljačima koji su vršili te dostave.<br><br><hr><br>";
        for(let j=0;j<req.brojdostava.length;++j){
            html+="Dostavljač: " + req.brojdostava[j].krime +' '+ req.brojdostava[j].krprezime + ', broj dostava: ' + req.brojdostava[j].brojac + ' <br>';
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
            to: req.emailvlasnika,
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
    getVlasnikEmail: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('SELECT email FROM restoran INNER JOIN korisnik k ON restoran.vlasnik = k.id WHERE restoran.id = $1;',[req.params.id],function(err,result){
                    req.emailvlasnika = result.rows[0].email;
                    next();
                });
                done();
            }
        })
    },
    brojDostava: function(req,res,next){
        pool.connect(function(err,client,done){
            if(err){
                console.info('Nisam se uspio povezati na bazu podataka.');
            }
            else{
                client.query('SELECT kr.ime as krime,kr.prezime as krprezime, count(kr.id) as brojac\n' +
                    ' FROM narudzbe\n' +
                    ' INNER JOIN restoran r ON narudzbe.restoran = r.id\n' +
                    ' INNER JOIN korisnik kr ON narudzbe.korisnik = kr.id\n' +
                    ' INNER JOIN korisnik k ON narudzbe.dostavljac = k.id\n' +
                    ' WHERE date_part(\'month\',datum_narudzbe) = $1 and date_part(\'year\',datum_narudzbe) = $2 and restoran = $3\n' +
                    ' GROUP BY kr.ime,kr.prezime,kr.id\n' +
                    ';\n',[req.datum.getMonth()+1,req.datum.getFullYear(),req.params.id],function(err,result){
                    if(result.rows)
                        req.brojdostava = result.rows;
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

router.get('/:id', redirect,db.getNotifikacije,db.getRestoran,db.getKategorije,db.getProizvodi,db.getGrupniMeni,function(req, res, next) {
    res.render('editrestoran',{restoran:req.restoran,proizvodi:req.proizvodi,kategorije:req.kategorije,grupnimeni:req.grupnimeni,notifikacije:req.notifikacije});
});

router.post('/promjenanaziva/:id',db.changeNaziv,function(req,res,next){
    res.redirect('back');
});

router.post('/izvjestaj/:id',db.posaljiizvjestaj,db.brojDostava,db.obradihtml,db.getVlasnikEmail,db.posaljiMail,function(req,res,next){
    res.send('Izvještaj je poslan na Vaš email.');
});

router.post('/radnovrijeme/:id',db.updateVrijeme,function(req,res,next){
    res.redirect('back');
});

router.post('/krugdostave/:id',db.updateDostava,function(req,res,next){
    res.redirect('back');
});

router.post('/promjenanazivaproizvoda/:id',db.changeNazivProizvoda,function(req,res,next){
    res.redirect('back');
});

router.post('/obrisiproizvod/:id',db.obrisiProizvod,function(req,res,next){
    res.redirect('back');
});

router.post('/obrisigrupnimeni/:id',db.obrisiGrupniMeni,function(req,res,next){
    res.redirect('back');
});

router.post('/kreirajkategoriju/:id',db.kreirajKategoriju,function(req,res,next){
    res.redirect('back');
});

router.post('/kreirajproizvod/:id',db.dodajProizvod,function(req,res,next){
    res.redirect('back');
});

router.post('/kreirajgrupnimeni/:id',db.kreirajGrupniMeni,function(req,res,next){
    res.redirect('back');
});

router.post('/promjenacijeneproizvoda/:id/:cijena',db.changeCijenaProizvoda,function(req,res,next){
    res.redirect('back');
});

router.post('/promjenakategorije/:id',db.changeKategorija,function(req,res,next){
    res.redirect('back');
});

router.post('/promjenaopisaproizvoda/:id',db.changeOpisProizvoda,function(req,res,next){
    res.redirect('back');
});

router.post('/promjenaulice/:id',db.obradiAdresu,db.getIDUlice,db.updateUlica,function(req,res,next){
    res.redirect('back');
});

router.post('/uploadslike/:id',upload.single('image'),db.upisiSlikuUBazu,function(req,res,next){
    try {
        res.redirect('/');

    } catch (error) {
        console.error(error);
    }
});

router.post('/uploadslikeproizvoda/:id',upload.single('image'),db.upisiSlikuProizvodaUBazu,function(req,res,next){
    try {
        res.redirect('back');

    } catch (error) {
        console.error(error);
    }
});

module.exports = router;
