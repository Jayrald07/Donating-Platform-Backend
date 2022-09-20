const fs = require("fs");
const MongoDB = require("mongodb").MongoClient;
const { ObjectID } = require("mongodb");
const AWS = require("aws-sdk");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const client = MongoDB.connect(MONGODB_URL, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
}).then((client) => {
  return client.db("test");
});

AWS.config.region = "us-east-1";
AWS.config.apiVersions = {
  rekognition: "2016-06-27",
  s3: "2006-03-01",
};

var rekognition = new AWS.Rekognition();
var s3 = new AWS.S3();

const uploadImage = ({ pathname, filename }) => {
  const params = {
    ACL: "public-read-write",
    Bucket: "aws-buildon",
    Key: filename,
    Body: fs.readFileSync(path.resolve(`./${pathname}`)),
  };
  s3.upload(params, function (err, data) {
    console.log(err, data);
    if (err) return err;
    return data;
  });
};

const removeRequests = (reqID) => {
  return client.then(async (db) => {
    const feedback = await db
      .collection("requests")
      .deleteOne({ _id: ObjectID(reqID) });
    return feedback.result;
  });
};

const addSponsor = ({ first_name, last_name, middle_name, username }) => {
  return client.then(async (db) => {
    const uid = uuidv4();
    const result = await db.collection("awsBuildon").insertOne({
      first_name,
      last_name,
      middle_name,
      username,
      type: "sponsor",
      activated: false,
      uid,
    });
    return { result, uid };
  });
};

const setSponsorPassword = ({ uid, password }) => {
  return client.then(async (db) => {
    const result = await db.collection("awsBuildon").update(
      {
        uid,
      },
      {
        $set: {
          activated: true,
          password,
        },
      }
    );
    return result;
  });
};

const getRequests = (owner_id) => {
  return client.then(async (db) => {
    console.log({ owner_id });
    const document = await db
      .collection("requests")
      .find({ owner_id: String(owner_id) });
    return document;
  });
};

const getAllRequests = () => {
  return client.then(async (db) => {
    const document = await db.collection("requests").find({});
    return document;
  });
};

const findDocument = ({ ...attr }) => {
  return client.then((db) => {
    return db.collection("awsBuildon").find({ ...attr });
  });
};

const findPaymentData = ({ ...attr }) => {
  return client.then((db) => {
    return db.collection("paymentData").find({ ...attr });
  });
};

const addPaymentData = async ({
  paymentData,
  amount,
  payment_method,
  request_id,
  donator,
  title,
}) => {
  return client.then((db) => {
    return db
      .collection("paymentData")
      .insertOne({
        date_added: new Date().toUTCString(),
        paymentData,
        amount,
        isAlerted: false,
        payment_method,
        request_id,
        donator,
        title,
      })
      .then((response) => {
        return { result: response.result, id: response.insertedId };
      });
  });
};

const applyDonation = (paymentData) => {
  return client.then(async (db) => {
    const document = await db.collection("paymentData").findOneAndUpdate(
      { _id: ObjectID(paymentData) },
      {
        $set: { isAlerted: true },
      }
    );
    console.log(document);

    if (document.value) {
      const donateApply = await db.collection("requests").findOneAndUpdate(
        {
          _id: ObjectID(document.value.request_id),
        },
        {
          $push: {
            donates: {
              amount: document.value.amount,
              date_donated: document.value.date_added,
              payment_method: document.value.payment_method,
            },
          },
        }
      );

      return donateApply;
    } else {
      return "none";
    }
  });
};

const addDocument = ({
  job,
  first_name,
  last_name,
  middle_name,
  birthday,
  username,
  password,
}) => {
  return client.then((db) => {
    return db
      .collection("awsBuildon")
      .insertOne({
        job,
        first_name,
        last_name,
        middle_name,
        birthday,
        username,
        password,
        type: "individual",
      })
      .then((response) => {
        return { result: response.result, _id: response.insertedId };
      });
  });
};

const addRequest = ({
  owner_id,
  title,
  description,
  city,
  needs,
  filename,
  pathname,
  contact,
  address,
  lat,
  lng,
  receiver,
}) => {
  return client.then(async (db) => {
    const document = await db.collection("requests").find({
      owner_id,
    });
    const count = await document.count();

    if (count < 5) {
      const params = {
        ACL: "public-read-write",
        Bucket: "aws-buildon",
        Key: filename,
        Body: fs.readFileSync(path.resolve(`./${pathname}`)),
      };
      return s3
        .upload(params)
        .promise()
        .then((data) => {
          return db
            .collection("requests")
            .insertOne({
              owner_id,
              date_equested: new Date(),
              title,
              description,
              city,
              needs,
              contact,
              address,
              receiver,
              lat,
              lng,
              img: data.Location,
            })
            .then((response) => {
              return response.result;
            });
        })
        .catch((err) => {
          return { message: err };
        });
    } else {
      return new Promise((resolve) => {
        resolve({
          message: "limit-exceed",
        });
      });
    }
  });
};

const imageCompare = ({ prevImage, currentImage }) => {
  var params = {
    SourceImage: {
      /* required */
      Bytes:
        Buffer.from(
          prevImage
        ) /* Strings will be Base-64 encoded on your behalf */,
      //   S3Object: {
      //     Bucket: '',
      //     Name: 'STRING_VALUE',
      //     Version: 'STRING_VALUE'
      //   }
    },
    TargetImage: {
      /* required */
      Bytes:
        Buffer.from(currentImage) ||
        "STRING_VALUE" /* Strings will be Base-64 encoded on your behalf */,
      //   S3Object: {
      //     Bucket: 'STRING_VALUE',
      //     Name: 'STRING_VALUE',
      //     Version: 'STRING_VALUE'
      //   }
    },
    // QualityFilter: NONE | AUTO | LOW | MEDIUM | HIGH,
    SimilarityThreshold: 90,
  };
  return rekognition.compareFaces(params).promise();
};

const getDonation = (donator_id) => {
  return client.then((db) => {
    return db
      .collection("paymentData")
      .find({ donator: donator_id, isAlerted: true })
      .project({ paymentData: 0 });
  });
};

exports.function = {
  findDocument,
  addDocument,
  addRequest,
  imageCompare,
  addPaymentData,
  findPaymentData,
  uploadImage,
  getRequests,
  removeRequests,
  getAllRequests,
  addSponsor,
  setSponsorPassword,
  applyDonation,
  getDonation,
};
