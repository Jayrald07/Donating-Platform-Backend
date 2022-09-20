const route = require('express').Router();
const controller = require('../controller/index.controller').controller;
const multer = require('multer');
const upload = multer({
    dest: 'uploads/'
})

route.post("/validate", controller.findDocument);
route.post("/register", upload.fields([{ name: 'source', maxCount: 1 }, { name: 'target', maxCount: 1 }]), controller.addDocument);
route.post("/credentials", controller.getDocument);
route.post("/request", upload.any(), controller.addRequest);
route.post("/user", controller.onUser);
route.post("/test", controller.test)
route.post("/verify/payment", controller.verifyPaymentData);
route.post("/uploadImage", upload.single("img"), controller.uploadImage);
route.delete("/request/delete", controller.removeRequest);
route.get("/requests/all", controller.getAllRequests)
route.post("/register/sponsor", controller.addSponsor);
route.post("/confirm/email", controller.confirmEmail);
route.put("/setpassword", controller.setSponsorPassword);
route.post("/apply/donate", controller.applyDonation);
route.post("/sponsor/donation", controller.getDonation);


exports.route = route;