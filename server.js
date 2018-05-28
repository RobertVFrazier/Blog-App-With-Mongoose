'use strict';

const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { BlogPost } = require('./models');
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost/blog-app';
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mongodb://localhost/test-blog-app';
const PORT = process.env.PORT || 8080;

const app = express();
app.use(morgan('common'));
app.use(express.json());

// GET requests to /posts => return posts.
app.get('/posts', (req, res) => {
  BlogPost
    .find()
    // Success callback: for each post we got back, we'll
    // call the `.serialize` instance method we've created in
    // models.js in order to only expose the data we want the API 
    // to return.
    .then(posts => {
      res.json({
        posts: posts.map(
          (post) => post.serialize())
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// Can also request by ID.
app.get('/posts/:id', (req, res) => {
  BlogPost
    // This is a convenience method Mongoose provides for searching
    // by the object _id property.
    .findById(req.params.id)
    .then(post => res.json(post.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});


app.post('/posts', (req, res) => {

  const requiredFields = ['title', 'content', 'author'];
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!(field in req.body)) {
      const message = `Missing \`${field}\` in request body`;
      console.error(message);
      return res.status(400).send(message);
    }
  }

  BlogPost
    .create({
      title: req.body.title,
      content: req.body.content,
      author: req.body.author
    })
    .then(post => res.status(201).json(post.serialize()))
    .catch(err => {
      console.error(err);
      res.status(500).json({ message: 'Internal server error' });
    });
});


app.put('/posts/:id', (req, res) => {
  // Ensure that the id in the request path and the one in request body match.
  if (!(req.params.id && req.body.id && req.params.id === req.body.id)) {
    const message = (
      `Request path id (${req.params.id}) and request body id ` +
      `(${req.body.id}) must match`);
    console.error(message);
    return res.status(400).json({ message: message });
  }

  // We only support a subset of fields being updateable.
  // If the user sent over any of the updatableFields, we udpate those values
  // in the document.
  const toUpdate = {};
  const updateableFields = ['title', 'content', 'author'];

  updateableFields.forEach(field => {
    if (field in req.body) {
      toUpdate[field] = req.body[field];
    }
  });

  BlogPost
    // all key/value pairs in toUpdate will be updated -- that's what `$set` does
    .findByIdAndUpdate(req.params.id, { $set: toUpdate })
    .then(post => res.status(204).end())
    .catch(err => res.status(500).json({ message: 'Internal server error' }));
});

app.delete('/posts/:id', (req, res) => {
  BlogPost
    .findByIdAndRemove(req.params.id)
    .then(post => res.status(204).end())
    .catch(err => res.status(500).json({ message: 'Internal server error' }));
});

// Catch-all endpoint if client makes request to non-existent endpoint.
app.use('*', function (req, res) {
  res.status(404).json({ message: 'Not Found' });
});

// "closeServer" needs access to a server object, but that only
// gets created when `runServer` runs, so we declare `server` here
// and then assign a value to it in runtime.
let server;

// This function connects to our database, then starts the server.
function runServer(databaseUrl) {
  return new Promise((resolve, reject) => {
    mongoose.connect(databaseUrl, err => {
      if (err) {
        return reject(err);
      }
      server = app.listen(PORT, () => {
        console.log(`Your app is listening on port ${PORT}.`);
        resolve();
      })
        .on('error', err => {
          mongoose.disconnect();
          reject(err);
        });
    });
  });
}

// This function closes the server, and returns a promise. We'll
// use it in our integration tests later.
function closeServer() {
  return mongoose.disconnect().then(() => {
    return new Promise((resolve, reject) => {
      console.log('Closing server');
      server.close(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

// If server.js is called directly (i.e., with `node server.js`), this block
// runs. But we also export the runServer command so other code (for instance,
// test code) can start the server as needed.
if (require.main === module) {
  runServer(DATABASE_URL).catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };
