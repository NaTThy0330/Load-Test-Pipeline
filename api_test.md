POST

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { validateSchema } from '../configs/schemaValidator.js';
import { optionsImport } from '../configs/options/k6-options_04.js';

// ------------------------------------------
// Custom metrics
// ------------------------------------------
export const responseTime = new Trend('response_time');
export const schemaFailures = new Counter('schema_failures');

// ------------------------------------------
// Load CUSTOMER.csv (CARD_NO)
// ------------------------------------------
const customerData = new SharedArray('cardNumbers', function () {
const text = open('../csv/CUSTOMER.csv');
const lines = text.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
const cardIndex = headers.indexOf('CARD_NO');
if (cardIndex === -1) throw new Error("'CARD_NO' column not found in CUSTOMER.csv");

return lines.slice(1)
.map(line => line.split(',')[cardIndex].trim())
.filter(v => v.length > 0);
});

// ------------------------------------------
// Load PRODUCT.csv (PRODUCT_CODE)
// ------------------------------------------
const productData = new SharedArray('productCodes', function () {
const text = open('../csv/PRODUCT.csv');
const lines = text.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
const prodIndex = headers.indexOf('PRODUCT_CODE');
if (prodIndex === -1) throw new Error("'PRODUCT_CODE' column not found in PRODUCT.csv");

return lines.slice(1)
.map(line => line.split(',')[prodIndex].trim())
.filter(v => v.length > 0);
});

// ------------------------------------------
// Schema
// ------------------------------------------
const schema = {
type: 'object',
properties: {
responseCode: { type: 'string' },
responseMsg: { type: 'string' },
resultModel: {
type: 'object',
properties: {
summaryOrder: {
type: ['object', 'null'],
properties: {
transId1: { type: ['number', 'null'] },
transId2: { type: ['number', 'null'] },
maxcardNo1: { type: ['string', 'null'] },
maxcardNo2: { type: ['string', 'null'] },
maxcardNoMasked1: { type: ['string', 'null'] },
maxcardNoMasked2: { type: ['string', 'null'] },
orderDate: { type: ['string', 'null'] },
totalDiscount: { type: ['number', 'null'] },
multiCardFlag: { type: ['boolean', 'null'] },
},
},
listPointExcludeRewardToPointModel: { type: ['array', 'null'] },
listPointOnlyRewardToPointModel: { type: ['array', 'null'] },
listPointAllModel: { type: ['array', 'null'] },
orderData1: { type: ['object', 'null'] },
orderData2: { type: ['object', 'null'] },
},
required: ['summaryOrder'],
},
},
required: ['responseCode', 'responseMsg', 'resultModel'],
};

// ------------------------------------------
// Options (50 requests per minute)
// ------------------------------------------
export const options = optionsImport;

// ------------------------------------------
// POST with retry
// ------------------------------------------
function postWithRetry(url, payload, params, retries = 1) {
for (let i = 0; i < retries; i++) {
const res = http.post(url, payload, params);

```
check(res, {
  [`[try ${i + 1}] status is 200`]: r => r.status === 200,
  [`[try ${i + 1}] body not empty`]: r => r.body && r.body.length > 0,
  [`[try ${i + 1}] duration < 30s`]: r => r.timings.duration < 30000,
});

const dur = Math.round(res.timings.duration);
if (res.status === 200) {
  return res;
} else {
  console.log(`Status=${res.status}, duration=${dur}ms${res.error ? `, error=${res.error}` : ''}`);
}
sleep(1);
```

}
throw new Error(`Failed POST after ${retries} retries`);
}

// ------------------------------------------
// Main Test
// ------------------------------------------
export default function () {
const cardNo = customerData[Math.floor(Math.random() * customerData.length)];
const productCode = productData[Math.floor(Math.random() * productData.length)];

const url = 'https://crm-microservice-uat.maxme.online/sale/api/order/sale';
const payload = JSON.stringify({
mid: '395216080000097',
tid: 'SP-22306',
batchId: 2025092804,
standId: 55011570,
maxcardNo1: cardNo,
maxcardNo2: '',
offlineDate: null,
trnPrice: 100.0,
netPrice: 100.0,
entryMode: 'KEY_IN',
paymentType: '302020',
sourceData: 2,
listECodeModel: null,
listOrderDetailModel: [
{
productCode: productCode,
productPrice: 30.49,
productQty: 3.28,
productPriceTotal: 100.0,
},
],
listRewardToPointModel: null,
});

const params = {
headers: { 'Content-Type': 'application/json' },
timeout: '30s',
};

let res;
try {
res = postWithRetry(url, payload, params);
responseTime.add(res.timings.duration);
} catch {
return;
}

let json;
try {
json = res.json();
} catch {
return;
}

// const valid = validateSchema(json, schema);
// if (!valid) {
//   schemaFailures.add(1);
//   console.log('Payload:', JSON.stringify(payload));
//   console.log('Invalid schema:', JSON.stringify(json));
// }

sleep(Math.random() * 2 + 1);
}

