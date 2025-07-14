const express = require('express')
const app = express()
const port = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.send("Welcome to People's Matrimony!")
})

app.listen(port, () => {
  console.log(`Server People's Matrimony app listening on port ${port}`)
})