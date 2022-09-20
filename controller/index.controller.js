const { isUndefined } = require("util");
const { ObjectID } = require("mongodb");
const jwt = require("jsonwebtoken");
const model = require("../model/index.model").function;
const fs = require("fs");
const path = require("path");
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");
const nodemailer = require("nodemailer");

const paymentAddition = (response, res, req, donator_id, title) => {
  model
    .addPaymentData({
      paymentData: response.action.paymentData,
      amount: req.body.amount,
      payment_method: req.body.paymentMethod,
      request_id: req.body.request_id,
      donator: donator_id || "unknown",
      title,
    })
    .then((rsp) => {
      console.log(rsp);
      if (rsp.result.ok) {
        res.send({ pd: rsp.id, action: response.action.url });
      } else {
        res.send({
          message: "error",
        });
      }
    });
};

const test = (req, res) => {
  const config = new Config();
  // Set your X-API-KEY with the API key from the Customer Area.
  config.apiKey = API_KEY;
  config.merchantAccount = MERCHANT_ACCOUNT;

  const client = new Client({ config });
  client.setEnvironment("TEST");
  const checkout = new CheckoutAPI(client);
  checkout
    .payments({
      amount: { currency: "PHP", value: req.body.amount },
      paymentMethod: {
        type: req.body.paymentMethod,
      },
      reference: REFERENCE,
      merchantAccount: config.merchantAccount,
      returnUrl: RETURN_URL,
    })
    .then((response) => {
      if (req.body.token) {
        jwt.verify(req.body.token, JWT_AUTH, function (err, decoded) {
          console.log(decoded);
          if (err) {
            res.send(err);
          } else {
            paymentAddition(response, res, req, decoded._id, req.body.title);
          }
        });
      } else {
        paymentAddition(response, res, req, undefined, req.body.title);
      }
    });
};

const addSponsor = async (req, res) => {
  const document = await model.findDocument({ username: req.body.email });
  const count = await document.count();

  if (count) {
    res.send({
      message: "email already",
    });
  } else {
    model
      .addSponsor({
        first_name: req.body.fname,
        middle_name: req.body.mname,
        last_name: req.body.lname,
        username: req.body.email,
      })
      .then(async (response) => {
        if (response.result.result.ok) {
          let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
              user: EMAIL,
              pass: EMAIL_PASS,
            },
          });

          let info = await transporter.sendMail({
            from: "Help Advocates PH",
            to: req.body.email,
            subject: "Help Adovocates PH | Sponsor Confirmation",
            text: "Help Adovocates PH | Sponsor Confirmation", // plain text body
            html: `
                                <div style="width:100%;padding:10px;background:linear-gradient(to right,#1ca7ec,#1f2f98);font-size:12pt;font-weight:bold;color:white;border-radius:3px;box-sizing: border-box">Help Advocates PH</div>
                                <div style="width:100%;padding: 15px;border: 1px solid rgba(0,0,0,0.1);border-radius:3px;background-color: #fafafb;box-sizing:border-box;margin-top: 10px">
                                    <h5>Thank you for signing-up as a sponsor, hoping for more people you could help!</h5>
                                    <h5 style="display:inline-block;margin-right: 10px">Username: </h5><small>jayrald.empino@tup.edu.ph</small><br />
                                    <h5 style="display:inline-block;margin-right: 10px">Password: </h5><small>[click the button below to set]</small><br />
                                    <a href="https://helpadvocatesph.tech/confirm/${response.uid}" style="display:inline-block;padding: 10px;font-size: 9pt;border:1px solid rgba(0,0,0,0.1);border-radius:3px;background-color:white;display:block;text-align:center">Set Password</a>
                                </div>
                            `,
          });

          res.send({
            message: "added",
            uuid: response.uid,
          });
        } else {
          res.send({
            message: "error insertion",
          });
        }
      });
  }
};

const verifyPaymentData = async (req, res) => {
  const document = await model.findPaymentData({
    paymentData: req.body.pd,
  });
  const count = await document.count();

  if (count) {
    document.forEach(({ _id, ...item }) => {
      res.send({ ...item });
    });
  } else {
    res.send({
      message: "no payment data found",
    });
  }
};

