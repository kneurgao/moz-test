'use strict';

const express = require('express');
const app = express();
app.use(express.json());

var crypto = require('crypto');
var http = require('http');
// `bigJs` is used for number-precision when summing the bitFlag values
var bigJs = require('big.js');

// Set your expires times for several minutes into the future.
// An expires time excessively far in the future will not be honored by the Mozscape API.
// Divide the result of Date.now() by 1000 to make sure your result is in seconds.
var expires = Math.floor((Date.now() / 1000)) + 300;
var accessId = 'mozscape-7e741b7560';
var secretKey = '7ddf584df61b4282cb915eeec465001';

// `bitFlagExampleValues` is a list of bitFlag values as strings that we'll
// loop over and sum together using helper function: `sumColumnValues`
var bitFlagExampleValues = ['4', '16384', '536870912', '34359738368', '68719476736'];
var sumColumnValues = function (bitFlagValues) {
    return bitFlagValues.reduce(function (accu, bitFlag) {
        var accuValBig = new bigJs(accu);
        var bitFlagBig = new bigJs(bitFlag);
        var bigSum = accuValBig.plus(bitFlagBig);

        return bigSum.toString();
    }, 0);
};

// 'cols' is the sum of the bit flags representing each field you want returned.
// Learn more here: https://moz.com/help/guides/moz-api/mozscape/api-reference/url-metrics
// returns "144115291155070976"
var cols = sumColumnValues(bitFlagExampleValues);

// Put each parameter on a new line.
var stringToSign = accessId + "\n" + expires;

//create the hmac hash and Base64-encode it.
var signature = crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
//URL-encode the result of the above.
signature = encodeURIComponent(signature);

// var postData = JSON.stringify(['www.moz.com', 'www.apple.com', 'www.pizza.com']);

var options = {
    hostname: 'lsapi.seomoz.com',
    path: '/linkscape/url-metrics/?Cols=' +
        cols + '&AccessID=' + accessId +
        '&Expires=' + expires + '&Signature=' + signature,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // 'Content-Length': postData.length
    }
};

const Json2csvParser = require('json2csv').Parser;
// const fields = ['umrp', 'umrr', 'us', 'upa', 'pda'];
const fields = [
    {
        label: 'Canonical URL',
        value: 'uu',
    },
    {
        label: 'MozRank: URL',
        value: 'umrp'
    },
    {
        label: 'MozRank: URL (Raw)',
        value: 'umrr'
    },
    {
        label: 'HTTP Status Code',
        value: 'us'
    },
    {
        label: 'Page Authority',
        value: 'upa'
    },
    {
        label: 'Domain Authority',
        value: 'pda'
    }
]
const opts = { fields };

var fs = require('fs');

app.post('/moz', function (req, res) {
    var filename=req.query.filename;
    var urls = req.body;
    var count = 0;
    var mozData = [];

    const intervalObj = setInterval(function() {
        var startTime = new Date().getTime();
        var tempUrls = [];
        for (var index = 0; count < urls.length && index < 10; count++, index++) {
            tempUrls.push(urls[count]);
        }
        console.debug('tempUrls=' + tempUrls.length);

        var postData = JSON.stringify(tempUrls);
        options.headers['Content-Length'] = postData.length;

        var mozRequest = http.request(options, function (mozResponse) {
            var mozTempData = "";
            mozResponse.setEncoding('utf8');
            mozResponse.on('data', function (chunk) {
                mozTempData += chunk;
            });
            mozResponse.on('end', function () {
                // console.log('mozTempData=' + mozTempData);
                mozData = mozData.concat(JSON.parse(mozTempData));
                var endTime = new Date().getTime();
                console.log('mozData=' + mozData.length + ', time=' + (endTime-startTime)/1000);

                if (count == urls.length) {
                    console.log('mozData=' + JSON.stringify(mozData));

                    const parser = new Json2csvParser(opts);
                    const mozCsv = parser.parse(mozData);

                    fs.writeFile(filename + '.csv', mozCsv, function(err, data){
                        if (err) console.log(err);
                        console.log("Successfully Written to File.");
                    });

                    // console.log('mozCsv=' + mozCsv);
                    res.status(200).send(mozCsv);
                }
            });
        });

        //Make the request.
        mozRequest.write(postData);
        mozRequest.end();

        if (count == urls.length) {
            clearInterval(intervalObj);
        }

    }, 5000);
});

app.listen(process.env.PORT || 3000, function () {
    console.log('Your app server is running...');
});