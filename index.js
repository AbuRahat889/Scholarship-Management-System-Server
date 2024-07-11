const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY || "key-yourkeyhere",
});

//middleware
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "https://scholarship-management-system-server.vercel.app",
//     ],
//   })
// );
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dnt5uti.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    //Scholarship_Management_System

    //All Collection
    const AllScholarshipCollection = client
      .db("Scholarship_Management_System")
      .collection("AllScholarship");
    const ReviewsCollection = client
      .db("Scholarship_Management_System")
      .collection("Reviews");

    const paymentCollection = client
      .db("Scholarship_Management_System")
      .collection("payments");

    const applyInfoCollection = client
      .db("Scholarship_Management_System")
      .collection("application");

    const userCollection = client
      .db("Scholarship_Management_System")
      .collection("Users");

    // create middelware
    //verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorize access!!" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(
        token,
        process.env.ASSESS_TOKEN_SECRET,
        function (err, decoded) {
          if (err) {
            return res.status(401).send({ message: "Unauthorize access!!" });
          }
          req.decoded = decoded;
          next();
        }
      );
    };

    //verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      const isAdmin = result.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //verify Moderator after verify token
    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      const isModerator = result.role === "moderator";

      if (!isModerator) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // create token JWT**************************
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ASSESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // console.log(token);
      res.send({ token });
    });

    //*************user informaton  admin routs************* */

    //post user information sign up page
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const exitUser = await userCollection.findOne(query);
      if (exitUser) {
        return res.send({ message: "user already exits", insertedId: null });
      }
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });

    //get all user information (Admin)
    app.get(`/users`, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // //get email by email
    app.get(`/users/:email`, async (req, res) => {
      const email = req.params.email;
      const quary = { email: email };
      const result = await userCollection.findOne(quary);
      res.send(result);
    });

    //delete user
    app.delete(`/users/:id`, verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(quary);
      res.send(result);
    });

    //get admin emeil,, load admin email (useAdmin hook )
    app.get(`/users/admin/:email`, verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access!" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //get Moderator emeil,, load moderator email (useAdmin hook )
    app.get(`/users/moderator/:email`, verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "forbidden access!" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        moderator = user?.role === "moderator";
      }
      res.send({ moderator });
    });

    //create admin (set admin in allUser (admin) page)
    app.patch(
      `/users/admin/:id`,
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const userRole = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        console.log(result);
        res.send(result);
      }
    );
    //create Moderator (set admin in allUser (admin) page)
    app.patch(`/users/moderator/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const userRole = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "moderator",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      console.log(result);
      res.send(result);
    });

    //*********************All Scholarship************************** */

    //post scholarship
    app.post(`/scholarship`, verifyToken, async (req, res) => {
      const scholarInfo = req.body;
      const result = await AllScholarshipCollection.insertOne(scholarInfo);
      res.send(result);
    });
    //find all scholarship data (open)
    app.get("/scholarship", async (req, res) => {
      const result = await AllScholarshipCollection.find().toArray();
      res.send(result);
    });

    //find scholarship data by Id (user)
    app.get(`/scholarship/:id`, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await AllScholarshipCollection.findOne(quary);
      res.send(result);
    });

    //update scholarship information (admin)
    app.put(`/scholarship/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const updateInfo = req.body;
      const quary = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updateInfo,
        },
      };
      const result = await AllScholarshipCollection.updateOne(
        quary,
        updateDoc,
        options
      );
      res.send(result);
    });

    //delete scholarship by id (admin)
    app.delete(`/scholarship/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await AllScholarshipCollection.deleteOne(quary);
      res.send(result);
    });

    //******************Reviews************ */
    //find all reaview (open )
    app.get(`/reviews`, async (req, res) => {
      const result = await ReviewsCollection.find().toArray();
      res.send(result);
    });

    //find review by email Reviewer_email (user)
    app.get("/review", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { Reviewer_email: email };
      const result = await ReviewsCollection.find(query).toArray();
      res.send(result);
    });

    //post a review (user)
    app.post(`/review`, verifyToken, async (req, res) => {
      const review = req.body;
      const result = await ReviewsCollection.insertOne(review);
      res.send(result);
    });

    // find  review info by id (user)
    app.get(`/reviews/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await ReviewsCollection.findOne(quary);
      res.send(result);
    });

    //update review info (user)
    app.put(`/review/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const reviewInfo = req.body;
      const quary = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...reviewInfo,
        },
      };
      const options = { upsert: true };
      const result = await ReviewsCollection.updateOne(
        quary,
        updateDoc,
        options
      );
      res.send(result);
    });

    //delete review (user && admin)
    app.delete(`/review/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await ReviewsCollection.deleteOne(quary);
      res.send(result);
    });

    //********Application***************/

    //get all application information (admin)
    app.get(`/applications`, async (req, res) => {
      const result = await applyInfoCollection.find().toArray();
      res.send(result);
    });

    //post application information in db (user)
    app.post(`/application`, verifyToken, async (req, res) => {
      const application = req.body;
      const result = await applyInfoCollection.insertOne(application);
      res.send(result);
    });

    // get  application info by id (user)
    app.get(`/applications/:id`, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await applyInfoCollection.findOne(quary);
      res.send(result);
    });

    //update application info (user)
    app.put(`/applications/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const applyInfo = req.body;
      const quary = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...applyInfo,
        },
      };
      const options = { upsert: true };
      const result = await applyInfoCollection.updateOne(
        quary,
        updateDoc,
        options
      );
      res.send(result);
    });

    //Give Feedback  (admin, moderator)
    app.patch(`/application/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const statusInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          Feedback: statusInfo,
        },
      };
      const result = await applyInfoCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //update application Status processing (admin)
    app.patch(`/applicationp/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const statusInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          Status: "processing",
        },
      };
      const result = await applyInfoCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //update application Status complete (admin)
    app.patch(`/applicationc/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const statusInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          Status: "complete",
        },
      };
      const result = await applyInfoCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //get application info by user email (user)
    app.get("/application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { Applicant_email: email };
      const result = await applyInfoCollection.find(query).toArray();
      res.send(result);
    });

    //delete applicaation (user)
    app.delete(`/application/:id`, verifyToken, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await applyInfoCollection.deleteOne(quary);
      res.send(result);
    });

    //**********payment *************** */

    // payment intent (user)
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //add payment information
    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //send email
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Excited User <mailgun@sandbox0b6f4413e6f8484d8ab4d7d455fd4a6f.mailgun.org>",
          to: ["aburahatshaum889@gmail.com"],
          subject: "Thank you for applying ",
          text: "Testing some Mailgun awesomeness!",
          html: "<h1>Testing some Mailgun awesomeness!</h1>",
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.log(err)); // logs any error

      res.send(paymentResult);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("assignment 12 is running");
});

app.listen(port, () => {
  console.log(`assignment 12 is running on port ---${port}`);
});
