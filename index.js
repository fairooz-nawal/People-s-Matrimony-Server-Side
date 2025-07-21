require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const admin = require("firebase-admin");
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());



const serviceAccount = require("./firebase-SDK.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


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
    const RegisteredUserCollection = client.db("PeoplesMatrimony").collection("RegisteredUser");
    const favouriteCollection = client.db("PeoplesMatrimony").collection("Favourite");
    const marriageCollection = client.db("PeoplesMatrimony").collection("SuccessStories");
    const paymentCollection = client.db("PeoplesMatrimony").collection("UserPayment");
    const approvePremiumCollection = client.db("PeoplesMatrimony").collection("approvePremium");

    // All Get APIS

    const verifyJWT = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      // console.log(req.headers.authorization);
      if (!authHeader) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
      }
      const token = authHeader.split(' ')[1]; // Remove Bearer

      if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
      }
      //verify the token
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        // console.log(decoded);
        next();
      }
      catch (error) {
        return res.status(403).json({ message: 'Forbidden Access' });
      }
    }

    // Middleware to verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email; // This comes from verifyJWT
      const user = await RegisteredUserCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admins only" });
      }
      next();
    };

    // Get user role by email
    app.get('/user-role', async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      try {
        const user = await RegisteredUserCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
          email: user.email,
          role: user.role || "user", // Default to "user" if no role
          premium: user.premium || false, // Optional: include premium status
        });
      } catch (err) {
        console.error("Error fetching user role:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    //1.POST API to get users after they register into the system 
    app.post('/registereduser', async (req, res) => {
      try {
        const email = req.body.email;
        const userExists = await RegisteredUserCollection.findOne({ email });
        if (userExists) {
          return res.status(200).send({
            message: "User already exists",
            inserted: false
          });
        }
        const user = req.body;
        const result = await RegisteredUserCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Search user by partial email (case-insensitive)
    app.get('/adminsearch', async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).json({ message: "Please provide an email to search" });
      }

      const regex = new RegExp(email, "i"); // case-insensitive regex

      try {
        const users = await RegisteredUserCollection.find({
          email: { $regex: regex }
        }).toArray();

        if (users.length === 0) {
          return res.status(404).json({ message: "No users found" });
        }

        res.json(users);
      } catch (err) {
        console.error("Error searching user:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Toggle admin role
    app.patch('/admin/toggle-admin/:id', async (req, res) => {
      const { id } = req.params;
      const { action } = req.body; // action: "make" or "remove"

      if (!["make", "remove"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      try {
        const result = await RegisteredUserCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: action === "make" ? "admin" : "user" } }
        );
        res.json({
          message: `User has been ${action === "make" ? "made admin" : "removed from admin"}`,
          result
        });
      } catch (err) {
        console.error("Error toggling admin role:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });





    // GET API to SEARCH BY EMAIL FROM USER COLLECTION TABLE
    app.get('/userwithemail', async (req, res) => {
      try {
        const contactEmail = req.query.email;
        const result = await userCollection.findOne({
          contactEmail:
            { $regex: new RegExp(`^${contactEmail}$`, "i") }
        });
        res.send(result);
      }
      catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });


    // Get API for info of single user (protected Route)
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


    // GET API to get users after they register into the system
    app.get('/registereduser', async (req, res) => {
      try {
        const users = await RegisteredUserCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Backend route to update user role to "premiumUser"
    app.patch("/registereduser", async (req, res) => {
      const id = req.query.biodataId;
      const Id = parseInt(id);
      console.log(Id)
      try {
        const result = await RegisteredUserCollection.updateOne(
          { biodataId : Id},
          { $set: { role: "premiumUser" } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ message: "User upgraded to premium successfully" });
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Failed to update user role" });
      }
    });




    // Get API for info of All user (Private Route)
    app.get('/alluser', async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Get API for info of particular user detail (Private Route)
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

    // Get API for info of all favourite (Private Route)
    app.get('/allFavourites', async (req, res) => {
      try {
        const users = await favouriteCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    app.get('/approvePremium', async (req, res) => {
      try {
        const users = await approvePremiumCollection.find().toArray();
        res.send(users);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Premium POST

    app.post('/approvePremium', async (req, res) => {
      try {
        const reqEmail = req.query.email;
        console.log(reqEmail)
        const userExists = await approvePremiumCollection.findOne({ reqEmail });
        if (userExists) {
          return res.status(200).send({
            message: "User is already premium",
            inserted: false
          });
        }
        const user = req.body;
        const result = await approvePremiumCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).send("Internal server error");
      }
    });

    app.post('/alluser', async (req, res) => {
      try {
        const contactEmail = req.body.email;
        const userExists = await userCollection.findOne({ contactEmail });
        if (userExists) {
          return res.status(200).send({
            message: "User already exists",
            inserted: false
          });
        }
        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).send("Internal server error");
      }
    });

    // Put API for creating customer user Details (Private Route)
    app.put('/alluser/:id', async (req, res) => {
      const { id } = req.params;
      const updatedUser = req.body;

      if (updatedUser._id) {
        delete updatedUser._id;
      }

      try {
        // Check if user already has a biodataId
        const existingUser = await userCollection.findOne({ _id: new ObjectId(id) });

        let updateFields = { ...updatedUser }; // Start with updated fields
        let newBiodataId = null;

        // If user does NOT have a biodataId, generate and add it
        if (!existingUser.biodataId) {
          const totalUsers = await userCollection.countDocuments();
          newBiodataId = totalUsers === 0 ? 1 : totalUsers + 1;
          updateFields.biodataId = newBiodataId;
        }

        // Update in userCollection
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        // ALSO update in RegisteredUserCollection if biodataId was generated
        if (newBiodataId) {
          await RegisteredUserCollection.updateOne(
            { email: existingUser.contactEmail }, // Assuming `contactEmail` is same
            { $set: { biodataId: newBiodataId } }
          );
        }

        res.send(result);
      } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).send({ message: "Server error" });
      }
    });



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

    //Stripe Checkout API Intent (Private Route)
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

    // Save successful payment to DB (Private Route)
    app.post('/save-payment', async (req, res) => {
      try {
        const { biodataId, email, amount, paymentIntentId } = req.body;
        console.log(req.body);
        if (!biodataId || !email || !paymentIntentId) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const paymentData = {
          biodataId,
          email,
          amount,
          paymentIntentId,
          status: false, // Initially false. You can toggle it later from admin panel
          date: new Date()
        };

        const result = await paymentCollection.insertOne(paymentData);
        res.status(200).json({ message: "Payment saved successfully", result });
      } catch (err) {
        console.error("Error saving payment:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Get all contact requests (Private Route)
    app.get('/all-contact-requests', async (req, res) => {
      try {
        const contactRequests = await paymentCollection.find().toArray();
        res.status(200).json(contactRequests);
      } catch (err) {
        console.error("Error fetching contact requests:", err);
        res.status(500).json({ message: "Internal server error" });
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
