require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send("Welcome to People's Matrimony!");
});

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pv5o1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client ONCE and keep it alive
    await client.connect();
    console.log("Connected to MongoDB");

    const userCollection = client.db("PeoplesMatrimony").collection("User");
    const favouriteCollection = client.db("PeoplesMatrimony").collection("Favourite");
    const marriageCollection = client.db("PeoplesMatrimony").collection("SuccessStories");

    // All Get APIS

    // Get API for info of single user
    app.get('/singlealluser', async (req, res) => {
      try {
        const email = req.query.email;
        if (email) {
          const user = await userCollection.findOne({ contactEmail: email });
          res.send(user);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Get API for info of All user
    app.get('/alluser', async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Get API for info of particular user detail
    app.get("/alluser/:id", async (req, res) => {
      const { id } = req.params;
      const biodata = await userCollection.findOne({ _id: new ObjectId(id) });
      if (!biodata) {
        return res.status(404).json({ error: "Biodata not found" });
      }
      res.json(biodata);
    });

    // Get API for info of all user but limited to 6
    app.get('/user', async (req, res) => {
      try {
        const users = await userCollection.find().limit(6).toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

   // Get API for Success Stories of Marriage
    app.get('/success-stories', async (req, res) => {
      try {
        const marriages = await marriageCollection.find().limit(6).toArray();
        res.send(marriages);
      }
      catch (err) {
        console.error("Error fetching success stories:", err);
        res.status(500).send("Internal server error");
      }
    })

    // Get API for gettting counts of all tables
    app.get('/success-counter', async (req, res) => {
      try {
        const totalUsers = await userCollection.countDocuments();
        const totalMales = await userCollection.countDocuments({ gender: "Male" });
        const totalFemales = await userCollection.countDocuments({ gender: "Female" });
        const totalMarriages = await marriageCollection.countDocuments();

        res.send({
          totalUsers,
          totalMales,
          totalFemales,
          totalMarriages
        });
      } catch (err) {
        console.error("Error fetching success counter:", err);
        res.status(500).send("Internal server error");
      }
    });

     app.get('/allFavourites', async (req, res) => {
      try {
        const users = await favouriteCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // USER POST

    // Post API for creating customer user Details
   app.put('/alluser/:id', async (req, res) => {
    const { id } = req.params;
    const updatedUser = req.body;
     if (updatedUser._id) {
            delete updatedUser._id;
        }
    try {
        const result = await userCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedUser }
        );
        res.send(result);
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).send({ message: "Server error" });
    }
});

    // Post API for Adding favourtite Biodata
    app.post('/addFavourite', async (req, res) => {
      try {
        const user = req.body;
        const result = await favouriteCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).send("Internal server error");
      }
    });

  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

//Stripe Checkout API Intent
app.post('/create-payment-intent', async (req, res) => {

  const amountInCent = req.body.amount * 100;
  try {
    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCent, // amount in cents
      currency: 'usd',
      payment_method_types: ['card'],
    });

    // Send the client secret to the client
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save successful payment to DB
app.post('/save-payment', async (req, res) => {
  try {
    const { biodataId, email, amount, paymentIntentId } = req.body;

    if (!biodataId || !email || !paymentIntentId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const paymentData = {
      biodataId,
      email,
      amount,
      paymentIntentId,
      approved: false, // Initially false. You can toggle it later from admin panel
      date: new Date()
    };

    const result = await paymentCollection.insertOne(paymentData);
    res.status(200).json({ message: "Payment saved successfully", result });
  } catch (err) {
    console.error("Error saving payment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});



run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Server People's Matrimony app listening on port ${port}`);
});