// ------------------------------------------
// Summary Report

GET

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { validateSchema } from '../configs/schemaValidator.js';
import { optionsImport } from '../configs/options/k6-options_04.js';

// ------------------------------------------
// Custom metrics
// ------------------------------------------
export const responseTime = new Trend('response_time');
export const schemaFailures = new Counter('schema_failures');

// ------------------------------------------
// Load CUSTOMER.csv (CARD_NO)
// ------------------------------------------
const customerData = new SharedArray('cardNumbers', function () {
const text = open('../csv/CUSTOMER.csv');
const lines = text.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
const cardIndex = headers.indexOf('CARD_NO');
if (cardIndex === -1) throw new Error("'CARD_NO' column not found in CUSTOMER.csv");

return lines.slice(1)
.map(line => line.split(',')[cardIndex].trim())
.filter(v => v.length > 0);
});

// ------------------------------------------
// Load PRODUCT.csv (PRODUCT_CODE)
// ------------------------------------------
const productData = new SharedArray('productCodes', function () {
const text = open('../csv/PRODUCT.csv');
const lines = text.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
const prodIndex = headers.indexOf('PRODUCT_CODE');
if (prodIndex === -1) throw new Error("'PRODUCT_CODE' column not found in PRODUCT.csv");

return lines.slice(1)
.map(line => line.split(',')[prodIndex].trim())
.filter(v => v.length > 0);
});

// ------------------------------------------
// Schema
// ------------------------------------------
const schema = {
type: 'object',
properties: {
responseCode: { type: 'string' },
responseMsg: { type: 'string' },
resultModel: {
type: 'object',
properties: {
summaryOrder: {
type: ['object', 'null'],
properties: {
transId1: { type: ['number', 'null'] },
transId2: { type: ['number', 'null'] },
maxcardNo1: { type: ['string', 'null'] },
maxcardNo2: { type: ['string', 'null'] },
maxcardNoMasked1: { type: ['string', 'null'] },
maxcardNoMasked2: { type: ['string', 'null'] },
orderDate: { type: ['string', 'null'] },
totalDiscount: { type: ['number', 'null'] },
multiCardFlag: { type: ['boolean', 'null'] },
},
},
listPointExcludeRewardToPointModel: { type: ['array', 'null'] },
listPointOnlyRewardToPointModel: { type: ['array', 'null'] },
listPointAllModel: { type: ['array', 'null'] },
orderData1: { type: ['object', 'null'] },
orderData2: { type: ['object', 'null'] },
},
required: ['summaryOrder'],
},
},
required: ['responseCode', 'responseMsg', 'resultModel'],
};

// ------------------------------------------
// Options (50 requests per minute)
// ------------------------------------------
export const options = optionsImport;

// ------------------------------------------
// POST with retry
// ------------------------------------------
function postWithRetry(url, payload, params, retries = 1) {
for (let i = 0; i < retries; i++) {
const res = http.post(url, payload, params);

```
check(res, {
  [`[try ${i + 1}] status is 200`]: r => r.status === 200,
  [`[try ${i + 1}] body not empty`]: r => r.body && r.body.length > 0,
  [`[try ${i + 1}] duration < 30s`]: r => r.timings.duration < 30000,
});

const dur = Math.round(res.timings.duration);
if (res.status === 200) {
  return res;
} else {
  console.log(`Status=${res.status}, duration=${dur}ms${res.error ? `, error=${res.error}` : ''}`);
}
sleep(1);
```

}
throw new Error(`Failed POST after ${retries} retries`);
}

// ------------------------------------------
// Main Test
// ------------------------------------------
export default function () {
const cardNo = customerData[Math.floor(Math.random() * customerData.length)];
const productCode = productData[Math.floor(Math.random() * productData.length)];

const url = 'https://crm-microservice-uat.maxme.online/sale/api/order/sale';
const payload = JSON.stringify({
mid: '395216080000097',
tid: 'SP-22306',
batchId: 2025092804,
standId: 55011570,
maxcardNo1: cardNo,
maxcardNo2: '',
offlineDate: null,
trnPrice: 100.0,
netPrice: 100.0,
entryMode: 'KEY_IN',
paymentType: '302020',
sourceData: 2,
listECodeModel: null,
listOrderDetailModel: [
{
productCode: productCode,
productPrice: 30.49,
productQty: 3.28,
productPriceTotal: 100.0,
},
],
listRewardToPointModel: null,
});

const params = {
headers: { 'Content-Type': 'application/json' },
timeout: '30s',
};

let res;
try {
res = postWithRetry(url, payload, params);
responseTime.add(res.timings.duration);
} catch {
return;
}

let json;
try {
json = res.json();
} catch {
return;
}

// const valid = validateSchema(json, schema);
// if (!valid) {
//   schemaFailures.add(1);
//   console.log('Payload:', JSON.stringify(payload));
//   console.log('Invalid schema:', JSON.stringify(json));
// }

sleep(Math.random() * 2 + 1);
}

// ------------------------------------------
// Summary Report