const onUser = async (req, res) => {
  if (!isUndefined(req.body.token)) {
    jwt.verify(req.body.token, JWT_AUTH, function (err, payload) {
      if (err) {
        res.send(err);
      } else {
        if (payload.data === "new" || payload.data === "validated") {
          const newPayload = Object.assign(payload, { data: "logged" });
          res.send({
            message: "logged",
            token: jwt.sign(newPayload, JWT_AUTH),
          });
        } else {
          res.send({
            message: "good",
          });
        }
      }
    });
  } else {
    res.send({
      message: "login first",
    });
  }
};

const findDocument = async (req, res) => {
  if (isUndefined(req.body.token)) {
    const credentials = {
      username: req.body.uname,
      password: req.body.upass,
    };
    const document = await model.findDocument(credentials);
    const count = await document.count();

    if (count) {
      req.session.legit = true;
      document.forEach(({ username, _id }) => {
        let token = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            data: "validated",
            _id,
          },
          JWT_AUTH
        );
        res.send({ message: "found", _id, username, token });
      });
    } else {
      req.session.legit = false;
      res.send({
        message: "no record",
      });
    }
  } else {
    jwt.verify(req.body.token, JWT_AUTH, function (err, decoded) {
      if (err) {
        res.send(err);
      } else {
        if (decoded.data === "logged") {
          res.send({
            message: "You already validated",
          });
        }
      }
    });
  }
};

const addDocument = async (req, res) => {
  const document = await model.findDocument({ username: req.body.username });
  const count = await document.count();

  model
    .imageCompare({
      prevImage: fs.readFileSync(
        path.resolve(`./${req.files["source"][0].path}`)
      ),
      currentImage: fs.readFileSync(
        path.resolve(`./${req.files["target"][0].path}`)
      ),
    })
    .then((response) => {
      if (response.FaceMatches.length) {
        if (count === 0) {
          model
            .addDocument({
              job: req.body.job,
              first_name: req.body.first_name,
              last_name: req.body.last_name,
              middle_name: req.body.middle_name,
              birthday: req.body.birthday,
              username: req.body.username,
              password: req.body.password,
            })
            .then((response) => {
              console.log(response);
              if (response.result.ok) {
                let token = jwt.sign(
                  {
                    exp: Math.floor(Date.now() / 1000) + 60 * 60,
                    data: "new",
                    _id: response._id,
                  },
                  JWT_AUTH
                );
                res.send({ message: "registered", token });
              } else {
                res.send({ message: "not-registered" });
              }
            });
        } else {
          res.send({
            message: "username is taken",
          });
        }
      } else {
        res.send({
          message: "Face not match",
        });
      }
    });
};

const getAllRequests = (req, res) => {
  model.getAllRequests().then(async (response) => {
    const count = await response.count();

    if (count) {
      const reqs = await response.toArray();
      res.send({ message: "got", reqs });
    } else {
      res.send({
        message: "none",
      });
    }
  });
};

const removeRequest = (req, res) => {
  model.removeRequests(req.body.reqID).then((response) => {
    if (response.ok) {
      res.send({
        message: "deleted",
      });
    }
  });
};

const getDocument = async (req, res) => {
  jwt.verify(req.body.token, JWT_AUTH, async function (err, payload) {
    if (err) {
      res.send(err);
    } else {
      if (payload.data === "logged") {
        if (payload._id.length === 24) {
          const document = await model.findDocument({
            _id: ObjectID(payload._id),
          });
          const count = await document.count();
          if (count) {
            let userData;
            document.forEach(async ({ password, ...item }) => {
              userData = { ...item };
              const doc = await model.getRequests(userData._id);
              const data = await doc.toArray();
              res.send({ userData, requests: data });
            });
          } else {
            res.send({
              message: "no-record",
            });
          }
        } else {
          res.send({
            message: "invalid id",
          });
        }
      } else {
        res.send({
          message: "login first",
        });
      }
    }
  });
};

