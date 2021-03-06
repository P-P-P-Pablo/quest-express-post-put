// dotenv loads parameters (port and database config) from .env
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { check, validationResult } = require("express-validator");
const connection = require("./db");
const { log, logInfos } = require("./utils");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const userValidationMiddlewares = [
  // email must be valid
  check("email").isEmail(),
  // password must be at least 8 chars long
  check("password").isLength({ min: 8 }),
  // let's assume a name should be 2 chars long
  check("name").isLength({ min: 2 }),
];

// respond to requests on `/api/users`
app.get("/api/users", logInfos, (req, res) => {
  // send an SQL query to get all users
  connection.query("SELECT * FROM user", (err, results) => {
    if (err) {
      // If an error has occurred, then the client is informed of the error
      res.status(500).json({
        error: err.message,
        sql: err.sql,
      });
    } else {
      // If everything went well, we send the result of the SQL query as JSON
      res.json(results);
    }
  });
});

app.post("/api/users", logInfos, userValidationMiddlewares, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  // send an SQL query to get all users
  return connection.query(
    "INSERT INTO user SET ?",
    req.body,
    (err, results) => {
      if (err) {
        // If an error has occurred, then the client is informed of the error
        return res.status(500).json({
          error: err.message,
          sql: err.sql,
        });
      }
      // We use the insertId attribute of results to build the WHERE clause
      return connection.query(
        "SELECT * FROM user WHERE id = ?",
        results.insertId,
        (err2, records) => {
          if (err2) {
            return res.status(500).json({
              error: err2.message,
              sql: err2.sql,
            });
          }
          // If all went well, records is an array, from which we use the 1st item
          const insertedUser = records[0];
          // Extract all the fields *but* password as a new object (user)
          const { password, ...user } = insertedUser;
          // Get the host + port (localhost:3000) from the request headers
          const host = req.get("host");
          // Compute the full location, e.g. http://localhost:3000/api/users/132
          // This will help the client know where the new resource can be found!
          const location = `http://${host}${req.url}/${user.id}`;
          return res.status(201).set("Location", location).json(user);
        }
      );
    }
  );
});

app.put(
  "/api/users/:id",
  logInfos,
  [
    // email must be valid
    check("email").isEmail().optional(true),
    // password must be at least 8 chars long
    check("password").isLength({ min: 8 }).optional(true),
    // let's assume a name should be 2 chars long
    check("name").isLength({ min: 2 }).optional(true),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    // send an SQL query to update user
    return connection.query(
      "UPDATE user SET ? WHERE ?",
      [req.body, { id: req.params.id }],
      (err, results) => {
        if (err) {
          // If an error has occurred, then the client is informed of the error
          return res.status(500).json({
            error: err.message,
            sql: err.sql,
          });
        }
        // If everything went well, we send the result of the SQL query as JSON
        return connection.query(
          "SELECT * FROM user WHERE id = ?",
          req.params.id,
          (err2, records) => {
            if (err2) {
              return res.status(500).json({
                error: err2.message,
                sql: err2.sql,
              });
            }
            // If all went well, records is an array, from which we use the 1st item
            const insertedUser = records[0];
            // Extract all the fields *but* password as a new object (user)
            const { password, ...user } = insertedUser;
            // Get the host + port (localhost:3000) from the request headers
            const host = req.get("host");
            // Compute the full location, e.g. http://localhost:3000/api/users/132
            // This will help the client know where the new resource can be found!
            const location = `http://${host}${req.url}/${user.id}`;
            return res.status(201).set("Location", location).json(user);
          }
        );
      }
    );
  }
);

app.listen(process.env.PORT, (err) => {
  if (err) {
    throw new Error("Something bad happened...");
  }

  log(`Server is listening on ${process.env.PORT}`);
});
