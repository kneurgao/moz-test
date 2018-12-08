const express = require('express');
const app = express();
const path = require('path');

app.get('/', function(req, res) {
    res.send("Test 200 OK");
});

app.listen(process.env.PORT || 3000, function(){
    console.log('Your app server is running...');
});