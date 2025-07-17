require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

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
    const marriageCollection = client.db("PeoplesMatrimony").collection("SuccessStories");

    // User API
    app.get('/user', async (req, res) => {
      try {
        const users = await userCollection.find().limit(6).toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    app.get('/success-stories', async (req, res) =>{
      try{
       const marriages = await marriageCollection.find().limit(6).toArray();
       res.send(marriages);
      }
      catch(err) {
        console.error("Error fetching success stories:", err);
        res.status(500).send("Internal server error");
      }
    })

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



  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`Server People's Matrimony app listening on port ${port}`);
});
