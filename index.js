const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

//middleware
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
    await client.connect();
    // AllScholarship
    // Reviews
    //Scholarship_Management_System

    //Collection
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

    // create middelware
    //verify token
    const verifyToken = (req, res, next) => {
      console.log("this is headers : ", req.headers.authorization);
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

    // create token JWT**************************
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ASSESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // console.log(token);
      res.send({ token });
    });

    //*********************All Scholarship************************** */

    //find all scholarship data
    app.get("/scholarship", async (req, res) => {
      const result = await AllScholarshipCollection.find().toArray();
      res.send(result);
    });

    //find scholarship data by Id
    app.get(`/scholarship/:id`, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await AllScholarshipCollection.findOne(quary);
      res.send(result);
    });

    //******************Reviews************ */
    //find all reaview
    app.get(`/reviews`, async (req, res) => {
      const result = await ReviewsCollection.find().toArray();
      res.send(result);
    });

    //********Application***************/

    //post application information in db
    app.post(`/application`, verifyToken, async (req, res) => {
      const application = req.body;
      const result = await applyInfoCollection.insertOne(application);
      res.send(result);
    });
    //get all application info
    // app.get(`/applications`, async (req, res) => {
    //   const result = await applyInfoCollection.find().toArray();
    //   res.send(result);
    // });

    //get application info by user email
    app.get("/application", async (req, res) => {
      const email = req.query.email;
      const query = { Applicant_email: email };
      const result = await applyInfoCollection.find(query).toArray();
      res.send(result);
    });

    //**********payment *************** */

    // payment intent
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
      res.send(paymentResult);
    });
    //get payment information by email

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
