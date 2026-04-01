 CSV Template (Sprint 1)

Columns
- `api_path` Required. Full URL of API.
- `http_method` Required. `GET` or `POST`.
- `headers` JSON object as string. Example: `{"Accept":"application/json"}`.
- `query` JSON object as string. Example: `{"page":1,"limit":10}`.
- `authorization` String. Example: `Bearer <token>`.
- `body` JSON object as string. Required if `http_method` is `POST`.

Rules
- JSON must be valid and use double quotes.
- If `http_method` is `GET`, set `body` to empty.
- If `http_method` is `POST`, `body` is required.

Example CSV
```csv
api_path,http_method,headers,query,authorization,body
https://api.example.com/users,GET,"{""Accept"":""application/json""}","{""page"":1,""limit"":10}","Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",""
https://api.example.com/profile,GET,"{""Accept"":""application/json""}","{""page"":1,""limit"":10}","Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",""
https://api.example.com/login,POST,"{""Content-Type"":""application/json""}","","","{""username"":""test"",""password"":""1234""}"
https://api.example.com/orders,POST,"{""Content-Type"":""application/json""}","","Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9","{""productId"":1,""qty"":2}"
```
