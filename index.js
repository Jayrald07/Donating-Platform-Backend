const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const route = require("./route/index.route").route;
const session = require("express-session");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const https = require("https");
const fs = require("fs");

app.use(
  cors({
    origin: ["https://helpadvocatesph.tech", "https://107.21.5.198:3000"],
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: SECRET_KEY,
    saveUninitialized: true,
    resave: true,
    cookie: { path: "/", httpOnly: true, secure: false },
  })
);
app.use(route);

// app.listen(8080, () => {
//     console.log("Listening...");
// })

https
  .createServer(
    {
      key: fs.readFileSync("./helpadvocatesph.pem"),
      cert: fs.readFileSync("./helpadvocatesph_tech.crt"),
      ca: fs.readFileSync("./helpadvocatesph_tech.ca-bundle"),
      passphrase: PASSPHRASE,
    },
    app
  )
  .listen(8080);