const addRequest = (req, res) => {
  if (!(req.files.length > 1)) {
    const { title, description, city, needs } = req.body;

    if (title && description && city && needs) {
      if (isUndefined(req.body.token)) {
        res.send({
          message: "forbidden request",
        });
        fs.unlinkSync(path.resolve(`./${req.files[0].path}`));
      } else {
        if (req.body.token) {
          jwt.verify(req.body.token, JWT_AUTH, function (err, value) {
            if (err) {
              res.send(err);
            } else {
              if (value.data === "logged") {
                model
                  .addRequest({
                    owner_id: value._id,
                    title: req.body.title,
                    description: req.body.description,
                    city: req.body.city,
                    needs: req.body.needs,
                    contact: req.body.contact,
                    address: req.body.address,
                    receiver: req.body.receiver,
                    lat: req.body.lat,
                    lng: req.body.lng,
                    pathname: req.files[0].path,
                    filename: req.files[0].filename + ".jpeg",
                  })
                  .then((response) => {
                    console.log(response);
                    if (response.ok) {
                      res.send({ message: "request added" });
                    } else if (response.message === "limit-exceed") {
                      res.send({ message: "request-exceed" });
                    } else if (response.message === "error-s3") {
                      res.send({ message: "error-s3" });
                    } else {
                      res.send({ message: "Error! Please Try Again." });
                    }
                    fs.unlinkSync(path.resolve(`./${req.files[0].path}`));
                  });
              } else {
                res.send({
                  message: "malicious credentials",
                });
                fs.unlinkSync(path.resolve(`./${req.files[0].path}`));
              }
            }
          });
        } else {
          res.send({
            message: "invalid token",
          });
          fs.unlinkSync(path.resolve(`./${req.files[0].path}`));
        }
      }
    } else {
      res.send({
        message: "incomplete fields",
      });
    }
  } else {
    res.send({
      message: "more than 1 image is not allowed",
    });
  }
};

const imageCompare = (req, res) => {
  model
    .imageCompare({
      prevImage: fs.readFileSync(
        path.resolve(`./${req.files["source"][0].path}`)
      ),
      currentImage: fs.readFileSync(
        path.resolve(`./${req.files["target"][0].path}`)
      ),
    })
    .then((response) => {
      res.send(response);
    });
};

const uploadImage = async (req, res) => {
  const result = await model.uploadImage({
    pathname: req.file.path,
    filename: req.file.filename + ".jpeg",
  });
  res.send(result);
};

const confirmEmail = async (req, res) => {
  const document = await model.findDocument({ uid: req.body.uid });
  const count = await document.count();

  if (count) {
    const data = await document.toArray();
    if (data[0].activated) {
      res.send({
        message: "activated already",
      });
    } else {
      res.send({
        message: "found",
        result: data[0],
      });
    }
  } else {
    res.send({
      message: "no account",
    });
  }
};

const setSponsorPassword = (req, res) => {
  model
    .setSponsorPassword({
      uid: req.body.uid,
      password: req.body.password,
    })
    .then((response) => {
      if (response.result.ok) {
        res.send({
          message: "setted",
        });
      } else {
        res.send({
          message: "error",
        });
      }
    });
};

const applyDonation = (req, res) => {
  model.applyDonation(req.body.pd).then((response) => {
    if (response.ok) {
      res.send({
        message: "donated",
      });
    } else {
      res.send({
        message: "error",
      });
    }
  });
};

const getDonation = (req, res) => {
  if (req.body.token.trim()) {
    jwt.verify(req.body.token, JWT_AUTH, (err, decoded) => {
      if (err) {
        res.send(err);
      } else {
        model.getDonation(decoded._id).then(async (response) => {
          const count = await response.count();

          console.log({ count });

          if (count) {
            const data = await response.toArray();
            res.send({
              message: "got",
              result: data,
            });
          } else {
            res.send({
              message: "none",
            });
          }
        });
      }
    });
  } else {
    res.send({
      message: "invalid token",
    });
  }
};

exports.controller = {
  findDocument,
  addDocument,
  getDocument,
  addRequest,
  imageCompare,
  onUser,
  test,
  verifyPaymentData,
  uploadImage,
  removeRequest,
  getAllRequests,
  addSponsor,
  confirmEmail,
  setSponsorPassword,
  applyDonation,
  getDonation,
};
